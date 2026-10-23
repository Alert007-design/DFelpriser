import { hentDb } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { laesFelter } from "@/lib/http";
import { slet } from "@/lib/tilmelding";

export async function POST(req: Request) {
  const { token } = await laesFelter(req);
  const resultat = typeof token === "string" && token ? await slet(hentDb(), token) : "ugyldig";
  return Response.redirect(`${appUrl()}/afmeld?resultat=${resultat === "ok" ? "slettet" : "ugyldig"}`, 303);
}
