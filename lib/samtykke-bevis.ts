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
 * Kontrollerer, at formularen viste præcis den tekst, koden gælder for (`gaeldendeVersion`), og at den tekst ligger
 * ordret i databasen. Returnerer null, hvis versionen eller teksten ikke passer (fx en side, der blev indlæst før en
 * ny version, eller en formular et andet sted med en anden tekst).
 *
 * Der sammenlignes med kodens version og ikke med den nyeste i databasen. Så kan en ny tekst lægges i databasen,
 * før koden, der viser den, er ude, uden at tilmeldingen står stille imens.
 */
export async function bekraeftVistSamtykke(
  db: Db,
  type: SamtykkeType,
  vist: { version: number; hash: string },
  gaeldendeVersion: number,
): Promise<GaeldendeSamtykke | null> {
  if (vist.version !== gaeldendeVersion) return null;
  const [tekst] = await db.query<{ version: number; tekst: string }>(
    `select version, tekst from samtykketekster where type = $1 and version = $2`,
    [type, gaeldendeVersion],
  );
  if (!tekst) throw new Error(`Samtykketekst ${type} version ${gaeldendeVersion} mangler i databasen`);
  if (tekstHash(tekst.tekst) !== vist.hash) return null;
  return { version: tekst.version, tekst: tekst.tekst };
}
