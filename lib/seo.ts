import { sti } from "@/lib/sti";

/** Den offentlige adresse. Siden vises på dfpriser.dk/el, uanset hvilken adresse projektet selv kører på. */
export const OFFENTLIG_DOMAENE = "https://dfpriser.dk";

/** "/om-priserne" → "https://dfpriser.dk/el/om-priserne". */
export function kanonisk(p: string): string {
  return OFFENTLIG_DOMAENE + sti(p);
}
