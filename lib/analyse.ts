import { erFuldDag, opsummer } from "./pris/dag";
import { oere } from "./pris/format";
import type { Dagsopsummering, Omraade, Slot } from "./pris/typer";
import { bestaarKrav, tilbageskuendeTest, type Udfald } from "./prognose/evaluering";
import { lokalTimeprofil, type Historik } from "./prognose/model";
import { dagensGraenser, laegDage } from "./tid";

export type Dagsdata = Record<Omraade, Record<string, Slot[]>>;

const gns = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
function kvantil(v: number[], q: number): number {
  const s = [...v].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
}
const fordeling = (v: number[]) => ({ gennemsnit: gns(v), median: kvantil(v, 0.5), p10: kvantil(v, 0.1), p90: kvantil(v, 0.9), min: Math.min(...v), max: Math.max(...v) });

/** Overlapper to tidsrum? */
const overlap = (a: { start: Date; slut: Date }, b: { start: Date; slut: Date }) => a.start < b.slut && b.start < a.slut;

export interface Analyse {
  fra: string;
  til: string;
  dageIAlt: number;
  pr_omraade: Record<
    Omraade,
    {
      dage: number;
      /** 1. Hvor ofte skifter billigste tretimersvindue starttidspunkt fra dag til dag? */
      skifterStart: number;
      skifterHelt: number;
      /** 2. Forskel mellem dyreste og billigste periode (øre/kWh). */
      forskel: ReturnType<typeof fordeling>;
      /** 4. Besparelse i kr pr. dag ved at flytte 5, 10 og 20 kWh. */
      besparelse: Record<5 | 10 | 20, ReturnType<typeof fordeling>>;
      /** Dagens billigste vindue: gennemsnit af starttimen. */
      udfald: Record<1 | 2, Udfald | null>;
      krav: Record<1 | 2, { bestaaet: boolean; begrundelse: string }>;
    }
  >;
  /** 3. Andel dage, hvor DK1 og DK2 har forskellig billigste periode (andet starttidspunkt / uden overlap). */
  forskelligBilligstePeriode: { andetStart: number; udenOverlap: number; dage: number };
}

/**
 * Kun fuldstændige døgn indgår. Døgn med huller tælles ikke med og skjules ikke.
 * Med historikFra måles kun perioden fra–til, men modellen må bruge priser fra historikFra (fx vinteren alene,
 * hvor efteråret før er kendt historik). Uden historikFra bruges de første 28 dage af perioden som historik.
 */
export function analyser(data: Dagsdata, fra: string, til: string, historikFra?: string): Analyse {
  const dage: Record<Omraade, { dato: string; o: Dagsopsummering }[]> = { DK1: [], DK2: [] };
  const historik: Record<Omraade, Historik> = { DK1: new Map(), DK2: new Map() };
  for (const omr of ["DK1", "DK2"] as const) {
    for (let d = historikFra ?? fra; d <= til; d = laegDage(d, 1)) {
      const slots = data[omr][d] ?? [];
      if (!erFuldDag(d, slots).fuld) continue;
      if (d >= fra) dage[omr].push({ dato: d, o: opsummer(d, slots) });
      historik[omr].set(d, lokalTimeprofil(slots));
    }
  }
  const pr = {} as Analyse["pr_omraade"];
  for (const omr of ["DK1", "DK2"] as const) {
    const l = dage[omr];
    let skifter = 0;
    let helt = 0;
    let par = 0;
    for (let i = 1; i < l.length; i++) {
      if (l[i].dato !== laegDage(l[i - 1].dato, 1)) continue;
      par++;
      // Sammenlign klokkeslæt, ikke tidspunkt: forskyd gårsdagens vindue en dag frem.
      const g = l[i - 1].o.billigste;
      const forrige = { start: new Date(g.start.getTime() + 86_400_000), slut: new Date(g.slut.getTime() + 86_400_000) };
      if (Math.abs(forrige.start.getTime() - l[i].o.billigste.start.getTime()) > 60_000) skifter++;
      if (!overlap(forrige, l[i].o.billigste)) helt++;
    }
    const forskelle = l.map((x) => x.o.forskel);
    const udfald = {
      1: tilbageskuendeTest(historik[omr], historikFra ? fra : laegDage(fra, 28), laegDage(til, -1), 1),
      2: tilbageskuendeTest(historik[omr], historikFra ? fra : laegDage(fra, 28), laegDage(til, -2), 2),
    };
    pr[omr] = {
      dage: l.length,
      skifterStart: par ? skifter / par : NaN,
      skifterHelt: par ? helt / par : NaN,
      forskel: fordeling(forskelle),
      besparelse: { 5: fordeling(forskelle.map((f) => (f * 5) / 100)), 10: fordeling(forskelle.map((f) => (f * 10) / 100)), 20: fordeling(forskelle.map((f) => (f * 20) / 100)) },
      udfald,
      krav: { 1: bestaarKrav(udfald[1]), 2: bestaarKrav(udfald[2]) },
    };
  }
  let andetStart = 0;
  let udenOverlap = 0;
  let faelles = 0;
  const dk2 = new Map(dage.DK2.map((x) => [x.dato, x.o]));
  for (const { dato, o } of dage.DK1) {
    const b = dk2.get(dato);
    if (!b) continue;
    faelles++;
    if (o.billigste.start.getTime() !== b.billigste.start.getTime()) andetStart++;
    if (!overlap(o.billigste, b.billigste)) udenOverlap++;
  }
  return { fra, til, dageIAlt: dage.DK1.length, pr_omraade: pr, forskelligBilligstePeriode: { andetStart: faelles ? andetStart / faelles : NaN, udenOverlap: faelles ? udenOverlap / faelles : NaN, dage: faelles } };
}

