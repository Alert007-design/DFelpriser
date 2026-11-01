// Opgave 8 (del 2): den lukkede læseadresse /el/api/opslag-data, som DFpriser bruger til elopslaget på Facebook.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import { hentSlots } from "@/lib/pris/lager";
import { opsummer, VINDUE_MINUTTER } from "@/lib/pris/dag";
import { indsaetTestpriser, indsaetTilmeldt, nyDb } from "./hjaelp";

const delt = vi.hoisted(() => ({ db: undefined as unknown as Db }));
vi.mock("@/lib/db", () => ({ hentDb: () => delt.db }));

const { opslagData } = await import("@/lib/opslagdata");
const route = await import("@/app/api/opslag-data/route");

// Mandag 2. november 2026, 17.00 dansk tid (vintertid) = 16.00 UTC. I morgen er tirsdag 3. november.
const NU = new Date("2026-11-02T16:00:00Z");
const LIVE = "energidataservice:DayAheadPrices";

let db: Db & { pg: import("@electric-sql/pglite").PGlite };
beforeEach(async () => {
  db = await nyDb();
  delt.db = db;
});
afterEach(() => {
  delete process.env.OPSLAG_NOEGLE;
  delete process.env.PROXY_NOEGLE;
  vi.useRealTimers();
});

const rigtigePriser = async () => {
  await indsaetTestpriser(db, "2026-11-02", "2026-11-03");
  await db.query(`update spotpriser set kilde = $1`, [LIVE]);
};

describe("opslagData", () => {
  it("giver morgendagens billigste periode for begge områder, regnet på samme måde som i mailen", async () => {
    await rigtigePriser();
    const d = await opslagData(db, NU);
    expect(d.dato).toBe("2026-11-02");
    expect(d.imorgen).toBe("2026-11-03");
    expect(d.vindueMinutter).toBe(VINDUE_MINUTTER);
    for (const omr of ["DK1", "DK2"] as const) {
      const forventet = opsummer("2026-11-03", await hentSlots(db, omr, "2026-11-03")).billigste;
      expect(d.omraader[omr]).toMatchObject({ fuldstaendig: true, testdata: false });
      expect(d.omraader[omr].billigste).toEqual({
        start: forventet.start.toISOString(),
        slut: forventet.slut.toISOString(),
        gennemsnitOere: forventet.gennemsnit,
      });
    }
    expect(d.omraader.DK1.billigste).not.toEqual(d.omraader.DK2.billigste);
  });

  it("testpriser udleveres ikke som tal og er mærket testdata", async () => {
    await indsaetTestpriser(db, "2026-11-02", "2026-11-03"); // kilde TESTDATA
    const d = await opslagData(db, NU);
    expect(d.omraader.DK1).toMatchObject({ testdata: true, billigste: null });
    expect(d.omraader.DK2).toMatchObject({ testdata: true, billigste: null });
  });

  it("et ufuldstændigt døgn giver ingen tal og en årsag", async () => {
    await rigtigePriser();
    await db.query(`delete from spotpriser where omraade = 'DK1' and start_utc = (select max(start_utc) from spotpriser where omraade = 'DK1')`);
    const d = await opslagData(db, NU);
    expect(d.omraader.DK1).toMatchObject({ fuldstaendig: false, billigste: null });
    expect(d.omraader.DK1.aarsag).toBeTruthy();
    expect(d.omraader.DK2.fuldstaendig).toBe(true);
  });

  it("uden priser for i morgen er begge områder ufuldstændige", async () => {
    const d = await opslagData(db, NU);
    expect(d.omraader.DK1).toMatchObject({ fuldstaendig: false, billigste: null, testdata: false });
    expect(d.omraader.DK2).toMatchObject({ fuldstaendig: false, billigste: null });
  });

  it("viser dagens udsendelsesstatus pr. område, eller 'ingen'", async () => {
    await rigtigePriser();
    expect((await opslagData(db, NU)).omraader.DK1.udsendelse).toBe("ingen");
    await db.query(`insert into udsendelser (dato, omraade, status, afsluttet) values ('2026-11-02', 'DK1', 'faerdig', now()), ('2026-11-02', 'DK2', 'i_gang', null)`);
    // en gårsdagens række tæller ikke
    await db.query(`insert into udsendelser (dato, omraade, status, afsluttet) values ('2026-11-01', 'DK2', 'faerdig', now())`);
    const d = await opslagData(db, NU);
    expect(d.omraader.DK1.udsendelse).toBe("faerdig");
    expect(d.omraader.DK2.udsendelse).toBe("i_gang");
  });

  it("oplyser, om tilmeldingen er åben (JURA_GODKENDT), så opslaget ikke inviterer til noget, der ikke virker", async () => {
    process.env.JURA_GODKENDT = "ja";
    expect((await opslagData(db, NU)).tilmeldingAaben).toBe(true);
    process.env.JURA_GODKENDT = "nej";
    expect((await opslagData(db, NU)).tilmeldingAaben).toBe(false);
    delete process.env.JURA_GODKENDT;
    expect((await opslagData(db, NU)).tilmeldingAaben).toBe(false);
    process.env.JURA_GODKENDT = "ja";
  });

  it("indeholder ingen oplysninger om personer", async () => {
    await rigtigePriser();
    await indsaetTilmeldt(db, { email: "hemmelig.person@eksempel.dk", postnummer: "2100" });
    const json = JSON.stringify(await opslagData(db, NU));
    expect(json).not.toContain("hemmelig");
    expect(json).not.toContain("eksempel.dk");
    expect(json).not.toContain("2100");
  });

  it("bruger dansk dato: lige efter dansk midnat er 'i morgen' dagen efter", async () => {
    const d = await opslagData(db, new Date("2026-11-02T23:30:00Z")); // 00.30 den 3/11
    expect(d.dato).toBe("2026-11-03");
    expect(d.imorgen).toBe("2026-11-04");
  });
});

