import { dagensGraenser } from "../tid";
import type { Dagsopsummering, Periode, Slot } from "./typer";

export const VINDUE_MINUTTER = 180;

/** Spotpris i DKK pr. MWh (som Energi Data Service angiver den) omregnet til øre pr. kWh. */
export function dkkMwhTilOereKwh(dkkPrMwh: number): number {
  return dkkPrMwh / 10;
}

export type Fuldstaendighed =
  | { fuld: true; minutter: number; antal: number }
  | { fuld: false; aarsag: string };

/**
 * Er hele døgnets datasæt til stede? Intervallerne skal følge lige efter hinanden fra dansk midnat til dansk
 * midnat uden huller og dobbeltrækker, og alle priser skal være endelige tal. Døgnet har 92, 96 eller 100
 * kvarterer (eller 23, 24 eller 25 timer), afhængigt af sommertid.
 */
export function erFuldDag(dato: string, slots: Slot[]): Fuldstaendighed {
  if (slots.length === 0) return { fuld: false, aarsag: "ingen priser" };
  const sorteret = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const minutter = sorteret[0].minutter;
  if (minutter !== 15 && minutter !== 60) return { fuld: false, aarsag: `uventet opløsning: ${minutter} minutter` };
  const { start, slut } = dagensGraenser(dato);
  let forventet = start.getTime();
  for (const s of sorteret) {
    if (s.minutter !== minutter) return { fuld: false, aarsag: "blandet opløsning i samme døgn" };
    if (!Number.isFinite(s.oerePrKwh)) return { fuld: false, aarsag: "pris er ikke et tal" };
    if (s.start.getTime() !== forventet) {
      return { fuld: false, aarsag: `hul eller dobbeltrække ved ${s.start.toISOString()}` };
    }
    forventet += minutter * 60_000;
  }
  if (forventet !== slut.getTime()) return { fuld: false, aarsag: "døgnet slutter for tidligt" };
  return { fuld: true, minutter, antal: sorteret.length };
}

/** Billigste og dyreste sammenhængende periode på præcis `vindueMinutter` (som standard tre timer). */
export function vinduer(slots: Slot[], vindueMinutter = VINDUE_MINUTTER): { billigste: Periode; dyreste: Periode } {
  const s = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const minutter = s[0]?.minutter;
  if (!minutter || vindueMinutter % minutter !== 0) throw new Error("Vinduet passer ikke til opløsningen");
  const n = vindueMinutter / minutter;
  if (s.length < n) throw new Error("For få intervaller til et vindue");
  let sum = 0;
  for (let i = 0; i < n; i++) sum += s[i].oerePrKwh;
  let bedst = { i: 0, sum };
  let vaerst = { i: 0, sum };
  for (let i = 1; i + n <= s.length; i++) {
    sum += s[i + n - 1].oerePrKwh - s[i - 1].oerePrKwh;
    // Ved lige pris vinder det tidligste vindue, så resultatet er entydigt.
    if (sum < bedst.sum - 1e-9) bedst = { i, sum };
    if (sum > vaerst.sum + 1e-9) vaerst = { i, sum };
  }
  const lav = (v: { i: number; sum: number }): Periode => ({
    start: s[v.i].start,
    slut: new Date(s[v.i + n - 1].start.getTime() + minutter * 60_000),
    gennemsnit: v.sum / n,
  });
  return { billigste: lav(bedst), dyreste: lav(vaerst) };
}

export function opsummer(dato: string, slots: Slot[]): Dagsopsummering {
  const f = erFuldDag(dato, slots);
  if (!f.fuld) throw new Error(`Døgnet ${dato} er ikke fuldstændigt: ${f.aarsag}`);
  const priser = slots.map((s) => s.oerePrKwh);
  const { billigste, dyreste } = vinduer(slots);
  return {
    dato,
    slots: slots.length,
    gennemsnit: priser.reduce((a, b) => a + b, 0) / priser.length,
    laveste: Math.min(...priser),
    hoeyeste: Math.max(...priser),
    billigste,
    dyreste,
    forskel: dyreste.gennemsnit - billigste.gennemsnit,
  };
}

/**
 * Hvad man teoretisk sparer på `kwh` kWh ved at flytte forbruget fra den dyreste til den billigste periode,
 * i kroner. Kun spotprisen indgår. Det er et regneeksempel, ikke en garanti for besparelsen på regningen.
 */
export function besparelseKr(d: Pick<Dagsopsummering, "forskel">, kwh: number): number {
  return (d.forskel * kwh) / 100;
}

/** Timegennemsnit (i lokal tid) til grafen. Kvarterer samles til hele timer; en time uden fulde data udelades ikke. */
export function timeserie(slots: Slot[]): { start: Date; oerePrKwh: number }[] {
  const pr = new Map<number, number[]>();
  for (const s of slots) {
    const time = Math.floor(s.start.getTime() / 3_600_000) * 3_600_000;
    pr.set(time, [...(pr.get(time) ?? []), s.oerePrKwh]);
  }
  return [...pr.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, p]) => ({ start: new Date(t), oerePrKwh: p.reduce((a, b) => a + b, 0) / p.length }));
}
