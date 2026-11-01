import { hentDb } from "@/lib/db";
import { erKilde, taelKildeStille } from "@/lib/facebook-kilde";

/**
 * Anonym optælling fra browseren: elpris-siden er åbnet via et link fra Facebook (/el?fra=fb-el).
 * Kun besøg tælles her; tilmeldinger tælles af tilmeldingen selv. Svarer altid 204, også ved fejl.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { kilde?: unknown } | null;
  const kilde = body?.kilde;
  if (erKilde(kilde)) {
    try {
      await taelKildeStille(hentDb(), kilde, "besoeg", new Date());
    } catch (fejl) {
      console.error("Optælling af kilde fejlede", fejl);
    }
  }
  return new Response(null, { status: 204 });
}
