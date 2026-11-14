// Ugens tal til storyen »Den seneste uge« (Morten 14/11-2026): gennemsnitlig forskel mellem dagens dyreste og billigste time.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import { hentSlots } from "@/lib/pris/lager";
import { timeserie } from "@/lib/pris/dag";
import { indsaetTestpriser, nyDb } from "./hjaelp";

const delt = vi.hoisted(() => ({ db: undefined as unknown as Db }));
vi.mock("@/lib/db", () => ({ hentDb: () => delt.db }));
const { opslagData, ugeTal } = await import("@/lib/opslagdata");

// Søndag 15. november 2026 kl. 18.00 dansk tid. Ugen er 8.–14. november.
const NU = new Date("2026-11-15T17:00:00Z");
const LIVE = "energidataservice:DayAheadPrices";
let db: Db;
beforeEach(async () => {
  db = await nyDb();
  delt.db = db;
});

describe("ugeTal", () => {
  it("regner gennemsnittet af (dyreste time − billigste time) over de syv dage før i dag", async () => {
    await indsaetTestpriser(db, "2026-11-08", "2026-11-14");
    await db.query(`update spotpriser set kilde = $1`, [LIVE]);
    let sum = 0;
    for (const dag of ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]) {
      const t = timeserie(await hentSlots(db, "DK2", dag)).map((x) => x.oerePrKwh);
      sum += Math.max(...t) - Math.min(...t);
    }
    const u = await ugeTal(db, "DK2", "2026-11-15");
    expect(u.dage).toBe(7);
    expect(u.fra).toBe("2026-11-08");
    expect(u.til).toBe("2026-11-14");
    expect(u.gnsForskelOere).toBeCloseTo(sum / 7, 6);
  });
  it("giver intet tal med færre end fem hele dage", async () => {
    await indsaetTestpriser(db, "2026-11-11", "2026-11-14");
    await db.query(`update spotpriser set kilde = $1`, [LIVE]);
    const u = await ugeTal(db, "DK1", "2026-11-15");
    expect(u.dage).toBe(4);
    expect(u.gnsForskelOere).toBeNull();
  });
  it("tæller aldrig dage med testpriser med", async () => {
    await indsaetTestpriser(db, "2026-11-08", "2026-11-14");
    const u = await ugeTal(db, "DK1", "2026-11-15");
    expect(u.dage).toBe(0);
    expect(u.gnsForskelOere).toBeNull();
  });
  it("står i svaret til dfpriser.dk og mrmesserschmidt.dk", async () => {
    await indsaetTestpriser(db, "2026-11-08", "2026-11-14");
    await db.query(`update spotpriser set kilde = $1`, [LIVE]);
    const d = await opslagData(db, NU);
    expect(d.uge.DK1.dage).toBe(7);
    expect(d.uge.DK2.gnsForskelOere).toBeGreaterThan(0);
  });
});
