export type Omraade = "DK1" | "DK2";
export const OMRAADER: Omraade[] = ["DK1", "DK2"];

/** Et prisinterval på markedet. Spotprisen er øre/kWh uden moms, afgifter og tariffer. */
export interface Slot {
  /** Intervallets start som UTC-tidspunkt. */
  start: Date;
  /** Intervallets længde i minutter (15 siden 1. oktober 2025, tidligere 60). */
  minutter: number;
  oerePrKwh: number;
}

export interface Periode {
  start: Date;
  slut: Date;
  /** Gennemsnit i øre/kWh over perioden. */
  gennemsnit: number;
}

export interface Dagsopsummering {
  dato: string;
  slots: number;
  gennemsnit: number;
  laveste: number;
  hoeyeste: number;
  billigste: Periode;
  dyreste: Periode;
  /** Forskel i øre/kWh mellem dyreste og billigste periodes gennemsnit. */
  forskel: number;
}
