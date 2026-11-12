import type { Db } from "./db";

/**
 * Overførsel af bekræftede tilmeldte til Dansk Folkepartis nyhedsbrevssystem, Klaviyo (godkendt af Morten 9/11-2026).
 *
 * Slået fra, medmindre både KLAVIYO_API_KEY og KLAVIYO_LIST_ID er sat. En fejl hos Klaviyo stopper aldrig en
 * bekræftelse, et skift af postnummer eller en sletning: den logges, og overførslen prøves igen hver time.
 * Kun navn (fra 12/11-2026, når det findes), e-mailadresse, postnummer (Location og Zipcode) og "Pris emne" sendes. Nøglen står aldrig i koden, i logs
 * eller i fejlbeskeder, og e-mailadressen logges aldrig.
 *
 * Kun personer, der gav samtykke på eller efter KLAVIYO_FRA, overføres: før den dag lovede privatlivspolitikken,
 * at intet blev overført. STOP af den daglige mail ændrer intet i Klaviyo, fordi samtykket til politisk
 * information gælder fortsat. Ved sletning fjernes EL priser fra "Pris emne"; står der ikke andet, fjernes også
 * Zipcode, fornavn og efternavn, og personen tages af listen. Selve profilen slettes ikke, fordi den kan stamme fra
 * andre DF-tjenester. Mangler navnet (tilmeldt før 12/11-2026), sendes navnefelterne ikke, så et navn fra fx
 * benzinpriserne ikke overskrives.
 */

/** Hvornår den nye privatlivspolitik gælder fra. Samme dato står i privatlivspolitikken. */
export const KLAVIYO_FRA = new Date("2026-11-10T00:00:00+01:00");

export const EL_PRISER = "EL priser";
const PRIS_EMNE = "Pris emne";
const ZIPCODE = "Zipcode";

const URL_ = "https://a.klaviyo.com";
const REVISION = "2026-07-15";
const TIMEOUT_MS = 8_000;
const KILDE = "dfpriser.dk/el";

export class KlaviyoFejl extends Error {
  constructor(
    besked: string,
    readonly status?: number,
  ) {
    super(besked);
  }
}

export interface Navn {
  fornavn: string;
  efternavn: string;
}

export interface Profil {
  id: string;
  prisEmne: string[];
}

export interface KlaviyoKlient {
  hentProfil(email: string): Promise<Profil | null>;
  /** Opretter eller opdaterer profilen. Kun de egne felter, der sendes med, ændres. */
  importer(p: { email: string; postnummer: string; prisEmne?: string[]; navn?: Navn | null }): Promise<void>;
  abonner(email: string): Promise<void>;
  saetPrisEmne(id: string, prisEmne: string[]): Promise<void>;
  /** Fjerner egne felter og, med `navn`, også fornavn og efternavn. */
  fjernFelter(id: string, felter: string[], o?: { navn?: boolean }): Promise<void>;
  fjernFraListe(id: string): Promise<void>;
}

export interface Afhaengigheder {
  klient: KlaviyoKlient | null;
  sov?: (ms: number) => Promise<void>;
  /** Pauser mellem forsøg. Standard: ét nyt forsøg efter 500 ms. */
  pauser?: number[];
}

