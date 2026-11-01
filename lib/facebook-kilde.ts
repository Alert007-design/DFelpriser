import type { Db } from "./db";
import { sti } from "./sti";
import { danskDato } from "./tid";

/** Linket i første kommentar på Facebook: /el?fra=fb-el. Tælles anonymt; intet om personen gemmes. */
export const KILDER = ["fb-el"] as const;
export type Kilde = (typeof KILDER)[number];
export type KildeType = "besoeg" | "tilmelding";

export function erKilde(v: unknown): v is Kilde {
  return typeof v === "string" && (KILDER as readonly string[]).includes(v);
}

/** Mærket i adressen (?fra=...). Alt andet, fx fbclid, ignoreres. */
export function fraMaerke(search: string): Kilde | undefined {
  const fra = new URLSearchParams(search).get("fra");
  return erKilde(fra) ? fra : undefined;
}

/** Hvilket anonymt besøgskald browseren skal sende for adressen, eller null. Intet andet fra adressen sendes. */
export function besoegKald(search: string): { sti: string; body: { kilde: Kilde } } | null {
  const fra = fraMaerke(search);
  return fra ? { sti: sti("/api/kilde"), body: { kilde: fra } } : null;
}

/** Lægger én til dagens tal for kilden og typen. Gemmer kun dato, kilde, type og antal. */
export async function taelKilde(db: Db, kilde: Kilde, type: KildeType, nu: Date): Promise<void> {
  await db.query(
    `insert into kildetal (dato, kilde, type, antal) values ($1::date, $2, $3, 1)
     on conflict (dato, kilde, type) do update set antal = kildetal.antal + 1`,
    [danskDato(nu), kilde, type],
  );
}

/** Som taelKilde, men en fejl (fx manglende tabel) må aldrig påvirke det, brugeren er i gang med. */
export async function taelKildeStille(db: Db, kilde: Kilde, type: KildeType, nu: Date): Promise<void> {
  try {
    await taelKilde(db, kilde, type, nu);
  } catch (fejl) {
    console.error("Optælling af kilde fejlede", fejl);
  }
}
