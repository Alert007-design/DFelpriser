import { hentDb } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { erCron } from "@/lib/http";
import { valgKilde } from "@/lib/kilder";
import { resendAfsender } from "@/lib/mail/afsender";
import { udsend } from "@/lib/udsendelse";

export const maxDuration = 300;

// Kaldes hvert 5. minut 14.00–18.55 UTC; udsend() gør kun noget kl. 16.00–18.59 dansk tid (sommer og vinter).
export async function GET(req: Request) {
  if (!erCron(req)) return new Response("Ikke tilladt", { status: 401 });
  const resultat = await udsend(hentDb(), resendAfsender(), { nu: new Date(), appUrl: appUrl(), kilde: valgKilde() });
  console.log("udsendelse", JSON.stringify(resultat));
  const fejl = Object.values(resultat.omraader).some((o) => o && (o.fejlet > 0 || o.status === "droppet"));
  return Response.json(resultat, { status: fejl ? 503 : 200 });
}
