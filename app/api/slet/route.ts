import { hentDb } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { laesFelter } from "@/lib/http";
import { slet } from "@/lib/tilmelding";

/** Fuld sletning på personens egen anmodning. Kun POST fra bekræftelsesknappen på /slet. */

export async function POST(req: Request) {
  const { token } = await laesFelter(req);
  const resultat = typeof token === "string" && token ? await slet(hentDb(), token) : "ugyldig";
  return Response.redirect(`${appUrl()}/slet?resultat=${resultat === "ok" ? "slettet" : "ugyldig"}`, 303);
}
