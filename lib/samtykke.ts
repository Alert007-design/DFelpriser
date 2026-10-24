/**
 * Den samtykketekst, formularen viser. Ét obligatorisk samtykke uden forhåndsafkrydsning, der dækker både
 * den daglige elprismail og politisk information fra Dansk Folkeparti (besluttet af ejeren 24. oktober 2026,
 * samme model som partiets brændstofpris-tjeneste). Man kan ikke tilmelde sig det ene uden det andet.
 *
 * Version 1 og det tidligere separate politiske samtykke ("politik") findes stadig i databasen som
 * dokumentation for dem, der tilmeldte sig før omlægningen. Nye tilmeldinger får kun "elpris" version 2.
 *
 * Hver tekst har et fast versionsnummer og ligger ordret i tabellen `samtykketekster`, hvor den ikke kan
 * ændres. Formularen sender versionsnummer og SHA-256 af den viste tekst, og API'et afviser tilmeldingen,
 * hvis de ikke passer.
 *
 * Ændres teksten: tilføj en ny version i en ny migration. Ret aldrig en eksisterende version.
 */

export const PRIVATLIVSPOLITIK_STI = "/privatlivspolitik";

/** Den del af e-mail-samtykket, der vises som link til privatlivspolitikken. */
export const PRIVATLIVSLINK_TEKST = "Læs privatlivspolitikken";

export type SamtykkeType = "elpris" | "politik";

export interface Samtykketekst {
  type: SamtykkeType;
  version: number;
  tekst: string;
}

export const ELPRIS_SAMTYKKE: Samtykketekst = {
  type: "elpris",
  version: 2,
  tekst:
    "Ja tak. Jeg vil hver dag kl. 16 modtage en e-mail fra Dansk Folkeparti med morgendagens elpriser og en prognose for de to følgende dage i mit elprisområde samt information om Dansk Folkepartis politik og politiske udspil. Jeg giver udtrykkeligt samtykke til, at Dansk Folkeparti behandler min e-mailadresse og mit postnummer til disse formål. Min tilmelding kan være en oplysning om politisk interesse. Jeg kan til enhver tid trække mit samtykke tilbage via afmeldingslinket i e-mailen. Læs privatlivspolitikken.",
};

/** Første version af elprissamtykket, hvor politisk information krævede et separat samtykke. */
export const FOERSTE_VERSION_MED_POLITIK_I_SAMTYKKET = 2;

/** Deler e-mail-samtykket i den almindelige tekst og linkteksten til sidst. */
export function delOmkringLink(tekst: string): { foer: string; link: string; efter: string } {
  const i = tekst.lastIndexOf(PRIVATLIVSLINK_TEKST);
  if (i < 0) throw new Error("Samtykketeksten mangler linket til privatlivspolitikken");
  return { foer: tekst.slice(0, i), link: PRIVATLIVSLINK_TEKST, efter: tekst.slice(i + PRIVATLIVSLINK_TEKST.length) };
}
