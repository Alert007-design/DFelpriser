import { laegDage } from "../tid";

function paaskedag(aar: number): string {
  // Gauss' algoritme for påskedag (gregoriansk kalender).
  const a = aar % 19;
  const b = Math.floor(aar / 100);
  const c = aar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maaned = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return `${aar}-${String(maaned).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

/** Danske helligdage med fast fri: nytår, påske, Kristi himmelfart, pinse og jul. */
export function erHelligdag(dato: string): boolean {
  const aar = Number(dato.slice(0, 4));
  const p = paaskedag(aar);
  const dage = new Set([
    `${aar}-01-01`,
    laegDage(p, -3), // skærtorsdag
    laegDage(p, -2), // langfredag
    p,
    laegDage(p, 1),
    laegDage(p, 39), // Kristi himmelfart
    laegDage(p, 49), // pinsedag
    laegDage(p, 50),
    `${aar}-12-25`,
    `${aar}-12-26`,
  ]);
  return dage.has(dato);
}
