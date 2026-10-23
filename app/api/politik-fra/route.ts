import { hentDb } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { laesFelter } from "@/lib/http";
import { traekPolitikTilbage } from "@/lib/tilmelding";

export async function POST(req: Request) {
  const { token } = await laesFelter(req);
  const resultat = typeof token === "string" && token ? await traekPolitikTilbage(hentDb(), token, new Date()) : "ugyldig";
  return Response.redirect(`${appUrl()}/politik-fra?resultat=${resultat}`, 303);
}
