import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { kraev } from "./config";

export function nytToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Hvad et token giver lov til. Et token kan kun bruges til sit eget formål. */
type Formaal = "afmeld" | "slet" | "skift-postnummer" | "politik-fra";

function signatur(formaal: Formaal, id: string): string {
  return createHmac("sha256", kraev("TOKEN_HEMMELIGHED")).update(`${formaal}:${id}`).digest("base64url");
}

function lavToken(formaal: Formaal, id: string): string {
  return `${id}.${signatur(formaal, id)}`;
}

function laesToken(formaal: Formaal, token: string): string | null {
  const [id, sig] = token.split(".");
  if (!id || !sig || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const forventet = Buffer.from(signatur(formaal, id));
  const faktisk = Buffer.from(sig);
  if (forventet.length !== faktisk.length || !timingSafeEqual(forventet, faktisk)) return null;
  return id;
}

/** Afmeldingstoken = id + HMAC. Kan genskabes til hver mail uden at gemme det. */
export const afmeldToken = (id: string) => lavToken("afmeld", id);
export const laesAfmeldToken = (token: string) => laesToken("afmeld", token);

/** Token til fuld sletning af personens oplysninger. */
export const sletToken = (id: string) => lavToken("slet", id);
export const laesSletToken = (token: string) => laesToken("slet", token);

/** Token til at skifte postnummer. */
export const skiftToken = (id: string) => lavToken("skift-postnummer", id);
export const laesSkiftToken = (token: string) => laesToken("skift-postnummer", token);

/** Token til kun at trække det politiske samtykke tilbage (elpriserne fortsætter). */
export const politikFraToken = (id: string) => lavToken("politik-fra", id);
export const laesPolitikFraToken = (token: string) => laesToken("politik-fra", token);

/** Nøgle til ratebegrænsning. E-mail og IP gemmes som HMAC, ikke i klartekst. */
export function rateNoegle(art: "ip" | "email", vaerdi: string): string {
  return `${art}:${createHmac("sha256", kraev("TOKEN_HEMMELIGHED")).update(`rate:${art}:${vaerdi}`).digest("base64url")}`;
}
