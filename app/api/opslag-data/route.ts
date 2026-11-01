import { hentDb } from "@/lib/db";
import { erOpslagKald } from "@/lib/http";
import { opslagData } from "@/lib/opslagdata";

export const dynamic = "force-dynamic";

/** Lukket læseadresse til dfpriser.dk (elopslaget på Facebook). Kræver OPSLAG_NOEGLE. Intet om personer. */
export async function GET(req: Request) {
  if (!erOpslagKald(req)) return new Response("Ikke tilladt", { status: 401 });
  try {
    return Response.json(await opslagData(hentDb(), new Date()), { headers: { "Cache-Control": "no-store" } });
  } catch (fejl) {
    console.error("Opslagsdata fejlede", fejl);
    return new Response("Midlertidig fejl", { status: 503 });
  }
}
