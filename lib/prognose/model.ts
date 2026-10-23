import { danskKlokkeslaet, erWeekend, laegDage } from "../tid";
import type { Slot } from "../pris/typer";
import { erHelligdag } from "./kalender";

export const MODEL_VERSION = "profil-v1";

/** Døgnets 24 lokale timer (øre/kWh). Sommer- og vintertid jævnes ud, så hver dag har præcis 24 værdier. */
export type Timeprofil = number[];

export function lokalTimeprofil(slots: Slot[]): Timeprofil {
  const pr: number[][] = Array.from({ length: 24 }, () => []);
  for (const s of slots) pr[danskKlokkeslaet(s.start).time].push(s.oerePrKwh);
  const profil = pr.map((p) => (p.length ? p.reduce((a, b) => a + b, 0) / p.length : NaN));
  // Den time, der mangler om foråret (kl. 02), udfyldes som gennemsnittet af nabotimerne.
  for (let t = 0; t < 24; t++) {
    if (Number.isNaN(profil[t])) {
      const naboer = [profil[t - 1], profil[t + 1]].filter((v) => v !== undefined && !Number.isNaN(v));
      if (naboer.length === 0) throw new Error("For få timer til en profil");
      profil[t] = naboer.reduce((a, b) => a + b, 0) / naboer.length;
    }
  }
  return profil;
}

export type Historik = Map<string, Timeprofil>;

const gns = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const fridag = (d: string) => erWeekend(d) || erHelligdag(d);

export interface ModelIndstillinger {
  /** Antal dage af samme dagtype, formen (døgnets forløb) hentes fra. */
  formDage: number;
  /** Andel af niveauet, der bygger på seneste kendte dag (resten er 7-dages gennemsnit). */
  niveauVaegt: number;
  minDage: number;
}
export const STANDARD: ModelIndstillinger = { formDage: 28, niveauVaegt: 0.5, minDage: 21 };

/**
 * Prognose for `maal` ud fra priser kendt til og med `kendtTil`. Døgnets niveau er et vejet gennemsnit af
 * seneste kendte dag og de seneste 7 dage. Forløbet over døgnet (afvigelse fra dagsgennemsnittet) er
 * gennemsnittet af de seneste dage af samme type (hverdag eller fridag). Returnerer null, hvis der ikke er
 * dage nok: modellen gætter ikke.
 */
export function forudsig(
  historik: Historik,
  kendtTil: string,
  maal: string,
  opt: ModelIndstillinger = STANDARD,
): Timeprofil | null {
  const dage: string[] = [];
  for (let d = kendtTil, i = 0; i < 120; d = laegDage(d, -1), i++) {
    if (historik.has(d)) dage.push(d);
  }
  if (dage.length < opt.minDage || !historik.has(kendtTil)) return null;
  const sidste7 = dage.slice(0, 7).map((d) => gns(historik.get(d)!));
  if (sidste7.length < 7) return null;
  const niveau = opt.niveauVaegt * gns(historik.get(kendtTil)!) + (1 - opt.niveauVaegt) * gns(sidste7);
  const type = fridag(maal);
  const ens = dage.filter((d) => fridag(d) === type).slice(0, opt.formDage);
  if (ens.length < 3) return null;
  const form = Array.from({ length: 24 }, (_, t) => gns(ens.map((d) => historik.get(d)![t] - gns(historik.get(d)!))));
  return form.map((f) => niveau + f);
}

/** Dyreste/billigste sammenhængende `timer` timer i en 24-timersprofil. Start = lokal time. */
export function billigsteVindue(profil: Timeprofil, timer = 3): { start: number; gennemsnit: number } {
  let bedst = { start: 0, gennemsnit: Infinity };
  for (let s = 0; s + timer <= 24; s++) {
    const g = gns(profil.slice(s, s + timer));
    if (g < bedst.gennemsnit - 1e-9) bedst = { start: s, gennemsnit: g };
  }
  return bedst;
}

export const middel = gns;
