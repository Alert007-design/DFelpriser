import { createHash } from "node:crypto";
import { dagensGraenser, danskKlokkeslaet, laegDage } from "../tid";
import type { Omraade, Slot } from "../pris/typer";
import type { Priskilde } from "./typer";

/**
 * TESTDATA – IKKE RIGTIGE PRISER. Deterministiske, opdigtede priser med et realistisk forløb (billigt om
 * natten og midt på dagen, dyrt i aftenspidsen) til tests og udvikling. Bruges kun med PRISKILDE=test.
 * Systemet sender aldrig mails til rigtige modtagere med testdata (se udsendelse.ts).
 */
export const TESTKILDE_NAVN = "TESTDATA";

function tilfaeldig(frø: string): number {
  return createHash("sha256").update(frø).digest().readUInt32BE(0) / 0xffffffff;
}

function prisFor(omr: Omraade, start: Date): number {
  const { time, minut } = danskKlokkeslaet(start);
  const t = time + minut / 60;
  const dag = laegDage(start.toISOString().slice(0, 10), 0);
  const niveau = 60 + 50 * tilfaeldig(`niveau:${omr}:${Math.floor(start.getTime() / 86_400_000)}`);
  const aften = 60 * Math.exp(-(((t - 18.5) / 2) ** 2));
  const morgen = 25 * Math.exp(-(((t - 7.5) / 1.5) ** 2));
  const middag = -35 * Math.exp(-(((t - 13) / 2.5) ** 2));
  const stoej = 8 * (tilfaeldig(`stoej:${omr}:${start.getTime()}`) - 0.5);
  void dag;
  return Math.round((niveau + aften + morgen + middag + stoej + (omr === "DK2" ? 6 : 0)) * 10) / 10;
}

export function testKilde(): Priskilde {
  return {
    navn: TESTKILDE_NAVN,
    async hent(fra, til) {
      const ud: Record<Omraade, Slot[]> = { DK1: [], DK2: [] };
      for (let t = fra.getTime(); t < til.getTime(); t += 15 * 60_000) {
        const start = new Date(t);
        for (const omr of ["DK1", "DK2"] as const) ud[omr].push({ start, minutter: 15, oerePrKwh: prisFor(omr, start) });
      }
      return ud;
    },
  };
}

/** Hele døgnet som testdata (til tests). */
export async function testDag(omr: Omraade, dato: string): Promise<Slot[]> {
  const { start, slut } = dagensGraenser(dato);
  return (await testKilde().hent(start, slut))[omr];
}
