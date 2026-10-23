import { cookies } from "next/headers";
import { hentDb } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { ADMIN_COOKIE, adminCookieVaerdi, adminKodeRigtig } from "@/lib/admin";
import { klientIp, laesFelter } from "@/lib/http";
import { rateNoegle } from "@/lib/tokens";

export async function POST(req: Request) {
  const db = hentDb();
  const noegle = rateNoegle("ip", `admin:${klientIp(req)}`);
  const [{ n }] = await db.query<{ n: number }>(
    `select count(*)::int as n from ratebegraensning where noegle = $1 and tidspunkt > now() - interval '15 minutes'`,
    [noegle],
  );
  if (n >= 8) return new Response("For mange forsøg. Vent et kvarter.", { status: 429 });
  await db.query(`insert into ratebegraensning (noegle) values ($1)`, [noegle]);
  const { kode } = await laesFelter(req);
  if (!adminKodeRigtig(String(kode ?? ""))) return Response.redirect(`${appUrl()}/admin?fejl=1`, 303);
  (await cookies()).set(ADMIN_COOKIE, adminCookieVaerdi(), {
    httpOnly: true,
    secure: appUrl().startsWith("https://"),
    sameSite: "strict",
    path: "/admin",
    maxAge: 8 * 3600,
  });
  return Response.redirect(`${appUrl()}/admin`, 303);
}