const sovStandard = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** "Pris emne" som liste, uanset om Klaviyo har den som liste eller som tekst. */
function somListe(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

/** Klienten, hvis både nøgle og liste er sat; ellers null (overførsel slået fra). */
export function klaviyoKlient(fetchFn: typeof fetch = fetch): KlaviyoKlient | null {
  const noegle = (process.env.KLAVIYO_API_KEY ?? "").trim();
  const liste = (process.env.KLAVIYO_LIST_ID ?? "").trim();
  if (!noegle || !liste) return null;

  async function kald(metode: string, sti: string, body?: unknown): Promise<unknown> {
    const svar = await fetchFn(`${URL_}${sti}`, {
      method: metode,
      headers: {
        Authorization: `Klaviyo-API-Key ${noegle}`,
        accept: "application/vnd.api+json",
        "content-type": "application/vnd.api+json",
        revision: REVISION,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Svarlegemet tages ikke med i fejlen: det kan indeholde e-mailadressen.
    if (!svar.ok) throw new KlaviyoFejl(`Klaviyo ${metode} ${sti.split("?")[0]} svarede HTTP ${svar.status}`, svar.status);
    if (metode !== "GET") return null;
    const tekst = await svar.text();
    return tekst ? JSON.parse(tekst) : null;
  }

  return {
    async hentProfil(email) {
      const filter = encodeURIComponent(`equals(email,"${email.replace(/"/g, "")}")`);
      const r = (await kald("GET", `/api/profiles?filter=${filter}&fields[profile]=email,properties`)) as {
        data?: { id: string; attributes?: { properties?: Record<string, unknown> } }[];
      } | null;
      const p = r?.data?.[0];
      return p ? { id: p.id, prisEmne: somListe(p.attributes?.properties?.[PRIS_EMNE]) } : null;
    },
    async importer({ email, postnummer, prisEmne, navn }) {
      const properties: Record<string, unknown> = { [ZIPCODE]: postnummer };
      if (prisEmne) properties[PRIS_EMNE] = prisEmne;
      const attributes: Record<string, unknown> = { email };
      if (navn) {
        attributes.first_name = navn.fornavn;
        attributes.last_name = navn.efternavn;
      }
      attributes.location = { zip: postnummer };
      attributes.properties = properties;
      await kald("POST", "/api/profile-import", { data: { type: "profile", attributes } });
    },
    async abonner(email) {
      await kald("POST", "/api/profile-subscription-bulk-create-jobs", {
        data: {
          type: "profile-subscription-bulk-create-job",
          attributes: {
            custom_source: KILDE,
            profiles: {
              data: [{ type: "profile", attributes: { email, subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } } } }],
            },
          },
          relationships: { list: { data: { type: "list", id: liste } } },
        },
      });
    },
    async saetPrisEmne(id, prisEmne) {
      await kald("PATCH", `/api/profiles/${id}`, { data: { type: "profile", id, attributes: { properties: { [PRIS_EMNE]: prisEmne } } } });
    },
    async fjernFelter(id, felter, o) {
      // null fjerner et standardfelt i Klaviyo; egne felter fjernes med unset.
      const attributes = o?.navn ? { first_name: null, last_name: null } : {};
      await kald("PATCH", `/api/profiles/${id}`, { data: { type: "profile", id, attributes, meta: { patch_properties: { unset: felter } } } });
    },
    async fjernFraListe(id) {
      await kald("DELETE", `/api/lists/${liste}/relationships/profiles`, { data: [{ type: "profile", id }] });
    },
  };
}

function kanGenproeves(e: unknown): boolean {
  if (e instanceof KlaviyoFejl) return e.status === undefined || e.status === 429 || e.status >= 500;
  return true; // netværksfejl og timeout
}

async function medForsoeg<T>(fn: () => Promise<T>, afh: Afhaengigheder): Promise<T> {
  const pauser = afh.pauser ?? [500];
  const sov = afh.sov ?? sovStandard;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= pauser.length || !kanGenproeves(e)) throw e;
      await sov(pauser[i]);
    }
  }
}

const fejltekst = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Udvælgelsen: bekræftet (status aktiv), ikke test, ikke allerede overført, og et aktivt elpris-samtykke version 2
 * eller nyere (dækker politisk information), givet på eller efter KLAVIYO_FRA ($1).
 */
const UDVALG = `
  from tilmeldte t
  where t.status = 'aktiv' and t.bekraeftet_tidspunkt is not null and t.test = false
    and t.klaviyo_overfoert is null
    and exists (select 1 from samtykker s
                where s.tilmeldt_id = t.id and s.type = 'elpris' and s.status = 'aktiv' and s.version >= 2
                  and s.givet >= $1::timestamptz)`;

export type Udfald = "overfoert" | "fejlet" | "ikke_udvalgt" | "slaaet_fra";

interface Udvalgt {
  id: string;
  email: string;
  postnummer: string;
  fornavn: string | null;
  efternavn: string | null;
}

async function overfoerPerson(db: Db, klient: KlaviyoKlient, afh: Afhaengigheder, p: Udvalgt, nu: Date) {
  try {
    // Kan profilen ikke slås op, sendes EL priser alene, så overførslen ikke går i stå.
    const profil = await medForsoeg(() => klient.hentProfil(p.email), afh).catch((e) => {
      console.error("Klaviyo: profilen kunne ikke slås op; Pris emne sendes uden eksisterende værdier", p.id, fejltekst(e));
      return null;
    });
    const prisEmne = profil?.prisEmne ?? [];
    if (!prisEmne.includes(EL_PRISER)) prisEmne.push(EL_PRISER);
    const navn = p.fornavn && p.efternavn ? { fornavn: p.fornavn, efternavn: p.efternavn } : null;
    await medForsoeg(() => klient.importer({ email: p.email, postnummer: p.postnummer, prisEmne, navn }), afh);
    await medForsoeg(() => klient.abonner(p.email), afh);
  } catch (e) {
    console.error("Klaviyo-overførsel fejlede", p.id, fejltekst(e));
    await db.query(`update tilmeldte set klaviyo_fejlet = $2 where id = $1`, [p.id, nu.toISOString()]).catch(() => {});
    return "fejlet" as const;
  }
  await db.query(`update tilmeldte set klaviyo_overfoert = $2, klaviyo_fejlet = null where id = $1`, [p.id, nu.toISOString()]);
  return "overfoert" as const;
}