describe("ruten /el/api/opslag-data", () => {
  const kald = (headers: Record<string, string> = {}) => route.GET(new Request("https://dfelpriser.vercel.app/el/api/opslag-data", { headers }));
  const med = (noegle: string) => ({ authorization: `Bearer ${noegle}` });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NU);
  });

  it("afviser kald uden nøgle, med forkert nøgle og når OPSLAG_NOEGLE ikke er sat", async () => {
    expect((await kald()).status).toBe(401);
    expect((await kald(med("noget"))).status).toBe(401);
    process.env.OPSLAG_NOEGLE = "hemmelig-opslagsnoegle";
    expect((await kald()).status).toBe(401);
    expect((await kald(med("forkert-opslagsnoegle"))).status).toBe(401);
    expect((await kald({ authorization: "hemmelig-opslagsnoegle" })).status).toBe(401);
  });

  it("er ikke åben for den nøgle, dfpriser.dk sender med alle kald til /el (PROXY_NOEGLE)", async () => {
    process.env.OPSLAG_NOEGLE = "hemmelig-opslagsnoegle";
    process.env.PROXY_NOEGLE = "proxy-noegle";
    expect((await kald({ "x-df-proxy-noegle": "proxy-noegle", "x-df-klient-ip": "1.2.3.4" })).status).toBe(401);
    expect((await kald(med("proxy-noegle"))).status).toBe(401);
  });

  it("udleverer data med den rigtige nøgle og forbyder mellemlagring", async () => {
    process.env.OPSLAG_NOEGLE = "hemmelig-opslagsnoegle";
    await rigtigePriser();
    const r = await kald(med("hemmelig-opslagsnoegle"));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const d = await r.json();
    expect(d.imorgen).toBe("2026-11-03");
    expect(d.omraader.DK1.billigste.gennemsnitOere).toEqual(expect.any(Number));
  });

  it("svarer 503, når databasen fejler, uden at røbe hvorfor", async () => {
    process.env.OPSLAG_NOEGLE = "hemmelig-opslagsnoegle";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    delt.db = { query: async () => { throw new Error("hemmelig forbindelsesstreng"); } };
    const r = await kald(med("hemmelig-opslagsnoegle"));
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("hemmelig");
    log.mockRestore();
  });
});
