/** Indstillinger læses ved hvert kald, så de kan ændres i Vercel uden kodeændring. */

function env(navn: string): string {
  return (process.env[navn] ?? "").trim();
}

export function kraev(navn: string): string {
  const v = env(navn);
  if (!v) throw new Error(`Miljøvariablen ${navn} mangler`);
  return v;
}

/** Spærren: rigtige tilmeldinger og udsendelser kun når JURA_GODKENDT=ja. */
export function juraGodkendt(): boolean {
  return env("JURA_GODKENDT").toLowerCase() === "ja";
}

export function testmodtagere(): Set<string> {
  return new Set(
    env("TESTMODTAGERE")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function erTestmodtager(email: string): boolean {
  return testmodtagere().has(email.trim().toLowerCase());
}

export function tilladteOrigins(): string[] {
  return env("TILLADT_ORIGIN")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function appUrl(): string {
  return kraev("APP_URL").replace(/\/$/, "");
}

export function priskilde(): "test" | "live" {
  return env("PRISKILDE") === "live" ? "live" : "test";
}

/** Kommaseparerede selskabsnøgler. Tåler mellemrum, semikolon og anførselstegn omkring værdien. */
/** Offentlig = hjemmesiden må indekseres af søgemaskiner. Standard er nej, indtil ejeren har godkendt lanceringen. */
export function erOffentlig(): boolean {
  return env("OFFENTLIG").toLowerCase() === "ja";
}

/** Hvor længe oplysninger om afmeldte gemmes som dokumentation, før de slettes. Skal fastlægges af jurist. */
export function afmeldtOpbevaringDage(): number {
  const n = Number(env("AFMELDT_OPBEVARING_DAGE"));
  return Number.isInteger(n) && n > 0 ? n : 365;
}

export function valgfri(navn: string): string | undefined {
  return env(navn) || undefined;
}
