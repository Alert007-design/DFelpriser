import { juraGodkendt } from "./config";
import type { Db } from "./db";
import { TESTKILDE_NAVN } from "./kilder/test";
import { erFuldDag, opsummer, VINDUE_MINUTTER } from "./pris/dag";
import { hentSlots } from "./pris/lager";
import { OMRAADER, type Omraade } from "./pris/typer";
import { dagensGraenser, danskDato, laegDage } from "./tid";

/**
 * Det, dfpriser.dk skal bruge til elopslaget på Facebook: morgendagens billigste periode for hvert område og status
 * for dagens udsendelse. Kun offentlige spotpriser og en status. Ingen oplysninger om personer.
 */
export interface OmraadeOpslagData {
  /** Er morgendagens døgn komplet (ingen huller)? Uden et komplet døgn gives ingen tal. */
  fuldstaendig: boolean;
  aarsag?: string;
  /** Bygger morgendagens priser på testdata? Så gives ingen tal. */
  testdata: boolean;
  /** Status for dagens udsendelse i området, eller "ingen", hvis der ikke er nogen række. */
  udsendelse: string;
  /** Billigste sammenhængende periode, samme som i mailen. Tidspunkter i UTC (ISO), pris i øre/kWh. */
  billigste: { start: string; slut: string; gennemsnitOere: number } | null;
}

/** Dagens tal til storyen på Mortens side (lørdag morgen). Samme regler som for morgendagen. */
export interface OmraadeDagData {
  fuldstaendig: boolean;
  testdata: boolean;
  billigste: { start: string; slut: string; gennemsnitOere: number } | null;
}

export interface OpslagData {
  dato: string;
  imorgen: string;
  /** Periodens længde i minutter (VINDUE_MINUTTER). */
  vindueMinutter: number;
  /** Er tilmeldingen åben (JURA_GODKENDT=ja)? Ellers må et opslag ikke invitere til den. */
  tilmeldingAaben: boolean;
  omraader: Record<Omraade, OmraadeOpslagData>;
  /** Dagens billigste periode for hvert område (priserne er kendt siden dagen før kl. 13). */
  idag: Record<Omraade, OmraadeDagData>;
}

async function dagData(db: Db, omr: Omraade, dag: string): Promise<OmraadeDagData> {
  const { start, slut } = dagensGraenser(dag);
  const slots = await hentSlots(db, omr, dag);
  const fuld = erFuldDag(dag, slots);
  const [{ n }] = await db.query<{ n: number }>(
    `select count(*)::int as n from spotpriser where omraade = $1 and start_utc >= $2 and start_utc < $3 and kilde = $4`,
    [omr, start.toISOString(), slut.toISOString(), TESTKILDE_NAVN],
  );
  const testdata = n > 0;
  let billigste: OmraadeDagData["billigste"] = null;
  if (fuld.fuld && !testdata) {
    const b = opsummer(dag, slots).billigste;
    billigste = { start: b.start.toISOString(), slut: b.slut.toISOString(), gennemsnitOere: b.gennemsnit };
  }
  return { fuldstaendig: fuld.fuld, testdata, billigste };
}

export async function opslagData(db: Db, nu: Date): Promise<OpslagData> {
  const dato = danskDato(nu);
  const imorgen = laegDage(dato, 1);
  const { start, slut } = dagensGraenser(imorgen);
  const omraader = {} as Record<Omraade, OmraadeOpslagData>;
  for (const omr of OMRAADER) {
    const slots = await hentSlots(db, omr, imorgen);
    const fuld = erFuldDag(imorgen, slots);
    const [{ n }] = await db.query<{ n: number }>(
      `select count(*)::int as n from spotpriser where omraade = $1 and start_utc >= $2 and start_utc < $3 and kilde = $4`,
      [omr, start.toISOString(), slut.toISOString(), TESTKILDE_NAVN],
    );
    const testdata = n > 0;
    const [u] = await db.query<{ status: string }>(`select status from udsendelser where dato = $1::date and omraade = $2`, [dato, omr]);
    let billigste: OmraadeOpslagData["billigste"] = null;
    if (fuld.fuld && !testdata) {
      const b = opsummer(imorgen, slots).billigste;
      billigste = { start: b.start.toISOString(), slut: b.slut.toISOString(), gennemsnitOere: b.gennemsnit };
    }
    omraader[omr] = {
      fuldstaendig: fuld.fuld,
      ...(fuld.fuld ? {} : { aarsag: fuld.aarsag }),
      testdata,
      udsendelse: u?.status ?? "ingen",
      billigste,
    };
  }
  const idag = {} as Record<Omraade, OmraadeDagData>;
  for (const omr of OMRAADER) idag[omr] = await dagData(db, omr, dato);
  return { dato, imorgen, vindueMinutter: VINDUE_MINUTTER, tilmeldingAaben: juraGodkendt(), omraader, idag };
}
