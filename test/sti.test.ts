import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sti } from "@/lib/sti";

const filer = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? filer(p) : /\.tsx?$/.test(f) ? [p] : [];
  });

describe("elpris-siden under /el (dfpriser.dk/el)", () => {
  it("sti sætter /el foran", () => {
    expect(sti("/")).toBe("/el");
    expect(sti("/api/tilmeld")).toBe("/el/api/tilmeld");
    expect(() => sti("api")).toThrow();
  });
  it("ingen sider har faste adresser uden /el i links, formularer, fetch eller billeder", () => {
    for (const f of filer("app")) {
      const s = readFileSync(f, "utf8");
      // <Link href="/..."> får selv /el foran og er derfor tilladt.
      expect(s, f).not.toMatch(/(?<!Link )(href|action|src)="\/(?!\/)/);
      expect(s, f).not.toMatch(/fetch\("\//);
      expect(s, f).not.toMatch(/(?<!Link )href=\{`\//);
      expect(s, f).not.toMatch(/href=\{PRIVATLIVSPOLITIK_STI\}/);
    }
  });
  it("cron-adresserne og omskrivningen af gamle adresser står i vercel.json", () => {
    const v = JSON.parse(readFileSync("vercel.json", "utf8"));
    for (const c of v.crons) expect(c.path.startsWith("/el/api/cron/")).toBe(true);
    expect(v.rewrites).toContainEqual({ source: "/", destination: "/el" });
  });
});

import { klientIp } from "@/lib/http";
describe("IP bag dfpriser.dk/el", () => {
  const req = (h: Record<string, string>) => new Request("https://x.test/el/api/tilmeld", { headers: h });
  it("bruger dfpriser.dk's oplysning om IP, når nøglen passer", () => {
    process.env.PROXY_NOEGLE = "hemmelig-noegle";
    expect(klientIp(req({ "x-forwarded-for": "76.76.21.1", "x-df-klient-ip": "1.2.3.4", "x-df-proxy-noegle": "hemmelig-noegle" }))).toBe("1.2.3.4");
  });
  it("ignorerer oplysningen med forkert eller manglende nøgle", () => {
    process.env.PROXY_NOEGLE = "hemmelig-noegle";
    expect(klientIp(req({ "x-forwarded-for": "5.6.7.8", "x-df-klient-ip": "1.2.3.4", "x-df-proxy-noegle": "forkert-noegle" }))).toBe("5.6.7.8");
    delete process.env.PROXY_NOEGLE;
    expect(klientIp(req({ "x-forwarded-for": "5.6.7.8", "x-df-klient-ip": "1.2.3.4", "x-df-proxy-noegle": "" }))).toBe("5.6.7.8");
  });
});
