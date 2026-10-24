import { createHash } from "node:crypto";
import type { Db } from "./db";
import { juraGodkendt, valgfri } from "./config";
import { TESTKILDE_NAVN } from "./kilder/test";
import type { Priskilde } from "./kilder/typer";
import { PORTION, type Afsender, type Mail } from "./mail/afsender";
import { driftsbesked, elprisMail, type PrognoseDel } from "./mail/skabeloner";
import { erFuldDag, opsummer, timeserie } from "./pris/dag";
import { hentHistorik, hentOgGem, hentSlots } from "./pris/lager";
import { OMRAADER, type Omraade } from "./pris/typer";
import { lavPrognose, maaVisePrognose, vurderBilligsteDag } from "./prognose/prognose";
import { dagensGraenser, danskDato, foerUdsendelsesvindue, iUdsendelsesvindue, laegDage } from "./tid";
import { afmeldToken, skiftToken, sletToken } from "./tokens";
import { FOERSTE_VERSION_MED_POLITIK_I_SAMTYKKET } from "./samtykke";

export type OmraadeStatus = "sprunget_over" | "faerdig" | "afventer_priser" | "droppet" | "tid_opbrugt" | "allerede_faerdig";

export interface OmraadeResultat {
  status: OmraadeStatus;
  sendt: number;
  fejlet: number;
  prognose: boolean;
  aarsag?: string;
}

export interface UdsendResultat {
  status: "uden_for_vindue" | "kort";
  dato: string;
  omraader: Partial<Record<Omraade, OmraadeResultat>>;
}

interface Modtager {
  id: string;
  email: string;
  postnummer: string;
  har_politik: boolean;
}

/** Id for en portion: samme modtagere samme dag giver samme nøgle (Resend-idempotens i 24 t). */
function portionsnoegle(dato: string, omr: string, ids: string[]): string {
  const h = createHash("sha256").update([...ids].sort().join(",")).digest("hex").slice(0, 32);
  return `elpris-${dato}-${omr}-${h}`;
}

async function driftslog(db: Db, niveau: "info" | "advarsel" | "fejl", kilde: string, besked: string) {
  await db.query(`insert into driftslog (niveau, kilde, besked) values ($1, $2, $3)`, [niveau, kilde, besked]);
}

async function adminBesked(afsender: Afsender, emne: string, linjer: string[]) {
  const til = valgfri("ADMIN_EMAIL");
  if (!til) return;
  try {
    await afsender.send(driftsbesked(emne, linjer, til));
  } catch (fejl) {
    console.error("Kunne ikke sende besked til administrator", fejl);
  }
}

/** Bruger dagens priser testdata? Så må de ikke sendes til rigtige modtagere. */
async function brugerTestdata(db: Db, omr: Omraade, dato: string): Promise<boolean> {
  const [r] = await db.query<{ n: number }>(
    `select count(*)::int as n from spotpriser
     where omraade = $1 and start_utc >= $2 and start_utc < $3 and kilde = $4`,
    [omr, dagensGraenser(dato).start.toISOString(), dagensGraenser(dato).slut.toISOString(), TESTKILDE_NAVN],
  );
  return r.n > 0;
}

/**
 * Sender dagens nyhedsbrev for begge elprisområder. Kan kaldes mange gange (cron hvert 5. minut fra 16.00 til
 * 18.59 dansk tid) uden at nogen får to mails:
 *  - hver modtager reserveres med INSERT ... ON CONFLICT DO NOTHING på (tilmeldt_id, dato), og kun de rækker,
 *    kørslen selv fik indsat, sendes;
 *  - sendes allerede (status 'faerdig'), gør kørslen intet.
 *
 * Mangler morgendagens priser (eller er datasættet ufuldstændigt), sendes der intet for det område. Der
 * hentes igen ved næste kald. Er priserne ikke kommet kl. 19.00, droppes dagens udsendelse for området, og
 * det logges og meldes til administratoren. Gamle eller opdigtede priser bruges aldrig.
 */
