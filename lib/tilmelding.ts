import type { Db } from "./db";
import type { Afsender } from "./mail/afsender";
import { bekraeftelsesmail } from "./mail/skabeloner";
import { afmeldtOpbevaringDage, erTestmodtager, juraGodkendt } from "./config";
import { omraadeForPostnummer } from "./omraade";
import {
  hashToken,
  laesAfmeldToken,
  laesPolitikFraToken,
  laesSkiftToken,
  laesSletToken,
  nytToken,
  rateNoegle,
} from "./tokens";
import { bekraeftVistSamtykke, type GaeldendeSamtykke } from "./samtykke-bevis";
import type { Tilmelding } from "./validering";

export type TilmeldResultat =
  | { status: "ok" }
  | { status: "spaerret" }
  | { status: "ukendt_postnummer" }
  | { status: "for_mange" }
  | { status: "samtykke_foraeldet" };

export const BEKRAEFT_TIMER = 72;
const MAKS_PR_IP_PR_TIME = 20;
const MAKS_PR_EMAIL_PR_TIME = 3;

async function overGraense(db: Db, noegle: string, maks: number): Promise<boolean> {
  const [{ antal }] = await db.query<{ antal: number }>(
    `select count(*)::int as antal from ratebegraensning where noegle = $1 and tidspunkt > now() - interval '1 hour'`,
    [noegle],
  );
  if (antal >= maks) return true;
  await db.query(`insert into ratebegraensning (noegle) values ($1)`, [noegle]);
  return false;
}

/**
 * Opretter eller fornyer en ubekræftet tilmelding og sender bekræftelsesmail (double opt-in).
 * Svarer "ok" både for nye og allerede tilmeldte, så man ikke kan aflure, hvem der er tilmeldt.
 * Samtykket gemmes kun, hvis formularen viste præcis den gældende tekst (version og SHA-256).
 */
export async function tilmeld(
  db: Db,
  afsender: Afsender,
  input: Tilmelding,
  ctx: { ip: string; appUrl: string; nu: Date },
): Promise<TilmeldResultat> {
  const test = erTestmodtager(input.email);
  if (!juraGodkendt() && !test) return { status: "spaerret" };

  const omraade = omraadeForPostnummer(input.postnummer);
  if (!omraade) return { status: "ukendt_postnummer" };

  if (await overGraense(db, rateNoegle("ip", ctx.ip), MAKS_PR_IP_PR_TIME)) return { status: "for_mange" };
  if (await overGraense(db, rateNoegle("email", input.email), MAKS_PR_EMAIL_PR_TIME)) return { status: "for_mange" };

  const elpris = await bekraeftVistSamtykke(db, "elpris", { version: input.samtykke_version, hash: input.samtykke_hash });
  if (!elpris) return { status: "samtykke_foraeldet" };

  let politik: GaeldendeSamtykke | null = null;
  if (input.politik_samtykke) {
    politik = await bekraeftVistSamtykke(db, "politik", {
      version: input.politik_samtykke_version!,
      hash: input.politik_samtykke_hash!,
    });
    if (!politik) return { status: "samtykke_foraeldet" };
  }

  const nu = ctx.nu.toISOString();
  const token = nytToken();
  // Ubekræftede og afmeldte rækker fornyes (en afmeldt person kan tilmelde sig igen via ny bekræftelse).
  // En aktiv tilmelding røres ikke, så ingen kan ændre en andens postnummer ved at kende e-mailadressen.
  const rows = await db.query<{ id: string }>(
    `insert into tilmeldte (email, postnummer, omraade, test, bekraeft_token_hash, oprettet)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (email) do update set
       postnummer = excluded.postnummer, omraade = excluded.omraade, test = excluded.test,
       status = 'afventer', afmeldt_tidspunkt = null, bekraeftet_tidspunkt = null,
       bekraeft_token_hash = excluded.bekraeft_token_hash, oprettet = excluded.oprettet
     where tilmeldte.status in ('afventer', 'afmeldt')
     returning id`,
    [input.email, input.postnummer, omraade, test, hashToken(token), nu],
  );
  if (rows.length === 0) return { status: "ok" }; // allerede aktiv

  const id = rows[0].id;
  // Et nyt forsøg erstatter tidligere samtykker, der aldrig blev bekræftet eller blev trukket tilbage.
  await db.query(`delete from samtykker where tilmeldt_id = $1`, [id]);
  for (const s of [{ type: "elpris", ...elpris }, ...(politik ? [{ type: "politik", ...politik }] : [])]) {
    await db.query(
      `insert into samtykker (tilmeldt_id, type, version, ordlyd, givet) values ($1, $2, $3, $4, $5)`,
      [id, s.type, s.version, s.tekst, nu],
    );
  }

  const link = `${ctx.appUrl}/bekraeft?token=${encodeURIComponent(token)}`;
  await afsender.send(
    bekraeftelsesmail({
      email: input.email,
      link,
      appUrl: ctx.appUrl,
      samtykker: [elpris.tekst, ...(politik ? [politik.tekst] : [])],
    }),
  );
  return { status: "ok" };
}

