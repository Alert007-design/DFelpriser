import { hentDb } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { laesFelter } from "@/lib/http";
import { overfoerEn } from "@/lib/klaviyo";
import { bekraeftId } from "@/lib/tilmelding";

// Bekræftelse sker med POST fra en knap, så mailprogrammers automatiske linkscannere ikke bekræfter.
export async function POST(req: Request) {
  const { token } = await laesFelter(req);
  const db = hentDb();
  const id = typeof token === "string" && token.length > 0 ? await bekraeftId(db, token, new Date()) : null;
  // Overførslen til Klaviyo kaster aldrig; fejler den, tages den af oprydningen hver time.
  if (id) await overfoerEn(db, id);
  const ok = id !== null;
  return Response.redirect(`${appUrl()}/bekraeft?resultat=${ok ? "ok" : "ugyldig"}`, 303);
}
