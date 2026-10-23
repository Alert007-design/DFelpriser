/**
 * De samtykketekster, formularen viser. To adskilte samtykker, begge uden forhåndsafkrydsning:
 *  - "elpris": det daglige elprisnyhedsbrev (påkrævet for at tilmelde sig),
 *  - "politik": frivillig politisk information i samme e-mail.
 * Mails indeholder kun politisk information til dem, der har givet det andet samtykke.
 *
 * Teksterne er UDKAST til juridisk godkendelse (se docs/GDPR.md). Hver tekst har et fast versionsnummer og
 * ligger ordret i tabellen `samtykketekster`, hvor den ikke kan ændres. Formularen sender versionsnummer
 * og SHA-256 af den viste tekst, og API'et afviser tilmeldingen, hvis de ikke passer.
 *
 * Ændres en tekst: tilføj en ny version i en ny migration. Ret aldrig en eksisterende version.
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
  version: 1,
  tekst:
    "Ja tak. Jeg vil hver dag kl. 16 modtage en e-mail fra Dansk Folkeparti med morgendagens elpriser og en prognose for de to følgende dage i mit elprisområde. Jeg giver udtrykkeligt samtykke til, at Dansk Folkeparti behandler min e-mailadresse og mit postnummer til dette formål. Min tilmelding kan være en oplysning om politisk interesse. Jeg kan til enhver tid trække mit samtykke tilbage via afmeldingslinket i e-mailen. Læs privatlivspolitikken.",
};

export const POLITIK_SAMTYKKE: Samtykketekst = {
  type: "politik",
  version: 1,
  tekst:
    "Ja tak. Jeg vil også gerne have information om Dansk Folkepartis politik og politiske udspil i den daglige e-mail. Jeg giver udtrykkeligt samtykke til, at Dansk Folkeparti behandler min e-mailadresse og mit postnummer til dette formål. Min tilmelding kan være en oplysning om politisk interesse. Jeg kan til enhver tid trække dette samtykke tilbage, uden at det afmelder elpriserne.",
};

/** Deler e-mail-samtykket i den almindelige tekst og linkteksten til sidst. */
export function delOmkringLink(tekst: string): { foer: string; link: string; efter: string } {
  const i = tekst.lastIndexOf(PRIVATLIVSLINK_TEKST);
  if (i < 0) throw new Error("Samtykketeksten mangler linket til privatlivspolitikken");
  return { foer: tekst.slice(0, i), link: PRIVATLIVSLINK_TEKST, efter: tekst.slice(i + PRIVATLIVSLINK_TEKST.length) };
}
