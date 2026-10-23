import { hentDb } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { laesFelter } from "@/lib/http";
import { skiftPostnummer } from "@/lib/tilmelding";

export async function POST(req: Request) {
  const { token, postnummer } = await laesFelter(req);
  const t = typeof token === "string" ? token : "";
  const resultat = t ? await skiftPostnummer(hentDb(), t, String(postnummer ?? "").trim()) : "ugyldig";
  const til = new URL(`${appUrl()}/skift-postnummer`);
  til.searchParams.set("resultat", resultat);
  if (resultat === "ukendt_postnummer") til.searchParams.set("token", t);
  return Response.redirect(til.toString(), 303);
}
