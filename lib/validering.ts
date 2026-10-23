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

/** Tilmelding. Dataminimering: kun e-mail og postnummer. Ingen forhåndsafkrydsede felter: begge samtykker skal sendes udtrykkeligt. */
export const tilmeldingSkema = z
  .object({
    email,
    postnummer: postnummerFelt,
    samtykke: z.unknown().refine(ja, "Du skal give samtykke for at tilmelde dig"),
    samtykke_version: version,
    samtykke_hash: hash,
    // Frivilligt, adskilt samtykke til politisk information.
    politik_samtykke: z.unknown().optional().transform(ja),
    politik_samtykke_version: version.optional(),
    politik_samtykke_hash: hash.optional(),
    // Honeypot: et skjult felt, som mennesker lader stå tomt.
    hjemmeside: z.string().nullish(),
  })
  .superRefine((d, ctx) => {
    if (d.politik_samtykke && (!d.politik_samtykke_version || !d.politik_samtykke_hash)) {
      ctx.addIssue({ code: "custom", path: ["politik_samtykke"], message: "Samtykket mangler. Genindlæs siden." });
    }
  });

export type Tilmelding = z.output<typeof tilmeldingSkema>;

export const skiftPostnummerSkema = z.object({ token: z.string().min(10), postnummer: postnummerFelt });
