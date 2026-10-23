import { hentDb } from "@/lib/db";
import { appUrl, erTestmodtager, juraGodkendt } from "@/lib/config";
import { corsHeaders, klientIp, laesFelter } from "@/lib/http";
import { resendAfsender } from "@/lib/mail/afsender";
import { tilmeld } from "@/lib/tilmelding";
import { tilmeldingSkema } from "@/lib/validering";

const BESKEDER = {
  ok: "Tak! Tjek din indbakke og bekræft din tilmelding.",
  spaerret: "Tilmeldingen er ikke åbnet endnu.",
  ukendt_postnummer: "Vi kender ikke det postnummer.",
  for_mange: "For mange forsøg. Prøv igen om lidt.",
  samtykke_foraeldet: "Samtykketeksten er blevet opdateret. Genindlæs siden, læs teksten, og prøv igen.",
} as const;

const HTTP = { ok: 200, spaerret: 503, ukendt_postnummer: 400, for_mange: 429, samtykke_foraeldet: 409 } as const;

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req.headers.get("origin"));
  const erFormular = !(req.headers.get("content-type") ?? "").includes("application/json");
  const svar = (status: number, body: { status: string; besked: string; fejl?: Record<string, string> }) => {
    if (erFormular && status === 200) return Response.redirect(`${appUrl()}/tak`, 303);
    return Response.json(body, { status, headers: cors });
  };

  const parsed = tilmeldingSkema.safeParse(await laesFelter(req));
  if (!parsed.success) {
    const fejl = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    // Mangler samtykkeversionen, er det en gammel eller fremmed formular: intet gemmes.
    if (fejl.samtykke_version || fejl.samtykke_hash) {
      return svar(409, { status: "samtykke_foraeldet", besked: BESKEDER.samtykke_foraeldet });
    }
    return svar(400, { status: "ugyldig", besked: "Tjek felterne.", fejl });
  }
  // Honeypot udfyldt: lad som om alt gik godt.
  if (parsed.data.hjemmeside) return svar(200, { status: "ok", besked: BESKEDER.ok });

  // Spærren tjekkes, før der overhovedet åbnes forbindelse til database eller mailtjeneste.
  if (!juraGodkendt() && !erTestmodtager(parsed.data.email)) {
    return svar(503, { status: "spaerret", besked: BESKEDER.spaerret });
  }

  try {
    const resultat = await tilmeld(hentDb(), resendAfsender(), parsed.data, { ip: klientIp(req), appUrl: appUrl(), nu: new Date() });
    return svar(HTTP[resultat.status], { status: resultat.status, besked: BESKEDER[resultat.status] });
  } catch (fejl) {
    console.error("Tilmelding fejlede", fejl);
    return svar(500, { status: "fejl", besked: "Noget gik galt. Prøv igen senere." });
  }
}
