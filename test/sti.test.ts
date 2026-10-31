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
    }
  });
  it("cron-adresserne og omskrivningen af gamle adresser står i vercel.json", () => {
    const v = JSON.parse(readFileSync("vercel.json", "utf8"));
    for (const c of v.crons) expect(c.path.startsWith("/el/api/cron/")).toBe(true);
    expect(v.rewrites).toContainEqual({ source: "/", destination: "/el" });
  });
});
