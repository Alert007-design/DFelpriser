import type { Omraade } from "./pris/typer";

/**
 * Elprisområde ud fra postnummer. Danmark er delt i to budområder: DK1 (Jylland og Fyn) og DK2 (Sjælland,
 * Lolland-Falster, Møn og Bornholm). Postnummerserierne følger øerne: 1000–4999 ligger i DK2, 5000–9999 i DK1.
 *
 * REGELBASERET: reglen er afledt af Danmarks geografi og skal kontrolleres mod Energinets områdeinddeling og
 * den officielle postnummerliste, før tilmeldingen åbnes (se docs/DATAKILDER.md). Postnumre, der ikke
 * tilhører Danmarks elnet (Færøerne, Grønland, virksomhedsnumre), giver null. Ukendte numre afvises hellere
 * end gættes.
 */
export function omraadeForPostnummer(postnummer: string): Omraade | null {
  if (!/^\d{4}$/.test(postnummer)) return null;
  const n = Number(postnummer);
  if (n < 1000) return null; // 0800–0999 er virksomhedspostnumre uden bopæl
  if (n >= 3800 && n <= 3999) return null; // Færøerne (FO) og Grønland
  if (n <= 4999) return "DK2";
  return "DK1";
}

export function omraadeNavn(o: Omraade): string {
  return o === "DK1" ? "Vestdanmark (Jylland og Fyn)" : "Østdanmark (Sjælland, Lolland-Falster og Bornholm)";
}