const pct = (v: number) => (Number.isNaN(v) ? "–" : `${(v * 100).toFixed(0)} %`);
const kr = (v: number) => v.toFixed(2).replace(".", ",");

function maalLinje(navn: string, m: { dage: number; maeDagsgennemsnit: number; maeTime: number; fortrydelse: number; trefProcent: number }) {
  return `| ${navn} | ${m.dage} | ${oere(m.maeDagsgennemsnit)} | ${oere(m.maeTime)} | ${oere(m.fortrydelse)} | ${m.trefProcent.toFixed(0)} % |`;
}

export function rapport(a: Analyse, kilde: string): string {
  const l: string[] = [];
  l.push(`# Historisk analyse af spotpriser, ${a.fra} til ${a.til}`, "", `Kilde: ${kilde}. Kun døgn med fuldstændige data indgår (DK1: ${a.pr_omraade.DK1.dage}, DK2: ${a.pr_omraade.DK2.dage}). Alle priser er spotpriser i øre/kWh før moms, afgifter og tariffer. Besparelser er teoretiske og bygger kun på spotprisen.`, "");
  for (const omr of ["DK1", "DK2"] as const) {
    const p = a.pr_omraade[omr];
    l.push(`## ${omr}`, "");
    l.push(`1. **Skift af billigste tretimersperiode fra dag til dag:** starttidspunktet er et andet i ${pct(p.skifterStart)} af dagene, og perioden ligger helt uden overlap med gårsdagens i ${pct(p.skifterHelt)}.`);
    const f = p.forskel;
    l.push(`2. **Forskel mellem dagens dyreste og billigste periode (øre/kWh):** gennemsnit ${oere(f.gennemsnit)}, median ${oere(f.median)}, 10-90 %: ${oere(f.p10)} til ${oere(f.p90)}, mindst ${oere(f.min)}, mest ${oere(f.max)}.`);
    l.push("4. **Teoretisk besparelse pr. dag ved at flytte forbrug fra dyreste til billigste periode (kr):**", "", "| Flyttet forbrug | Gennemsnit | Median | 10 % | 90 % |", "|---|---|---|---|---|");
    for (const k of [5, 10, 20] as const) {
      const b = p.besparelse[k];
      l.push(`| ${k} kWh | ${kr(b.gennemsnit)} | ${kr(b.median)} | ${kr(b.p10)} | ${kr(b.p90)} |`);
    }
    l.push("", "5. **Prognosens præcision** (tilbageskuende test, kun data kendt på det tidspunkt):", "", "| Metode | Dage | Fejl dagsgns. (øre) | Fejl pr. time (øre) | Fortrydelse billigste vindue (øre) | Træf billigste vindue (≥2 af 3 timer) |", "|---|---|---|---|---|---|");
    for (const h of [1, 2] as const) {
      const u = p.udfald[h];
      if (!u) {
        l.push(`| Dag ${h + 1}: ingen målinger | | | | | |`);
        continue;
      }
      l.push(maalLinje(`Dag ${h + 1}: model`, u.model), maalLinje(`Dag ${h + 1}: gentag sidste dag`, u.naivSidsteDag), maalLinje(`Dag ${h + 1}: samme ugedag sidste uge`, u.naivSidsteUge));
    }
    l.push("", `Prognosen må vises (dag 2): ${p.krav[1].bestaaet ? "ja" : "nej"} – ${p.krav[1].begrundelse}. Dag 3: ${p.krav[2].bestaaet ? "ja" : "nej"} – ${p.krav[2].begrundelse}.`, "");
  }
  const x = a.forskelligBilligstePeriode;
  l.push("## DK1 mod DK2", "", `3. På ${x.dage} fælles døgn har DK1 og DK2 et forskelligt starttidspunkt for billigste tretimersperiode i ${pct(x.andetStart)} af dagene, og perioderne har slet ingen overlap i ${pct(x.udenOverlap)}.`, "");
  return l.join("\n");
}

export { dagensGraenser };
