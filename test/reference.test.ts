import { describe, expect, it } from "vitest";
import { tidsrumTekst, typiskeTider } from "@/lib/pris/reference";
import type { Historik } from "@/lib/prognose/model";
import { laegDage } from "@/lib/tid";

/** OPDIGTET historik: samme døgnforløb hver dag, kun til test. */
function historik(tilDato: string, dage: number, profil: (t: number) => number): Historik {
  const h: Historik = new Map();
  for (let i = 0; i < dage; i++) h.set(laegDage(tilDato, -i), Array.from({ length: 24 }, (_, t) => profil(t) + i * 0.01));
  return h;
}

// Billigt om natten (kl. 2–5) og omkring middag (kl. 12–15), dyrest om aftenen (kl. 17–20).
const toDale = (t: number) => 150 - 60 * Math.exp(-(((t - 3) / 1.2) ** 2)) - 58 * Math.exp(-(((t - 13) / 1.2) ** 2)) + 60 * Math.exp(-(((t - 18) / 1.2) ** 2));
// Kun én billig periode midt på dagen.
const enDal = (t: number) => 150 - 80 * Math.exp(-(((t - 13) / 1.5) ** 2)) + 40 * Math.exp(-(((t - 18) / 1.5) ** 2));

describe("typiske billige og dyre tidsrum", () => {
  it("finder to adskilte billige tidsrum og det dyre, i tidsorden", () => {
    const r = typiskeTider(historik("2026-10-30", 20, toDale), "2026-10-30");
    expect(r).not.toBeNull();
    expect(r!.dage).toBe(14);
    expect(r!.billigste).toEqual([
      { startTime: 2, slutTime: 5 },
      { startTime: 12, slutTime: 15 },
    ]);
    expect(r!.dyreste).toEqual({ startTime: 17, slutTime: 20 });
  });

  it("nævner kun ét billigt tidsrum, når der kun er én tydelig dal", () => {
    const r = typiskeTider(historik("2026-10-30", 14, enDal), "2026-10-30");
    expect(r!.billigste).toHaveLength(1);
    expect(r!.billigste[0]).toEqual({ startTime: 12, slutTime: 15 });
  });

  it("bruger kun dage til og med den angivne dato", () => {
    const h = historik("2026-10-30", 14, enDal);
    h.set("2026-10-31", Array.from({ length: 24 }, (_, t) => (t === 0 ? -500 : 999)));
    const r = typiskeTider(h, "2026-10-30");
    expect(r!.billigste[0].startTime).toBe(12);
  });

  it("giver intet svar med færre end 7 fuldstændige dage", () => {
    expect(typiskeTider(historik("2026-10-30", 6, enDal), "2026-10-30")).toBeNull();
    expect(typiskeTider(new Map(), "2026-10-30")).toBeNull();
  });

  it("skriver tidsrum på dansk", () => {
    expect(tidsrumTekst({ startTime: 2, slutTime: 5 })).toBe("kl. 2–5");
    expect(tidsrumTekst({ startTime: 21, slutTime: 24 })).toBe("kl. 21–24");
  });
});
