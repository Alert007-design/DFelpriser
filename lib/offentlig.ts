import { hentDb } from "./db";
import { priskilde } from "./config";
import { testDag } from "./kilder/test";
import { TESTKILDE_NAVN } from "./kilder/test";
import { opsummer, timeserie, erFuldDag } from "./pris/dag";
import { hentSlots } from "./pris/lager";
import type { Dagsopsummering, Omraade, Slot } from "./pris/typer";
import type { DagsPrognose } from "./prognose/prognose";
import { danskDato, laegDage } from "./tid";

export interface Dagsvisning {
  dato: string;
  opsummering: Dagsopsummering;
  serie: { start: Date; oerePrKwh: number }[];
  /** TESTDATA = opdigtede priser (kun i udvikling). */
  testdata: boolean;
}

async function slotsFor(omr: Omraade, dato: string): Promise<Slot[]> {
  if (process.env.DATABASE_URL) return hentSlots(hentDb(), omr, dato);
  // Uden database vises kun opdigtede testdata, og kun hvis PRISKILDE ikke er "live".
  return priskilde() === "live" ? [] : testDag(omr, dato);
}

/** Dagens og morgendagens kendte priser til hjemmesiden. Døgn uden fuldstændige data returneres ikke. */
export async function offentligeDage(omr: Omraade, nu: Date): Promise<{ idag: Dagsvisning | null; imorgen: Dagsvisning | null }> {
  const hent = async (dato: string): Promise<Dagsvisning | null> => {
    try {
      const slots = await slotsFor(omr, dato);
      if (!erFuldDag(dato, slots).fuld) return null;
      return { dato, opsummering: opsummer(dato, slots), serie: timeserie(slots), testdata: process.env.DATABASE_URL ? false : true };
    } catch {
      return null;
    }
  };
  const idag = danskDato(nu);
  return { idag: await hent(idag), imorgen: await hent(laegDage(idag, 1)) };
}

/** Seneste gemte prognoser, der ligger efter den seneste kendte dag. Tomt, hvis modellen ikke har bestået testen. */
export async function gemtePrognoser(omr: Omraade, nu: Date): Promise<DagsPrognose[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await hentDb().query<{ data: DagsPrognose }>(
      `select data from prognoser
       where omraade = $1 and for_dato > $2::date and kendt_til = (select max(kendt_til) from prognoser where omraade = $1)
       order by for_dato`,
      [omr, danskDato(nu)],
    );
    return rows.map((r) => r.data);
  } catch {
    return [];
  }
}

export { TESTKILDE_NAVN };