/** Overfører én person, hvis vedkommende er udvalgt. Kaldes efter bekræftelsen. Kaster aldrig. */
export async function overfoerEn(
  db: Db,
  id: string,
  afh: Afhaengigheder = { klient: klaviyoKlient() },
  nu: Date = new Date(),
  fra: Date = KLAVIYO_FRA,
): Promise<Udfald> {
  if (!afh.klient) return "slaaet_fra";
  try {
    const [p] = await db.query<Udvalgt>(
      `select t.id, t.email, t.postnummer, t.fornavn, t.efternavn ${UDVALG} and t.id = $2`,
      [fra.toISOString(), id],
    );
    if (!p) return "ikke_udvalgt";
    return await overfoerPerson(db, afh.klient, afh, p, nu);
  } catch (e) {
    console.error("Klaviyo-overførsel fejlede", id, fejltekst(e));
    return "fejlet";
  }
}

/** Hver time: overfør udvalgte, der endnu ikke er overført (også efter fejl). Stopper ved første fejl. Kaster aldrig. */
export async function overfoerManglende(
  db: Db,
  afh: Afhaengigheder = { klient: klaviyoKlient() },
  nu: Date = new Date(),
  { fra = KLAVIYO_FRA, maks = 50 }: { fra?: Date; maks?: number } = {},
): Promise<{ overfoert: number; fejlet: number }> {
  const res = { overfoert: 0, fejlet: 0 };
  if (!afh.klient) return res;
  try {
    const rows = await db.query<Udvalgt>(
      `select t.id, t.email, t.postnummer, t.fornavn, t.efternavn ${UDVALG} order by t.klaviyo_fejlet nulls first, t.bekraeftet_tidspunkt limit $2`,
      [fra.toISOString(), maks],
    );
    for (const p of rows) {
      if ((await overfoerPerson(db, afh.klient, afh, p, nu)) === "fejlet") {
        res.fejlet++;
        break;
      }
      res.overfoert++;
    }
  } catch (e) {
    console.error("Klaviyo: den timelige overførsel fejlede", fejltekst(e));
    res.fejlet++;
  }
  return res;
}

/** Oplysningerne, skift af postnummer og sletning giver videre. `overfoert` er sand, hvis personen er i Klaviyo. */
export interface EfterAendring {
  email: string;
  postnummer: string;
  overfoert: boolean;
}

/** Efter skift af postnummer: send det nye postnummer, hvis personen er overført. Rører ikke "Pris emne". Kaster aldrig. */
export async function postnummerTilKlaviyo(p: EfterAendring, afh: Afhaengigheder = { klient: klaviyoKlient() }): Promise<void> {
  const klient = afh.klient;
  if (!klient || !p.overfoert) return;
  try {
    await medForsoeg(() => klient.importer({ email: p.email, postnummer: p.postnummer }), afh);
  } catch (e) {
    console.error("Klaviyo: nyt postnummer kunne ikke sendes", fejltekst(e));
  }
}

/** Efter sletning: fjern EL priser, og står der ikke andet, også Zipcode, navnet og listen. Kaster aldrig. */
export async function sletIKlaviyo(p: EfterAendring, afh: Afhaengigheder = { klient: klaviyoKlient() }): Promise<void> {
  const klient = afh.klient;
  if (!klient || !p.overfoert) return;
  try {
    const profil = await medForsoeg(() => klient.hentProfil(p.email), afh);
    if (!profil) return;
    const rest = profil.prisEmne.filter((v) => v !== EL_PRISER);
    if (rest.length > 0) {
      await medForsoeg(() => klient.saetPrisEmne(profil.id, rest), afh);
      return;
    }
    await medForsoeg(() => klient.fjernFelter(profil.id, [PRIS_EMNE, ZIPCODE], { navn: true }), afh);
    await medForsoeg(() => klient.fjernFraListe(profil.id), afh);
  } catch (e) {
    // Sletningen hos os er gennemført. Logges uden e-mailadresse, så den kan klares manuelt.
    console.error("Klaviyo: sletning fejlede – skal klares manuelt i Klaviyo", fejltekst(e));
  }
}
