import type { Db } from "./db";
import type { Afsender, Mail } from "./mail/afsender";
import { bekraeftelsesmail } from "./mail/skabeloner";
import { erTestmodtager, juraGodkendt } from "./config";
import { omraadeForPostnummer } from "./omraade";
import { hashToken, laesAfmeldToken, laesSkiftToken, laesSletToken, nytToken, rateNoegle } from "./tokens";
import { bekraeftVistSamtykke } from "./samtykke-bevis";
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
 * Sender bekræftelsesmailen og logger udfaldet (lykkedes eller fejlet med Resends fejltekst) til Vercels logs.
 * Adressen logges aldrig i klartekst: kun tilmeldingens id, og adressen fjernes fra fejlteksten.
 */
async function sendBekraeftelse(afsender: Afsender, id: string, email: string, mail: Mail): Promise<void> {
  try {
    const resendId = await afsender.send(mail);
    console.log("bekraeftelsesmail", JSON.stringify({ resultat: "sendt", tilmeldt: id, resend_id: resendId }));
  } catch (fejl) {
    const tekst = fejl instanceof Error ? fejl.message : String(fejl);
    console.error("bekraeftelsesmail", JSON.stringify({ resultat: "fejlet", tilmeldt: id, fejl: tekst.replace(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[adresse]") }));
    throw fejl;
  }
}

/**
 * Opretter eller fornyer en ubekræftet tilmelding og sender bekræftelsesmail (double opt-in).
 * Svarer "ok" både for nye og allerede tilmeldte, så man ikke kan aflure, hvem der er tilmeldt.
 * Samtykket gemmes kun, hvis formularen viste præcis den gældende tekst (version og SHA-256).
 * Ét samtykke dækker både elpriserne og politisk information; der oprettes ikke længere et separat
 * politisk samtykke.
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

  const nu = ctx.nu.toISOString();
  const token = nytToken();
  // Ubekræftede rækker, afmeldte rækker og rækker, hvor den daglige mail er stoppet, fornyes: personen
  // tilmelder sig igen og bekræfter på ny. En aktiv tilmelding med aktiv mail røres ikke, så ingen kan
  // ændre en andens postnummer ved at kende e-mailadressen.
  const rows = await db.query<{ id: string }>(
    `insert into tilmeldte (email, postnummer, omraade, test, bekraeft_token_hash, oprettet)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (email) do update set
       postnummer = excluded.postnummer, omraade = excluded.omraade, test = excluded.test,
       status = 'afventer', afmeldt_tidspunkt = null, bekraeftet_tidspunkt = null,
       elpris_aktiv = true, elpris_stoppet = null,
       bekraeft_token_hash = excluded.bekraeft_token_hash, oprettet = excluded.oprettet
     where tilmeldte.status in ('afventer', 'afmeldt') or tilmeldte.elpris_aktiv = false
     returning id`,
    [input.email, input.postnummer, omraade, test, hashToken(token), nu],
  );
  if (rows.length === 0) return { status: "ok" }; // allerede aktiv

  const id = rows[0].id;
  // Et nyt forsøg erstatter tidligere samtykker (ubekræftede, trukket tilbage eller fra før omlægningen).
  await db.query(`delete from samtykker where tilmeldt_id = $1`, [id]);
  await db.query(
    `insert into samtykker (tilmeldt_id, type, version, ordlyd, givet) values ($1, 'elpris', $2, $3, $4)`,
    [id, elpris.version, elpris.tekst, nu],
  );

  const link = `${ctx.appUrl}/bekraeft?token=${encodeURIComponent(token)}`;
  await sendBekraeftelse(afsender, id, input.email, bekraeftelsesmail({ email: input.email, link, appUrl: ctx.appUrl, samtykker: [elpris.tekst] }));
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
 * Stopper kun den daglige mail. Personen og samtykket bevares, så Dansk Folkeparti fortsat må sende politisk
 * information. Det første stoptidspunkt bevares. Kan gentages uden fejl. Fuld sletning sker kun på personens
 * udtrykkelige anmodning (se slet).
 */
export async function afmeld(db: Db, token: string, nu: Date): Promise<"ok" | "ugyldig"> {
  const id = laesAfmeldToken(token);
  if (!id) return "ugyldig";
  await db.query(
    `update tilmeldte set elpris_aktiv = false, elpris_stoppet = coalesce(elpris_stoppet, $2)
     where id = $1 and elpris_aktiv`,
    [id, nu.toISOString()],
  );
  return "ok";
}

/** Sletter personen helt på egen anmodning: tilmelding, samtykker, udsendelseslog og ratebegrænsning. */
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
 * Oprydning: ubekræftede tilmeldinger slettes efter 72 timer (de har aldrig givet et gyldigt samtykke),
 * ratebegrænsning efter et døgn og driftslog efter 180 dage. Personer, der har stoppet den daglige mail,
 * slettes aldrig automatisk: det sker kun på deres egen anmodning.
 */
export async function rydOp(db: Db, nu: Date): Promise<{ slettede: number }> {
  const slettede = await db.query(
    `delete from tilmeldte where status = 'afventer'
       and oprettet < $1::timestamptz - interval '${BEKRAEFT_TIMER} hours' returning id`,
    [nu.toISOString()],
  );
  await db.query(`delete from ratebegraensning where tidspunkt < $1::timestamptz - interval '1 day'`, [nu.toISOString()]);
  await db.query(`delete from driftslog where tidspunkt < $1::timestamptz - interval '180 days'`, [nu.toISOString()]);
  return { slettede: slettede.length };
}
