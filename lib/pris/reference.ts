import { laegDage } from "../tid";
import { middel, type Historik, type Timeprofil } from "../prognose/model";

/** Et tidsrum i lokale hele timer. slutTime kan være 24 (midnat). */
export interface Tidsrum {
  startTime: number;
  slutTime: number;
}

export interface TypiskeTider {
  /** Antal fuldstændige dage, gennemsnittet bygger på. */
  dage: number;
  /** Et eller to billige tidsrum i tidsorden. */
  billigste: Tidsrum[];
  dyreste: Tidsrum;
}

export const REFERENCE_DAGE = 14;
export const MINDSTE_ANTAL_DAGE = 7;
const TIMER = 3;

function vindueGns(profil: Timeprofil, start: number): number {
  return middel(profil.slice(start, start + TIMER));
}

/**
 * Hvornår strømmen i gennemsnit har været billigst og dyrest de seneste `dage` dage til og med `tilDato`.
 * Historiske tal, ikke en prognose. Et andet billigt tidsrum nævnes kun, når det er adskilt fra det første
 * af dyrere timer og næsten lige så billigt. Giver null med færre end 7 fuldstændige dage.
 */
export function typiskeTider(historik: Historik, tilDato: string, dage = REFERENCE_DAGE): TypiskeTider | null {
  const profiler: Timeprofil[] = [];
  for (let i = 0; i < dage; i++) {
    const p = historik.get(laegDage(tilDato, -i));
    if (p) profiler.push(p);
  }
  if (profiler.length < MINDSTE_ANTAL_DAGE) return null;
  const gns = Array.from({ length: 24 }, (_, t) => middel(profiler.map((p) => p[t])));

  const starter = Array.from({ length: 24 - TIMER + 1 }, (_, s) => s);
  const billig = starter.reduce((b, s) => (vindueGns(gns, s) < vindueGns(gns, b) - 1e-9 ? s : b), 0);
  const dyr = starter.reduce((b, s) => (vindueGns(gns, s) > vindueGns(gns, b) + 1e-9 ? s : b), 0);
  const spaend = vindueGns(gns, dyr) - vindueGns(gns, billig);

  const billigste: Tidsrum[] = [{ startTime: billig, slutTime: billig + TIMER }];
  if (spaend > 0) {
    // Andet tidsrum: mindst to timers afstand til det første og højst 15 % af spændet dyrere.
    const kandidater = starter.filter((s) => s + TIMER + 2 <= billig || s >= billig + TIMER + 2);
    let anden: number | null = null;
    for (const s of kandidater) {
      if (anden === null || vindueGns(gns, s) < vindueGns(gns, anden) - 1e-9) anden = s;
    }
    if (anden !== null && vindueGns(gns, anden) - vindueGns(gns, billig) <= 0.15 * spaend) {
      // Der skal være en tydelig top imellem, ellers er det samme dal.
      const fra = Math.min(billig, anden) + TIMER;
      const til = Math.max(billig, anden);
      const top = Math.max(...gns.slice(fra, til));
      if (top - vindueGns(gns, anden) >= 0.25 * spaend) {
        billigste.push({ startTime: anden, slutTime: anden + TIMER });
        billigste.sort((a, b) => a.startTime - b.startTime);
      }
    }
  }
  return { dage: profiler.length, billigste, dyreste: { startTime: dyr, slutTime: dyr + TIMER } };
}

/** "kl. 2–5" */
export function tidsrumTekst(t: Tidsrum): string {
  return `kl. ${t.startTime}–${t.slutTime}`;
}
