import type { MetadataRoute } from "next";
import { erOffentlig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return erOffentlig() ? { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] } } : { rules: { userAgent: "*", disallow: "/" } };
}
