import { hentDb } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { laesFelter } from "@/lib/http";
import { bekraeft } from "@/lib/tilmelding";

// Bekræftelse sker med POST fra en knap, så mailprogrammers automatiske linkscannere ikke bekræfter.
export async function POST(req: Request) {
  const { token } = await laesFelter(req);
  const ok = typeof token === "string" && token.length > 0 ? await bekraeft(hentDb(), token, new Date()) : false;
  return Response.redirect(`${appUrl()}/bekraeft?resultat=${ok ? "ok" : "ugyldig"}`, 303);
}
