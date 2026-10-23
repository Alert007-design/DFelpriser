import { describe, expect, it } from "vitest";
import { analyser, rapport, type Dagsdata } from "@/lib/analyse";
import { testDag } from "@/lib/kilder/test";
import { laegDage } from "@/lib/tid";

// Mekanikken testes med TESTDATA (opdigtede priser). Resultaterne er ikke analysen af virkeligheden.
describe("historisk analyse", () => {
  it("beregner alle fem målinger og afviser huller", async () => {
    const data: Dagsdata = { DK1: {}, DK2: {} };
    const fra = "2026-06-01";
    for (let i = 0; i < 100; i++) {
      const d = laegDage(fra, i);
      data.DK1[d] = await testDag("DK1", d);
      data.DK2[d] = await testDag("DK2", d);
    }
    data.DK1[laegDage(fra, 10)] = data.DK1[laegDage(fra, 10)].slice(5); // hul: døgnet udelades
    const a = analyser(data, fra, laegDage(fra, 99));
    expect(a.pr_omraade.DK1.dage).toBe(99);
    expect(a.pr_omraade.DK2.dage).toBe(100);
    for (const omr of ["DK1", "DK2"] as const) {
      const p = a.pr_omraade[omr];
      expect(p.forskel.gennemsnit).toBeGreaterThan(0);
      expect(p.besparelse[20].gennemsnit).toBeCloseTo(p.besparelse[10].gennemsnit * 2, 6);
      expect(p.besparelse[10].gennemsnit).toBeCloseTo(p.besparelse[5].gennemsnit * 2, 6);
      expect(p.skifterStart).toBeGreaterThanOrEqual(0);
      expect(p.udfald[1]!.model.dage).toBeGreaterThan(45);
    }
    expect(a.forskelligBilligstePeriode.dage).toBe(99);
    const tekst = rapport(a, "TESTDATA");
    expect(tekst).toContain("## DK1");
    expect(tekst).toContain("3. På 99 fælles døgn");
    expect(tekst).toContain("| 10 kWh |");
  }, 60000);
});
