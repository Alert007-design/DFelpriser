import { hentDb } from "@/lib/db";
import { erCron } from "@/lib/http";
import { valgKilde } from "@/lib/kilder";
import { hentOgGem } from "@/lib/pris/lager";
import { danskDato, laegDage } from "@/lib/tid";

export const maxDuration = 120;

/**
 * Henter day-ahead-priser for de seneste 7 døgn, i dag og i morgen. Idempotent: kan køres så ofte som ønsket.
 * Med ?fra=YYYY-MM-DD&til=YYYY-MM-DD hentes en bestemt periode (til udfyldning af historik, højst 31 døgn ad gangen).
 */
export async function GET(req: Request) {
  if (!erCron(req)) return new Response("Ikke tilladt", { status: 401 });
  const nu = new Date();
  const p = new URL(req.url).searchParams;
  const fra = p.get("fra") ?? laegDage(danskDato(nu), -7);
  const til = p.get("til") ?? laegDage(danskDato(nu), 1);
  if (!/^\d{4}-\d\d-\d\d$/.test(fra) || !/^\d{4}-\d\d-\d\d$/.test(til) || fra > til) {
    return Response.json({ fejl: "ugyldig periode" }, { status: 400 });
  }
  if (new Date(til).getTime() - new Date(fra).getTime() > 31 * 86_400_000) {
    return Response.json({ fejl: "højst 31 døgn ad gangen" }, { status: 400 });
  }
  try {
    const resultat = await hentOgGem(hentDb(), valgKilde(), fra, til);
    const ufulde = resultat.filter((r) => !r.fuld);
    return Response.json({ fra, til, dage: resultat.length, ufuldstaendige: ufulde });
  } catch (fejl) {
    return Response.json({ fejl: fejl instanceof Error ? fejl.message : String(fejl) }, { status: 503 });
  }
}
