import { timingSafeEqual } from "node:crypto";
import { tilladteOrigins } from "../config";

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !tilladteOrigins().includes(origin.replace(/\/$/, ""))) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function laesFelter(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const data = await req.json().catch(() => ({}));
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  }
  if (type.includes("form")) {
    const form = await req.formData();
    return Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  }
  return {};
}

/**
 * Besøgendes IP til ratebegrænsning. Når siden vises gennem dfpriser.dk/el, kommer alle kald fra
 * dfpriser.dk's servere; derfor sender dfpriser.dk den rigtige IP med i x-df-klient-ip sammen med en fælles
 * nøgle (PROXY_NOEGLE i begge Vercel-projekter). Uden korrekt nøgle bruges x-forwarded-for som hidtil.
 */
export function klientIp(req: Request): string {
  const noegle = (process.env.PROXY_NOEGLE ?? "").trim();
  const sendt = req.headers.get("x-df-proxy-noegle") ?? "";
  const viaDfpriser = req.headers.get("x-df-klient-ip")?.trim();
  if (noegle && viaDfpriser && sendt.length === noegle.length && timingSafeEqual(Buffer.from(sendt), Buffer.from(noegle))) {
    return viaDfpriser;
  }
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "ukendt";
}

/** Vercel Cron sender "Authorization: Bearer <CRON_SECRET>". */
export function erCron(req: Request): boolean {
  const hemmelighed = process.env.CRON_SECRET;
  if (!hemmelighed) return false;
  const forventet = Buffer.from(`Bearer ${hemmelighed}`);
  const faktisk = Buffer.from(req.headers.get("authorization") ?? "");
  return forventet.length === faktisk.length && timingSafeEqual(forventet, faktisk);
}
