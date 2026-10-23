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

export function klientIp(req: Request): string {
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
