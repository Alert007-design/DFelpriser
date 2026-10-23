export const TIDSZONE = "Europe/Copenhagen";

function dele(nu: Date): Record<string, string> {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIDSZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(f.formatToParts(nu).map((p) => [p.type, p.value]));
}

/** Datoen i Danmark som "YYYY-MM-DD". */
export function danskDato(nu: Date): string {
  const d = dele(nu);
  return `${d.year}-${d.month}-${d.day}`;
}

/** Klokkeslættet i Danmark (tager højde for sommertid). */
export function danskKlokkeslaet(nu: Date): { time: number; minut: number } {
  const d = dele(nu);
  return { time: Number(d.hour), minut: Number(d.minute) };
}

/** Lægger hele kalenderdage til en dato "YYYY-MM-DD" (ren kalenderregning, uafhængig af sommertid). */
export function laegDage(dato: string, dage: number): string {
  const [y, m, d] = dato.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dage)).toISOString().slice(0, 10);
}

/**
 * Det præcise tidsrum for en dansk kalenderdag som UTC-tidspunkter. Dagen er 24 timer, undtagen
 * den sidste søndag i marts (23 timer) og den sidste søndag i oktober (25 timer).
 */
export function dagensGraenser(dato: string): { start: Date; slut: Date } {
  return { start: lokalMidnat(dato), slut: lokalMidnat(laegDage(dato, 1)) };
}

function lokalMidnat(dato: string): Date {
  const [y, m, d] = dato.split("-").map(Number);
  // Dansk tid er UTC+1 eller UTC+2; kun ét af de to kandidattidspunkter er midnat i Danmark.
  for (const forskydning of [1, 2]) {
    const kandidat = new Date(Date.UTC(y, m - 1, d, -forskydning));
    const { time, minut } = danskKlokkeslaet(kandidat);
    if (danskDato(kandidat) === dato && time === 0 && minut === 0) return kandidat;
  }
  throw new Error(`Kunne ikke finde midnat for ${dato}`);
}

/** Antal timer i en dansk kalenderdag: 23, 24 eller 25. */
export function timerIDoegnet(dato: string): number {
  const { start, slut } = dagensGraenser(dato);
  return (slut.getTime() - start.getTime()) / 3_600_000;
}

/**
 * Udsendelsesvinduet: fra kl. 16.00 til 18.59 dansk tid. Vercel Cron kører i UTC og kaldes derfor i flere
 * timer, så vinduet passer både sommer og vinter. Åbner vinduet og priserne mangler, forsøger jobbet igen
 * ved næste kald.
 */
export function iUdsendelsesvindue(nu: Date): boolean {
  const { time } = danskKlokkeslaet(nu);
  return time >= 16 && time < 19;
}

export function foerUdsendelsesvindue(nu: Date): boolean {
  return danskKlokkeslaet(nu).time < 16;
}

/** Klokkeslæt som "12.15" (dansk tid). */
export function klokkeslaetTekst(nu: Date): string {
  const { time, minut } = danskKlokkeslaet(nu);
  return `${String(time).padStart(2, "0")}.${String(minut).padStart(2, "0")}`;
}

const UGEDAGE = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

/** Ugedagen for en dato "YYYY-MM-DD", fx "lørdag". */
export function ugedag(dato: string): string {
  const [y, m, d] = dato.split("-").map(Number);
  return UGEDAGE[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function erWeekend(dato: string): boolean {
  const u = ugedag(dato);
  return u === "lørdag" || u === "søndag";
}

/** Fx "lørdag den 24. oktober". */
export function laesbarDato(dato: string): string {
  const [y, m, d] = dato.split("-").map(Number);
  const maaned = new Intl.DateTimeFormat("da-DK", { timeZone: "UTC", month: "long" }).format(new Date(Date.UTC(y, m - 1, d)));
  return `${ugedag(dato)} den ${d}. ${maaned}`;
}

/** Stort begyndelsesbogstav: "lørdag den 24. oktober" -> "Lørdag den 24. oktober". */
export function stortFoerst(t: string): string {
  return t.charAt(0).toLocaleUpperCase("da-DK") + t.slice(1);
}
