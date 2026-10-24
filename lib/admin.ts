import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "./db";
import { juraGodkendt, kraev, erOffentlig, priskilde, valgfri } from "./config";
import { erFuldDag } from "./pris/dag";
import { hentHistorik, hentSlots } from "./pris/lager";
import { OMRAADER, type Omraade } from "./pris/typer";
import { maaVisePrognose } from "./prognose/prognose";
import { middel } from "./prognose/model";
import { danskDato, laegDage } from "./tid";
import { laesPrognoseData } from "./offentlig";
import { FOERSTE_VERSION_MED_POLITIK_I_SAMTYKKET } from "./samtykke";

const COOKIE_SVAR = "admin";

/** Cookieværdi for en indlogget administrator: HMAC af adgangskoden, så selve adgangskoden aldrig ligger i cookien. */
export function adminCookieVaerdi(): string {
  return createHmac("sha256", kraev("TOKEN_HEMMELIGHED")).update(`${COOKIE_SVAR}:${kraev("ADMIN_PASSWORD")}`).digest("base64url");
}

export function erAdminCookie(vaerdi: string | undefined): boolean {
  if (!vaerdi || !valgfri("ADMIN_PASSWORD")) return false;
  const a = Buffer.from(vaerdi);
  const b = Buffer.from(adminCookieVaerdi());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminKodeRigtig(forsoeg: string): boolean {
  const pw = valgfri("ADMIN_PASSWORD");
  if (!pw) return false;
  const h = (s: string) => createHmac("sha256", "admin-login").update(s).digest();
  return timingSafeEqual(h(forsoeg), h(pw));
}

export const ADMIN_COOKIE = "df_elpriser_admin";

export interface Oversigt {
  nu: string;
  abonnenter: { aktive: number; faar_daglig_mail: number; stoppet: number; afventer: number; test: number; pr_omraade: Record<Omraade, number>; med_politisk_samtykke: number };
  priser: { omraade: Omraade; dato: string; fuld: boolean; aarsag?: string; dage_i_lager: number }[];
  udsendelser: { dato: string; omraade: string; status: string; sendt: number; fejlet: number; prognose: boolean; note: string | null }[];
  hentelog: { tidspunkt: string; kilde: string; omraade: string | null; status: string; antal: number; besked: string | null }[];
  driftslog: { tidspunkt: string; niveau: string; kilde: string; besked: string }[];
  prognoseStatus: { omraade: Omraade; tilladt: boolean; begrundelse: string; dage: number }[];
  opfoelgning: Opfoelgning[];
  indstillinger: { juraGodkendt: boolean; priskilde: string; offentlig: boolean; adminMailSat: boolean; budskabSat: boolean };
}

export interface Opfoelgning {
  omraade: string;
  for_dato: string;
  forudsagt_gennemsnit: number;
  faktisk_gennemsnit: number;
  fejl: number;
}

/** Stored prognoser sammenlignet med de faktiske priser, når de er kendt. Viser kun, hvad modellen faktisk har sagt. */
async function opfoelgning(db: Db): Promise<Opfoelgning[]> {
  const raa = await db.query<{ omraade: Omraade; for_dato: string; data: unknown }>(
    `select omraade, for_dato::text, data from prognoser order by for_dato desc limit 20`,
  );
  const rows = raa.flatMap((r) => {
    const data = laesPrognoseData(r.data);
    return data ? [{ ...r, data }] : [];
  });
  const ud: Opfoelgning[] = [];
  for (const r of rows) {
    const slots = await hentSlots(db, r.omraade, r.for_dato);
    if (!erFuldDag(r.for_dato, slots).fuld) continue;
    const faktisk = middel(slots.map((s) => s.oerePrKwh));
    ud.push({ omraade: r.omraade, for_dato: r.for_dato, forudsagt_gennemsnit: r.data.gennemsnit, faktisk_gennemsnit: faktisk, fejl: r.data.gennemsnit - faktisk });
  }
  return ud;
}

export async function adminOversigt(db: Db, nu: Date): Promise<Oversigt> {
  const dato = danskDato(nu);
  const imorgen = laegDage(dato, 1);
  const [t] = await db.query<Record<string, number>>(
    `select count(*) filter (where status = 'aktiv')::int as aktive,
            count(*) filter (where status = 'aktiv' and elpris_aktiv)::int as daglig,
            count(*) filter (where status = 'aktiv' and not elpris_aktiv)::int as stoppet,
            count(*) filter (where status = 'afventer')::int as afventer,
            count(*) filter (where test)::int as test,
            count(*) filter (where status = 'aktiv' and elpris_aktiv and omraade = 'DK1')::int as dk1,
            count(*) filter (where status = 'aktiv' and elpris_aktiv and omraade = 'DK2')::int as dk2,
            (select count(distinct x.id)::int from samtykker s join tilmeldte x on x.id = s.tilmeldt_id
              where x.status = 'aktiv' and s.status = 'aktiv'
                and ((s.type = 'elpris' and s.version >= $1) or s.type = 'politik')) as politik
     from tilmeldte`,
    [FOERSTE_VERSION_MED_POLITIK_I_SAMTYKKET],
  );
  const priser: Oversigt["priser"] = [];
  const prognoseStatus: Oversigt["prognoseStatus"] = [];
  for (const omr of OMRAADER) {
    const slots = await hentSlots(db, omr, imorgen);
    const f = erFuldDag(imorgen, slots);
    const historik = await hentHistorik(db, omr, imorgen, 130);
    priser.push({ omraade: omr, dato: imorgen, fuld: f.fuld, aarsag: f.fuld ? undefined : f.aarsag, dage_i_lager: historik.size });
    const g = maaVisePrognose(historik, imorgen);
    prognoseStatus.push({ omraade: omr, tilladt: g.tilladt, begrundelse: g.begrundelse, dage: historik.size });
  }
  const ts = (r: { tidspunkt: Date | string }) => new Date(r.tidspunkt).toISOString();
  return {
    nu: nu.toISOString(),
    abonnenter: {
      aktive: t.aktive,
      faar_daglig_mail: t.daglig,
      stoppet: t.stoppet,
      afventer: t.afventer,
      test: t.test,
      pr_omraade: { DK1: t.dk1, DK2: t.dk2 },
      med_politisk_samtykke: t.politik,
    },
    priser,
    udsendelser: await db.query(`select dato::text, omraade, status, sendt, fejlet, prognose, note from udsendelser order by dato desc, omraade limit 28`),
    hentelog: (await db.query<Oversigt["hentelog"][number] & { tidspunkt: Date }>(`select tidspunkt, kilde, omraade, status, antal, besked from hentelog order by tidspunkt desc limit 15`)).map((r) => ({ ...r, tidspunkt: ts(r) })),
    driftslog: (await db.query<Oversigt["driftslog"][number] & { tidspunkt: Date }>(`select tidspunkt, niveau, kilde, besked from driftslog order by tidspunkt desc limit 30`)).map((r) => ({ ...r, tidspunkt: ts(r) })),
    prognoseStatus,
    opfoelgning: await opfoelgning(db),
    indstillinger: {
      juraGodkendt: juraGodkendt(),
      priskilde: priskilde(),
      offentlig: erOffentlig(),
      adminMailSat: !!valgfri("ADMIN_EMAIL"),
      budskabSat: ((await db.query<{ vaerdi: string }>(`select vaerdi from indstillinger where noegle = 'df_budskab_tekst'`))[0]?.vaerdi ?? "").trim() !== "",
    },
  };
}
