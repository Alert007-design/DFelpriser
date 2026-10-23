import { cookies } from "next/headers";
import { appUrl } from "@/lib/config";
import { ADMIN_COOKIE } from "@/lib/admin";

export async function POST() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  return Response.redirect(`${appUrl()}/admin`, 303);
}
