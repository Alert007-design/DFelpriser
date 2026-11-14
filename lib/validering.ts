import { KILDER } from "./facebook-kilde";
import { z } from "zod";
import { omraadeForPostnummer } from "./omraade";

const ja = (v: unknown) => v === true || ["on", "true", "ja", "1", "yes"].includes(String(v).toLowerCase());

const version = z.coerce.number().int().positive();
const hash = z.string().regex(/^[0-9a-f]{64}$/);

const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Skriv en gyldig e-mailadresse"));
export const postnummerFelt = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "Postnummeret skal være fire cifre")
  .refine((p) => omraadeForPostnummer(p) !== null, "Vi kender ikke det postnummer");

/** Fornavn eller efternavn: påkrævet, mellemrum i enderne fjernes og flere mellemrum i træk bliver til ét. */
const navnedel = (fejl: string) =>
  z
    .string({ error: fejl })
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, fejl).max(60, "Højst 60 tegn"));

/**
 * Tilmelding. Dataminimering: kun navn, e-mail og postnummer. Navnet bruges til tiltale i Dansk Folkepartis
 * nyhedsbreve (godkendt af Morten 12/11-2026). Ét samtykke, der ikke er forhåndsafkrydset og skal
 * sendes udtrykkeligt. Felter fra den tidligere formular med et separat politisk samtykke ignoreres.
 */
export const tilmeldingSkema = z.object({
  fornavn: navnedel("Skriv dit fornavn"),
  efternavn: navnedel("Skriv dit efternavn"),
  email,
  postnummer: postnummerFelt,
  samtykke: z.unknown().refine(ja, "Du skal give samtykke for at tilmelde dig"),
  samtykke_version: version,
  samtykke_hash: hash,
  // Honeypot: et skjult felt, som mennesker lader stå tomt.
  hjemmeside: z.string().nullish(),
  // Kom personen via et mærket link (?fra=fb-el, benzinmail eller del-el)? Bruges kun til den anonyme optælling og gemmes ikke.
  fra: z.enum(KILDER).optional().catch(undefined),
});

export type Tilmelding = z.output<typeof tilmeldingSkema>;

export const skiftPostnummerSkema = z.object({ token: z.string().min(10), postnummer: postnummerFelt });
