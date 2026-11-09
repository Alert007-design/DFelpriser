import { hentDb } from "@/lib/db";
import { erCron } from "@/lib/http";
import { overfoerManglende } from "@/lib/klaviyo";
import { rydOp } from "@/lib/tilmelding";

export async function GET(req: Request) {
  if (!erCron(req)) return new Response("Ikke tilladt", { status: 401 });
  const db = hentDb();
  const resultat = await rydOp(db, new Date());
  const klaviyo = await overfoerManglende(db);
  return Response.json({ ...resultat, klaviyo });
}
