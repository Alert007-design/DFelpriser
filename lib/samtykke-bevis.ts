import { createHash } from "node:crypto";
import type { Db } from "./db";
import type { SamtykkeType } from "./samtykke";

/** SHA-256 (hex) af en samtykketekst. Formularen får den fra serveren og sender den tilbage. */
export function tekstHash(tekst: string): string {
  return createHash("sha256").update(tekst.normalize("NFC"), "utf8").digest("hex");
}

export interface GaeldendeSamtykke {
  version: number;
  tekst: string;
}

/**
 * Finder den gældende tekst for en type og kontrollerer, at formularen viste præcis den.
 * Returnerer null, hvis versionen eller teksten ikke passer (fx en side, der blev
 * indlæst før en ny version, eller en formular et andet sted med en anden tekst).
 */
export async function bekraeftVistSamtykke(
  db: Db,
  type: SamtykkeType,
  vist: { version: number; hash: string },
): Promise<GaeldendeSamtykke | null> {
  const [gaeldende] = await db.query<{ version: number; tekst: string }>(
    `select version, tekst from samtykketekster where type = $1 order by version desc limit 1`,
    [type],
  );
  if (!gaeldende) throw new Error(`Ingen samtykketekst af typen ${type} i databasen`);
  if (gaeldende.version !== vist.version) return null;
  if (tekstHash(gaeldende.tekst) !== vist.hash) return null;
  return { version: gaeldende.version, tekst: gaeldende.tekst };
}