/** Bekræfter en tilmelding (double opt-in) og aktiverer samtykkerne. Returnerer true ved gyldigt token. */
export async function bekraeft(db: Db, token: string, nu: Date): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `with t as (
       update tilmeldte set status = 'aktiv', bekraeftet_tidspunkt = $2, bekraeft_token_hash = null
       where bekraeft_token_hash = $1 and status = 'afventer'
         and oprettet > $2::timestamptz - interval '${BEKRAEFT_TIMER} hours'
       returning id
     ), s as (
       update samtykker set status = 'aktiv', bekraeftet = $2
       where tilmeldt_id in (select id from t) and status = 'afventer'
     )
     select id from t`,
    [hashToken(token), nu.toISOString()],
  );
  return rows.length === 1;
}

/**
 * Afmelder fra nyhedsbrevet: begge samtykker trækkes tilbage med tidspunkt, og udsendelserne stopper.
 * Rækken bevares som dokumentation for samtykke og tilbagetrækning (se rydOp for, hvornår den slettes).
 * Kan gentages uden fejl.
 */
export async function afmeld(db: Db, token: string, nu: Date): Promise<"ok" | "ugyldig"> {
  const id = laesAfmeldToken(token);
  if (!id) return "ugyldig";
  await db.query(
    `with s as (
       update samtykker set status = 'tilbagekaldt', tilbagekaldt = $2 where tilmeldt_id = $1 and status <> 'tilbagekaldt'
     )
     update tilmeldte set status = 'afmeldt', afmeldt_tidspunkt = coalesce(afmeldt_tidspunkt, $2), bekraeft_token_hash = null
     where id = $1 and status <> 'afmeldt'`,
    [id, nu.toISOString()],
  );
  return "ok";
}

/** Trækker kun det politiske samtykke tilbage. Elpriserne fortsætter. */
export async function traekPolitikTilbage(db: Db, token: string, nu: Date): Promise<"ok" | "ugyldig"> {
  const id = laesPolitikFraToken(token);
  if (!id) return "ugyldig";
  await db.query(
    `update samtykker set status = 'tilbagekaldt', tilbagekaldt = $2
     where tilmeldt_id = $1 and type = 'politik' and status <> 'tilbagekaldt'`,
    [id, nu.toISOString()],
  );
  return "ok";
}

/** Sletter personen helt: tilmelding, samtykker, udsendelseslog og ratebegrænsning. */
export async function slet(db: Db, token: string): Promise<"ok" | "ugyldig"> {
  const id = laesSletToken(token);
  if (!id) return "ugyldig";
  const slettet = await db.query<{ email: string }>(`delete from tilmeldte where id = $1 returning email`, [id]);
  for (const { email } of slettet) {
    await db.query(`delete from ratebegraensning where noegle = $1`, [rateNoegle("email", email)]);
  }
  return "ok";
}

/** Skifter postnummer (og dermed elprisområde) for en aktiv tilmelding. */
export async function skiftPostnummer(db: Db, token: string, postnummer: string): Promise<"ok" | "ugyldig" | "ukendt_postnummer"> {
  const id = laesSkiftToken(token);
  if (!id) return "ugyldig";
  const omraade = omraadeForPostnummer(postnummer);
  if (!omraade) return "ukendt_postnummer";
  const r = await db.query(
    `update tilmeldte set postnummer = $2, omraade = $3 where id = $1 and status = 'aktiv' returning id`,
    [id, postnummer, omraade],
  );
  return r.length === 1 ? "ok" : "ugyldig";
}

/**
 * Oprydning: ubekræftede tilmeldinger slettes efter 72 timer, ratebegrænsning efter et døgn, og
 * afmeldte efter opbevaringsfristen (AFMELDT_OPBEVARING_DAGE, standard 365). Tidligere driftslog
 * ældre end 180 dage slettes. Slettede personer efterlader intet.
 */
export async function rydOp(db: Db, nu: Date): Promise<{ slettede: number; afmeldteSlettet: number }> {
  const slettede = await db.query(
    `delete from tilmeldte where status = 'afventer'
       and oprettet < $1::timestamptz - interval '${BEKRAEFT_TIMER} hours' returning id`,
    [nu.toISOString()],
  );
  const afmeldte = await db.query(
    `delete from tilmeldte where status = 'afmeldt'
       and afmeldt_tidspunkt < $1::timestamptz - make_interval(days => $2::int) returning id`,
    [nu.toISOString(), afmeldtOpbevaringDage()],
  );
  await db.query(`delete from ratebegraensning where tidspunkt < $1::timestamptz - interval '1 day'`, [nu.toISOString()]);
  await db.query(`delete from driftslog where tidspunkt < $1::timestamptz - interval '180 days'`, [nu.toISOString()]);
  return { slettede: slettede.length, afmeldteSlettet: afmeldte.length };
}