export async function udsend(
  db: Db,
  afsender: Afsender,
  opts: {
    nu: Date;
    appUrl: string;
    kilde: Priskilde;
    tvang?: boolean;
    tidsbudgetMs?: number;
    ur?: () => number;
  },
): Promise<UdsendResultat> {
  const { nu, appUrl, kilde } = opts;
  const ur = opts.ur ?? Date.now;
  const slut = ur() + (opts.tidsbudgetMs ?? 240_000);
  const dato = danskDato(nu);
  const imorgen = laegDage(dato, 1);
  const resultat: UdsendResultat = { status: "kort", dato, omraader: {} };

  if (!opts.tvang && foerUdsendelsesvindue(nu)) {
    return { ...resultat, status: "uden_for_vindue" };
  }
  const efterVindue = !opts.tvang && !iUdsendelsesvindue(nu);

  let hentet = false;
  const hentFriskeHvisMangler = async (): Promise<void> => {
    if (hentet) return;
    hentet = true;
    try {
      await hentOgGem(db, kilde, dato, imorgen);
    } catch (fejl) {
      // Fejlen er allerede logget af hentOgGem; udsendelsen venter blot på priserne.
      console.error("Kunne ikke hente priser", fejl);
    }
  };

  for (const omr of OMRAADER) {
    const [raekke] = await db.query<{ status: string }>(
      `insert into udsendelser (dato, omraade) values ($1, $2) on conflict do nothing returning status`,
      [dato, omr],
    );
    const status =
      raekke?.status ?? (await db.query<{ status: string }>(`select status from udsendelser where dato = $1 and omraade = $2`, [dato, omr]))[0].status;
    if (status === "faerdig" || status === "droppet" || status === "stoppet") {
      resultat.omraader[omr] = { status: status === "faerdig" ? "allerede_faerdig" : "droppet", sendt: 0, fejlet: 0, prognose: false };
      continue;
    }

    let slots = await hentSlots(db, omr, imorgen);
    if (!erFuldDag(imorgen, slots).fuld) {
      await hentFriskeHvisMangler();
      slots = await hentSlots(db, omr, imorgen);
    }
    const fuld = erFuldDag(imorgen, slots);
    if (!fuld.fuld) {
      const aarsag = `morgendagens priser for ${omr} er ikke fuldstændige: ${fuld.aarsag}`;
      if (efterVindue) {
        await db.query(`update udsendelser set status = 'droppet', afsluttet = now(), note = $3 where dato = $1 and omraade = $2`, [dato, omr, aarsag]);
        await driftslog(db, "fejl", "udsendelse", `Udsendelsen for ${omr} ${dato} droppet: ${aarsag}`);
        await adminBesked(afsender, `Udsendelsen for ${omr} blev droppet`, [`Dato: ${dato}`, aarsag, "Der er ikke sendt noget til abonnenterne."]);
        resultat.omraader[omr] = { status: "droppet", sendt: 0, fejlet: 0, prognose: false, aarsag };
      } else {
        const foerste = status === "i_gang";
        await db.query(`update udsendelser set status = 'afventer_priser', note = $3 where dato = $1 and omraade = $2`, [dato, omr, aarsag]);
        if (foerste) {
          await driftslog(db, "advarsel", "udsendelse", `Venter på priser for ${omr} ${dato}: ${aarsag}`);
          await adminBesked(afsender, `Venter på morgendagens priser for ${omr}`, [`Dato: ${dato}`, aarsag, "Systemet prøver igen automatisk hvert 5. minut indtil kl. 19."]);
        }
        resultat.omraader[omr] = { status: "afventer_priser", sendt: 0, fejlet: 0, prognose: false, aarsag };
      }
      continue;
    }

    // Efter kl. 19 sendes ikke mere, selv om priserne er kommet.
    if (efterVindue) {
      const aarsag = "uden for udsendelsesvinduet (efter kl. 19)";
      await db.query(`update udsendelser set status = 'droppet', afsluttet = now(), note = $3 where dato = $1 and omraade = $2`, [dato, omr, aarsag]);
      await driftslog(db, "advarsel", "udsendelse", `Udsendelsen for ${omr} ${dato} blev ikke sendt: ${aarsag}`);
      resultat.omraader[omr] = { status: "droppet", sendt: 0, fejlet: 0, prognose: false, aarsag };
      continue;
    }

    const dag = opsummer(imorgen, slots);
    const serie = timeserie(slots);

    // Prognose: kun hvis modellen har bestået den tilbageskuende test. Fejl her må ikke stoppe mailen.
    let prognoseDel: PrognoseDel | null = null;
    try {
      const historik = await hentHistorik(db, omr, imorgen, 130);
      const tilladelse = maaVisePrognose(historik, imorgen);
      if (tilladelse.tilladt) {
        const p = lavPrognose(historik, imorgen);
        if (p) {
          prognoseDel = { dage: p.dage, vurdering: vurderBilligsteDag({ dato: imorgen, gennemsnit: dag.gennemsnit }, p.dage) };
          for (const d of p.dage) {
            await db.query(
              `insert into prognoser (omraade, for_dato, kendt_til, model_version, data) values ($1, $2, $3, $4, $5::jsonb)
               on conflict do nothing`,
              [omr, d.dato, imorgen, p.modelVersion, JSON.stringify(d)],
            );
          }
        }
      } else {
        await driftslog(db, "info", "prognose", `Prognose for ${omr} ${dato} vises ikke: ${tilladelse.begrundelse}`);
      }
    } catch (fejl) {
      await driftslog(db, "fejl", "prognose", `Prognose for ${omr} fejlede: ${fejl instanceof Error ? fejl.message : String(fejl)}`);
      prognoseDel = null;
    }

    const [{ budskab }] = await db.query<{ budskab: string }>(
      `select coalesce((select vaerdi from indstillinger where noegle = 'df_budskab_tekst'), '') as budskab`,
    );

    // Rigtige tilmeldte får kun mail, når samtykket er godkendt OG priserne er rigtige.
    const kunTest = !juraGodkendt() || kilde.navn === TESTKILDE_NAVN || (await brugerTestdata(db, omr, imorgen));

    let sendt = 0;
    let fejlet = 0;
    const fejlbeskeder: string[] = [];
    let tidOpbrugt = false;

    for (;;) {
      if (ur() > slut) {
        tidOpbrugt = true;
        break;
      }
      const kandidater = await db.query<Modtager>(
        `select t.id, t.email, t.postnummer,
                -- Politisk information er dækket af elprissamtykket fra version 2, og før det af et separat samtykke.
                (exists (select 1 from samtykker s where s.tilmeldt_id = t.id and s.type = 'elpris' and s.status = 'aktiv' and s.version >= $4)
                 or exists (select 1 from samtykker s where s.tilmeldt_id = t.id and s.type = 'politik' and s.status = 'aktiv')) as har_politik
         from tilmeldte t
         where t.status = 'aktiv' and t.elpris_aktiv and t.omraade = $3 and ($2::boolean = false or t.test = true)
           and exists (select 1 from samtykker s where s.tilmeldt_id = t.id and s.type = 'elpris' and s.status = 'aktiv')
           and not exists (select 1 from udsendelseslog l where l.tilmeldt_id = t.id and l.dato = $1)
         order by t.id limit ${PORTION}`,
        [dato, kunTest, omr, FOERSTE_VERSION_MED_POLITIK_I_SAMTYKKET],
      );
      if (kandidater.length === 0) break;

      const reserveret = new Set(
        (
          await db.query<{ tilmeldt_id: string }>(
            `insert into udsendelseslog (tilmeldt_id, dato)
             select unnest($1::uuid[]), $2::date
             on conflict do nothing returning tilmeldt_id`,
            [kandidater.map((m) => m.id), dato],
          )
        ).map((r) => r.tilmeldt_id),
      );
      const modtagere = kandidater.filter((m) => reserveret.has(m.id));
      if (modtagere.length === 0) continue; // en anden kørsel nåede dem først

      const mails: Mail[] = modtagere.map((m) => {
        const t = (x: string) => encodeURIComponent(x);
        const mail = elprisMail({
          omraade: omr,
          postnummer: m.postnummer,
          dag,
          serie,
          prognose: prognoseDel,
          dfBudskab: m.har_politik && budskab.trim() ? budskab : undefined,
          links: {
            hjemmeside: appUrl,
            logo: `${appUrl}/mail/logo-lys.png`,
            bolge: `${appUrl}/mail/bolge.png`,
            privatliv: `${appUrl}/privatlivspolitik`,
            stop: `${appUrl}/afmeld?token=${t(afmeldToken(m.id))}`,
            stopEtKlik: `${appUrl}/api/afmeld?token=${t(afmeldToken(m.id))}`,
            skiftPostnummer: `${appUrl}/skift-postnummer?token=${t(skiftToken(m.id))}`,
            slet: `${appUrl}/slet?token=${t(sletToken(m.id))}`,
          },
        });
        return { ...mail, to: m.email };
      });

      const ids = modtagere.map((m) => m.id);
      try {
        const resendIds = await afsender.sendPortion(mails, portionsnoegle(dato, omr, ids));
        await db.query(
          `update udsendelseslog l set status = 'sendt', resend_id = v.resend_id, opdateret = now()
           from unnest($1::uuid[], $2::text[]) as v(tilmeldt_id, resend_id)
           where l.tilmeldt_id = v.tilmeldt_id and l.dato = $3`,
          [ids, resendIds, dato],
        );
        sendt += ids.length;
      } catch (fejl) {
        console.error("Portion fejlede", fejl);
        fejlbeskeder.push(fejl instanceof Error ? fejl.message : String(fejl));
        await db.query(
          `update udsendelseslog set status = 'fejlet', opdateret = now() where tilmeldt_id = any($1::uuid[]) and dato = $2`,
          [ids, dato],
        );
        fejlet += ids.length;
      }
    }

    await db.query(
      `update udsendelser set sendt = sendt + $3, fejlet = fejlet + $4, prognose = $5,
         status = case when $6::boolean then 'i_gang' else 'faerdig' end,
         afsluttet = case when $6::boolean then null else now() end, note = null
       where dato = $1 and omraade = $2`,
      [dato, omr, sendt, fejlet, prognoseDel !== null, tidOpbrugt],
    );
    if (fejlet > 0) {
      await driftslog(db, "fejl", "udsendelse", `${fejlet} mails til ${omr} kunne ikke sendes: ${fejlbeskeder.join("; ")}`);
      await adminBesked(afsender, `Fejl i udsendelsen for ${omr}`, [`Dato: ${dato}`, `Sendt: ${sendt}, fejlet: ${fejlet}`, ...fejlbeskeder]);
    }
    await driftslog(db, "info", "udsendelse", `${omr} ${dato}: ${sendt} sendt, ${fejlet} fejlet, prognose ${prognoseDel ? "ja" : "nej"}`);
    resultat.omraader[omr] = { status: tidOpbrugt ? "tid_opbrugt" : "faerdig", sendt, fejlet, prognose: prognoseDel !== null };
  }
  return resultat;
}
