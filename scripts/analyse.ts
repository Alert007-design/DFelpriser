// Historisk analyse af mindst 90 dages spotpriser for DK1 og DK2 (punkt 8 i opgaven).
// Kræver adgang til api.energidataservice.dk.
// Brug: npm run analyse -- [antal dage, standard 120]
//   eller: npm run analyse -- <fra> <til> [<delperiode-fra> <delperiode-til>]   (datoer som ÅÅÅÅ-MM-DD)
// Med en delperiode (fx 2025-12-01 2026-02-28) hentes hele fra–til, men målingerne laves kun for delperioden;
// priserne før delperioden bruges som historik for modellen.
// Skriver docs/analyse-<dato>.md og lægger de hentede priser i data/cache/ (genbruges ved næste kørsel).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { analyser, rapport, type Dagsdata } from "../lib/analyse";
import { energiDataService } from "../lib/kilder/energidataservice";
import { dagensGraenser, danskDato, laegDage } from "../lib/tid";
import type { Slot } from "../lib/pris/typer";

const erDato = (v?: string) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");
const [a1, a2, a3, a4] = process.argv.slice(2);
const datoer = erDato(a1) && erDato(a2);
const til = datoer ? a2 : laegDage(danskDato(new Date()), -1);
const fra = datoer ? a1 : laegDage(til, -(Number(a1 ?? 120) - 1));
const delperiode = datoer && erDato(a3) && erDato(a4) ? { fra: a3, til: a4 } : null;
const kilde = energiDataService();
mkdirSync("data/cache", { recursive: true });

const data: Dagsdata = { DK1: {}, DK2: {} };
for (let d = fra; d <= til; d = laegDage(d, 30)) {
  const slut = laegDage(d, 29) < til ? laegDage(d, 29) : til;
  const fil = `data/cache/${d}_${slut}.json`;
  let blok: Record<"DK1" | "DK2", { start: string; minutter: number; oerePrKwh: number }[]>;
  if (existsSync(fil)) blok = JSON.parse(readFileSync(fil, "utf8"));
  else {
    const r = await kilde.hent(dagensGraenser(d).start, dagensGraenser(slut).slut);
    blok = { DK1: r.DK1.map((s) => ({ ...s, start: s.start.toISOString() })), DK2: r.DK2.map((s) => ({ ...s, start: s.start.toISOString() })) };
    writeFileSync(fil, JSON.stringify(blok));
  }
  for (const omr of ["DK1", "DK2"] as const) {
    for (let dd = d; dd <= slut; dd = laegDage(dd, 1)) {
      const g = dagensGraenser(dd);
      data[omr][dd] = blok[omr].map((s): Slot => ({ ...s, start: new Date(s.start) })).filter((s) => s.start >= g.start && s.start < g.slut);
    }
  }
}
const a = delperiode ? analyser(data, delperiode.fra, delperiode.til, fra) : analyser(data, fra, til);
const ud = delperiode ? `docs/analyse-${delperiode.fra}_${delperiode.til}.md` : `docs/analyse-${fra}_${til}.md`;
writeFileSync(ud, rapport(a, kilde.navn));
console.log(`Skrev ${ud}`);
