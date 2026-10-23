import { hentDb } from "@/lib/db";
import { erCron } from "@/lib/http";
import { rydOp } from "@/lib/tilmelding";

export async function GET(req: Request) {
  if (!erCron(req)) return new Response("Ikke tilladt", { status: 401 });
  return Response.json(await rydOp(hentDb(), new Date()));
}
