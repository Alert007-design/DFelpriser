// Opgave 8 (del 1): anonym optælling af besøg og tilmeldinger fra Facebook-linket /el?fra=fb-el.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import { ELPRIS_SAMTYKKE } from "@/lib/samtykke";
import { tekstHash } from "@/lib/samtykke-bevis";
import { falskAfsender, nyDb, type FalskAfsender } from "./hjaelp";

const delt = vi.hoisted(() => ({ db: undefined as unknown as Db, afsender: undefined as unknown as FalskAfsender }));
vi.mock("@/lib/db", () => ({ hentDb: () => delt.db }));
vi.mock("@/lib/mail/afsender", () => ({ PORTION: 100, resendAfsender: () => delt.afsender }));

const { besoegKald, erKilde, fraMaerke, taelKilde, taelKildeStille } = await import("@/lib/facebook-kilde");
const { tilmeldingSkema } = await import("@/lib/validering");
const kildeRoute = await import("@/app/api/kilde/route");
const tilmeldRoute = await import("@/app/api/tilmeld/route");

const APP = "https://eksempel.test";
const kildetal = async (db: Db) =>
  (await db.query<{ kilde: string; type: string; antal: number }>(`select kilde, type, antal from kildetal order by kilde, type`)).map(
    (r) => `${r.kilde}/${r.type}=${r.antal}`,
  );

describe("tabellen kildetal", () => {
  let db: Db;
  beforeEach(async () => {
    db = await nyDb();
  });
  it("har kun dato, kilde, type og antal, og er lukket for Supabase' offentlige API", async () => {
    const kolonner = await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'kildetal' order by column_name`);
    expect(kolonner.map((k) => k.column_name)).toEqual(["antal", "dato", "kilde", "type"]);
    const [r] = await db.query<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where relname = 'kildetal'`);
    expect(r.relrowsecurity).toBe(true);
  });
  it("afviser ukendt kilde og ukendt type", async () => {
    const ind = (kilde: string, type: string) => db.query(`insert into kildetal (dato, kilde, type, antal) values ('2026-11-02', $1, $2, 1)`, [kilde, type]);
    await expect(ind("fb-benzin", "besoeg")).rejects.toThrow();
    await expect(ind("del", "besoeg")).rejects.toThrow();
    await expect(ind("fb-el", "side")).rejects.toThrow();
    await ind("fb-el", "besoeg");
  });
});

describe("mærket fra=", () => {
  it("kender kun fb-el", () => {
    expect(erKilde("fb-el")).toBe(true);
    for (const x of ["fb-benzin", "del", "FB-EL", "", null, undefined, 3]) expect(erKilde(x)).toBe(false);
  });
  it("læses fra adressen, og alt andet (fbclid osv.) ignoreres", () => {
    expect(fraMaerke("?fra=fb-el")).toBe("fb-el");
    expect(fraMaerke("?fbclid=abc&fra=fb-el")).toBe("fb-el");
    expect(fraMaerke("?fra=noget")).toBeUndefined();
    expect(fraMaerke("?fra=fb-benzin")).toBeUndefined();
    expect(fraMaerke("")).toBeUndefined();
  });
  it("besøgskaldet går til /el/api/kilde og indeholder kun mærket", () => {
    expect(besoegKald("?fra=fb-el&fbclid=hemmeligt")).toEqual({ sti: "/el/api/kilde", body: { kilde: "fb-el" } });
    expect(besoegKald("?fbclid=hemmeligt")).toBeNull();
    expect(besoegKald("?fra=andet")).toBeNull();
  });
  it("tilmeldingsskemaet tager imod fb-el og ignorerer alt andet", () => {
    const f = { email: "a@b.dk", postnummer: "2100", samtykke: true, samtykke_version: ELPRIS_SAMTYKKE.version, samtykke_hash: tekstHash(ELPRIS_SAMTYKKE.tekst) };
    expect(tilmeldingSkema.parse({ ...f, fra: "fb-el" }).fra).toBe("fb-el");
    expect(tilmeldingSkema.parse({ ...f, fra: "fb-benzin" }).fra).toBeUndefined();
    expect(tilmeldingSkema.parse({ ...f, fra: "<script>" }).fra).toBeUndefined();
    expect(tilmeldingSkema.parse(f).fra).toBeUndefined();
  });
});

