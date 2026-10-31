/**
 * Elpris-siden ligger under dfpriser.dk/el (Mike Kaltoft og Morten, 31/10-2026). Alle sider, API'er og
 * billeder har derfor adresser, der begynder med /el. Next.js sætter selv /el foran <Link>, men ikke
 * foran almindelige links, formularer, fetch og billeder; dem skrives med sti().
 */
export const BASE_STI = "/el";

/** "/api/tilmeld" → "/el/api/tilmeld". "/" → "/el". */
export function sti(p: string): string {
  if (!p.startsWith("/")) throw new Error(`Stien skal begynde med /: ${p}`);
  return p === "/" ? BASE_STI : `${BASE_STI}${p}`;
}
