import { danskKlokkeslaet } from "../tid";
import type { Periode } from "./typer";

/** "12.15" – dansk skrivemåde for klokkeslæt. Hele timer skrives uden minutter: "12". */
export function klokke(d: Date): string {
  const { time, minut } = danskKlokkeslaet(d);
  return minut === 0 ? String(time).padStart(2, "0") : `${String(time).padStart(2, "0")}.${String(minut).padStart(2, "0")}`;
}

/** "Kl. 12–15" eller "Kl. 12.15–15.15". Slutter perioden ved midnat, skrives 24. */
export function periodeTekst(p: Pick<Periode, "start" | "slut">): string {
  const slut = danskKlokkeslaet(p.slut);
  const slutTekst = slut.time === 0 && slut.minut === 0 ? "24" : klokke(p.slut);
  return `Kl. ${klokke(p.start)}–${slutTekst}`;
}

/** Øre pr. kWh med dansk decimalkomma og én decimal: "52,3". */
export function oere(v: number): string {
  return v.toFixed(1).replace(".", ",").replace("-", "−");
}

/** Kroner med dansk decimalkomma: "14,20". */
export function kroner(v: number): string {
  return v.toFixed(2).replace(".", ",");
}