describe("optælling", () => {
  let db: Db;
  beforeEach(async () => {
    db = await nyDb();
    delt.db = db;
  });
  const post = (body: unknown) => kildeRoute.POST(new Request(`${APP}/el/api/kilde`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

  it("lægger én til pr. dag, kilde og type, med dansk dato", async () => {
    await taelKilde(db, "fb-el", "besoeg", new Date("2026-11-02T10:00:00Z"));
    await taelKilde(db, "fb-el", "besoeg", new Date("2026-11-02T10:05:00Z"));
    await taelKilde(db, "fb-el", "tilmelding", new Date("2026-11-02T23:30:00Z")); // 00.30 dansk tid den 3/11
    const r = await db.query<{ dato: string; type: string; antal: number }>(`select dato::text, type, antal from kildetal order by dato`);
    expect(r).toEqual([
      { dato: "2026-11-02", type: "besoeg", antal: 2 },
      { dato: "2026-11-03", type: "tilmelding", antal: 1 },
    ]);
  });
  it("den stille udgave sluger en fejl, fx en manglende tabel", async () => {
    await db.query(`drop table kildetal`);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(taelKildeStille(db, "fb-el", "besoeg", new Date())).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
  it("/api/kilde tæller kun et besøg for fb-el og svarer altid 204", async () => {
    expect((await post({ kilde: "fb-el" })).status).toBe(204);
    expect((await post({ kilde: "fb-benzin" })).status).toBe(204);
    expect((await post({ kilde: "noget" })).status).toBe(204);
    expect((await post({ kilde: "fb-el", type: "tilmelding" })).status).toBe(204);
    expect((await post(null)).status).toBe(204);
    expect(await kildetal(db)).toEqual(["fb-el/besoeg=2"]);
  });
  it("/api/kilde svarer pænt, selv om databasen fejler", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    delt.db = { query: async () => { throw new Error("nede"); } };
    expect((await post({ kilde: "fb-el" })).status).toBe(204);
    log.mockRestore();
  });
});

describe("tilmelding via Facebook-link", () => {
  let db: Db;
  beforeEach(async () => {
    db = await nyDb();
    delt.db = db;
    delt.afsender = falskAfsender();
    process.env.JURA_GODKENDT = "ja";
    process.env.APP_URL = "https://eksempel.test";
  });
  const tilmeld = (ekstra: Record<string, unknown>, email = "ny@eksempel.dk") =>
    tilmeldRoute.POST(
      new Request(`${APP}/el/api/tilmeld`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.7" },
        body: JSON.stringify({ email, postnummer: "2100", samtykke: true, samtykke_version: ELPRIS_SAMTYKKE.version, samtykke_hash: tekstHash(ELPRIS_SAMTYKKE.tekst), ...ekstra }),
      }),
    );

  it("tæller en tilmelding med fra=fb-el", async () => {
    expect((await tilmeld({ fra: "fb-el" })).status).toBe(200);
    expect(await kildetal(db)).toEqual(["fb-el/tilmelding=1"]);
  });
  it("tæller ikke uden mærke, med ukendt mærke eller ved afvist tilmelding", async () => {
    await tilmeld({});
    await tilmeld({ fra: "fb-benzin" }, "to@eksempel.dk");
    expect((await tilmeld({ fra: "fb-el", postnummer: "0001" }, "tre@eksempel.dk")).status).toBe(400);
    expect(await kildetal(db)).toEqual([]);
  });
  it("gemmer intet om, at personen kom fra Facebook", async () => {
    await tilmeld({ fra: "fb-el" });
    const kolonner = (await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'tilmeldte'`)).map((r) => r.column_name);
    expect(kolonner).not.toContain("fra");
    expect(kolonner).not.toContain("kilde");
    expect(JSON.stringify(await db.query(`select * from tilmeldte`))).not.toContain("fb-el");
  });
  it("tilmeldingen går igennem, selv om optællingen fejler", async () => {
    await db.query(`drop table kildetal`);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await tilmeld({ fra: "fb-el" })).status).toBe(200);
    expect(await db.query(`select 1 from tilmeldte`)).toHaveLength(1);
    log.mockRestore();
  });
});
