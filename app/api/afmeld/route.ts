import { hentDb } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { laesFelter } from "@/lib/http";
import { afmeld } from "@/lib/tilmelding";

/**
 * Stopper kun den daglige mail. Personens oplysninger og samtykke bevares. Bruges både af knappen på
 * /afmeld og af mailprogrammernes one-click-afmelding (RFC 8058: POST med "List-Unsubscribe=One-Click",
 * token i URL'en). Kun POST ændrer noget, så mailprogrammernes linkscannere ikke stopper nogen ved at åbne
 * linket. Fuld sletning sker på /slet.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const felter = await laesFelter(req);
  const token = String(url.searchParams.get("token") ?? felter.token ?? "");
  const resultat = token ? await afmeld(hentDb(), token, new Date()) : "ugyldig";
  if (felter.fra_side) return Response.redirect(`${appUrl()}/afmeld?resultat=${resultat}`, 303);
  return Response.json({ status: resultat }, { status: resultat === "ok" ? 200 : 400 });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return Response.redirect(`${appUrl()}/afmeld?token=${encodeURIComponent(token)}`, 303);
}
