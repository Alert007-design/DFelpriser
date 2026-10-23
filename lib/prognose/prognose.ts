import { laegDage } from "../tid";
import { bestaarKrav, tilbageskuendeTest, type Udfald } from "./evaluering";
import { billigsteVindue, forudsig, MODEL_VERSION, middel, type Historik, type Timeprofil } from "./model";

export type Usikkerhed = "lav" | "middel" | "hoej";

export interface DagsPrognose {
  dato: string;
  /** 1 = dagen efter den kendte dag (dag 2 efter udsendelsen), 2 = dag 3. */
  horisont: 1 | 2;
  profil: Timeprofil;
  gennemsnit: number;
  /** 80 %-interval for dagens gennemsnitspris ud fra modellens egne fejl de seneste dage. */
  gennemsnitInterval: { lav: number; hoej: number };
  /** Laveste og højeste timepris i prognosen. */
  laveste: number;
  hoeyeste: number;
  billigste: { startTime: number; slutTime: number; gennemsnit: number };
  /** I 90 % af de seneste prognoser lå den faktiske timepris højst så langt fra prognosen (øre/kWh). */
  timeAfvigelse: number;
  usikkerhed: Usikkerhed;
}

export interface Prognose {
  modelVersion: string;
  kendtTil: string;
  dage: DagsPrognose[];
}

function kvantil(sorteret: number[], q: number): number {
  const i = (sorteret.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorteret[lo] + (sorteret[hi] - sorteret[lo]) * (i - lo);
}

const RESIDUAL_DAGE = 60;
const MIN_RESIDUALER = 20;

/**
 * Prognosens fejl de seneste dage, målt ved at køre modellen, som den ville have kørt dengang (kun med data
 * kendt på det tidspunkt). Bruges til at angive usikkerheden. Returnerer null, hvis der ikke er nok.
 */
function seneseFejl(historik: Historik, kendtTil: string, horisont: 1 | 2) {
  const middelFejl: number[] = [];
  const timeFejl: number[] = [];
  for (let i = 0; i < RESIDUAL_DAGE; i++) {
    // Målet skal være kendt, dvs. højst den seneste kendte dag.
    const k = laegDage(kendtTil, -(horisont + i));
    const maal = laegDage(k, horisont);
    const fakta = historik.get(maal);
    const p = forudsig(historik, k, maal);
    if (!fakta || !p) continue;
    middelFejl.push(middel(fakta) - middel(p));
    for (let t = 0; t < 24; t++) timeFejl.push(Math.abs(fakta[t] - p[t]));
  }
  if (middelFejl.length < MIN_RESIDUALER) return null;
  return { middelFejl: middelFejl.sort((a, b) => a - b), timeFejl: timeFejl.sort((a, b) => a - b) };
}

/**
 * Prognose for de to dage efter `kendtTil` (seneste dag med kendte priser). Giver null, hvis modellen ikke
 * har data nok til at beregne både prognose og usikkerhed. Der gættes aldrig.
 */
export function lavPrognose(historik: Historik, kendtTil: string): Prognose | null {
  const dage: DagsPrognose[] = [];
  for (const horisont of [1, 2] as const) {
    const dato = laegDage(kendtTil, horisont);
    const profil = forudsig(historik, kendtTil, dato);
    const fejl = seneseFejl(historik, kendtTil, horisont);
    if (!profil || !fejl) return null;
    const gennemsnit = middel(profil);
    const v = billigsteVindue(profil);
    const dyrest = Math.max(...Array.from({ length: 22 }, (_, s) => middel(profil.slice(s, s + 3))));
    const spredning = dyrest - v.gennemsnit;
    const afvigelse = kvantil(fejl.timeFejl, 0.9);
    const forhold = spredning > 0 ? afvigelse / spredning : Infinity;
    dage.push({
      dato,
      horisont,
      profil,
      gennemsnit,
      gennemsnitInterval: {
        lav: gennemsnit + kvantil(fejl.middelFejl, 0.1),
        hoej: gennemsnit + kvantil(fejl.middelFejl, 0.9),
      },
      laveste: Math.min(...profil),
      hoeyeste: Math.max(...profil),
      billigste: { startTime: v.start, slutTime: v.start + 3, gennemsnit: v.gennemsnit },
      timeAfvigelse: afvigelse,
      usikkerhed: forhold < 0.5 ? "lav" : forhold < 1 ? "middel" : "hoej",
    });
  }
  return { modelVersion: MODEL_VERSION, kendtTil, dage };
}

/**
 * Må prognosen vises? Kun hvis modellen i en tilbageskuende test på de seneste 90 dage har slået begge enkle
 * metoder tydeligt for begge horisonter (se KRAV i evaluering.ts).
 */
export function maaVisePrognose(historik: Historik, kendtTil: string): { tilladt: boolean; begrundelse: string; udfald: Record<1 | 2, Udfald | null> } {
  const fra = laegDage(kendtTil, -90);
  const til = laegDage(kendtTil, -2);
  const udfald = { 1: tilbageskuendeTest(historik, fra, til, 1), 2: tilbageskuendeTest(historik, fra, til, 2) };
  for (const h of [1, 2] as const) {
    const k = bestaarKrav(udfald[h]);
    if (!k.bestaaet) return { tilladt: false, begrundelse: `horisont ${h}: ${k.begrundelse}`, udfald };
  }
  return { tilladt: true, begrundelse: "modellen slår begge enkle metoder for begge horisonter", udfald };
}

export type Vurdering =
  | { type: "billigst"; dato: string; sikker: boolean }
  | { type: "taet_loeb"; datoer: string[] };

/**
 * Hvilken af de tre dage forventes billigst (på gennemsnitspris)? Det siges kun, når forskellen til nummer to
 * er større end prognosens usikkerhed på de forudsagte dage; ellers er det "tæt løb".
 * `kendt` er morgendagens kendte gennemsnit; prognosedagene bruger deres 80 %-interval.
 */
export function vurderBilligsteDag(kendt: { dato: string; gennemsnit: number }, prog: DagsPrognose[]): Vurdering {
  const kandidater = [
    { dato: kendt.dato, lav: kendt.gennemsnit, hoej: kendt.gennemsnit, mid: kendt.gennemsnit },
    ...prog.map((p) => ({ dato: p.dato, lav: p.gennemsnitInterval.lav, hoej: p.gennemsnitInterval.hoej, mid: p.gennemsnit })),
  ].sort((a, b) => a.mid - b.mid);
  const foerst = kandidater[0];
  // Sikker, hvis førstepladsens øvre grænse ligger under alle andres nedre grænse.
  const sikker = kandidater.slice(1).every((k) => foerst.hoej < k.lav);
  if (sikker) return { type: "billigst", dato: foerst.dato, sikker: true };
  const taet = kandidater.filter((k) => k.lav <= foerst.hoej);
  return { type: "taet_loeb", datoer: taet.map((k) => k.dato).sort() };
}
