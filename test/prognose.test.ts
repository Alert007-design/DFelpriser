import { describe, expect, it } from "vitest";
import { erHelligdag } from "@/lib/prognose/kalender";
import { billigsteVindue, forudsig, lokalTimeprofil, type Historik, type Timeprofil } from "@/lib/prognose/model";
import { lavPrognose, maaVisePrognose, vurderBilligsteDag } from "@/lib/prognose/prognose";
import { bestaarKrav, tilbageskuendeTest } from "@/lib/prognose/evaluering";
import { laegDage } from "@/lib/tid";
import { dagensGraenser } from "@/lib/tid";

function rng(frø: number) {
  let a = frø;
  const u = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
}

/** Opdigtet historik: fast døgnforløb + tilfældigt dagsniveau + timestøj. Kun til test af mekanikken. */
function opdigtetHistorik(fra: string, dage: number, opt: { niveauStoej: number; timeStoej: number; ugentlig?: boolean }): Historik {
  const n = rng(42);
  const form: Timeprofil = Array.from({ length: 24 }, (_, t) => 40 * Math.exp(-(((t - 19) / 2) ** 2)) - 30 * Math.exp(-(((t - 13) / 3) ** 2)));
  const h: Historik = new Map();
  for (let i = 0; i < dage; i++) {
    const d = laegDage(fra, i);
    const niveau = opt.ugentlig ? 80 + 10 * Math.sin((2 * Math.PI * i) / 7) : 80 + opt.niveauStoej * n();
    h.set(d, form.map((f) => niveau + f + (opt.ugentlig ? 0 : opt.timeStoej * n())));
  }
  return h;
}

describe("kalender", () => {
  it("kender de danske helligdage", () => {
    expect(erHelligdag("2026-04-05")).toBe(true); // påskedag 2026
    expect(erHelligdag("2026-04-03")).toBe(true); // langfredag
    expect(erHelligdag("2026-05-14")).toBe(true); // Kristi himmelfart
    expect(erHelligdag("2026-12-25")).toBe(true);
    expect(erHelligdag("2026-10-23")).toBe(false);
  });
});

describe("timeprofil og vindue", () => {
  it("udjævner sommer- og vintertid til 24 værdier", () => {
    for (const dato of ["2026-03-29", "2026-10-25", "2026-06-15"]) {
      const { start, slut } = dagensGraenser(dato);
      const slots = [];
      for (let t = start.getTime(); t < slut.getTime(); t += 15 * 60_000) slots.push({ start: new Date(t), minutter: 15, oerePrKwh: 50 });
      const p = lokalTimeprofil(slots);
      expect(p).toHaveLength(24);
      expect(p.every((v) => v === 50)).toBe(true);
    }
  });
  it("billigste tretimersvindue", () => {
    const p = Array.from({ length: 24 }, (_, t) => (t >= 11 && t < 14 ? 1 : 10));
    expect(billigsteVindue(p)).toEqual({ start: 11, gennemsnit: 1 });
  });
});

describe("prognosemodellen", () => {
  const h = opdigtetHistorik("2026-01-01", 200, { niveauStoej: 20, timeStoej: 5 });
  const kendt = laegDage("2026-01-01", 199);

  it("giver 24 timeværdier og bruger kun data til og med den kendte dag (ingen kig ind i fremtiden)", () => {
    const a = forudsig(h, kendt, laegDage(kendt, 1))!;
    expect(a).toHaveLength(24);
    const h2 = new Map(h);
    h2.set(laegDage(kendt, 1), Array(24).fill(9999)); // 'facit' ændres – prognosen må ikke ændre sig
    h2.set(laegDage(kendt, 2), Array(24).fill(-9999));
    expect(forudsig(h2, kendt, laegDage(kendt, 1))).toEqual(a);
  });

  it("gætter ikke ved for lidt data", () => {
    const lille = opdigtetHistorik("2026-01-01", 10, { niveauStoej: 20, timeStoej: 5 });
    expect(forudsig(lille, laegDage("2026-01-01", 9), laegDage("2026-01-01", 10))).toBeNull();
    expect(lavPrognose(lille, laegDage("2026-01-01", 9))).toBeNull();
    expect(forudsig(h, "2025-01-01", "2025-01-02")).toBeNull();
  });

  it("giver en prognose med usikkerhed for dag 2 og dag 3", () => {
    const p = lavPrognose(h, kendt)!;
    expect(p.dage.map((d) => d.dato)).toEqual([laegDage(kendt, 1), laegDage(kendt, 2)]);
    for (const d of p.dage) {
      expect(d.gennemsnitInterval.lav).toBeLessThan(d.gennemsnit);
      expect(d.gennemsnitInterval.hoej).toBeGreaterThan(d.gennemsnit);
      expect(d.laveste).toBeLessThanOrEqual(d.hoeyeste);
      expect(d.billigste.slutTime - d.billigste.startTime).toBe(3);
      expect(["lav", "middel", "hoej"]).toContain(d.usikkerhed);
      expect(d.timeAfvigelse).toBeGreaterThan(0);
    }
    // formen er hentet fra historikken: billigst midt på dagen
    expect(p.dage[0].billigste.startTime).toBeGreaterThanOrEqual(10);
    expect(p.dage[0].billigste.startTime).toBeLessThanOrEqual(13);
  });

  it("frigiver prognosen kun, hvis modellen slår begge enkle metoder", () => {
    const godt = maaVisePrognose(h, kendt);
    expect(godt.tilladt).toBe(true);
    expect(godt.udfald[1]!.model.dage).toBeGreaterThanOrEqual(45);

    // En perfekt ugentlig rytme: 'samme ugedag sidste uge' er allerede perfekt, så modellen kan ikke slå den.
    const ugentlig = opdigtetHistorik("2026-01-01", 200, { niveauStoej: 0, timeStoej: 0, ugentlig: true });
    const slet = maaVisePrognose(ugentlig, laegDage("2026-01-01", 199));
    expect(slet.tilladt).toBe(false);
    expect(slet.begrundelse).toMatch(/sidste uge|sidste dag/);
  });

  it("frigiver ikke ved for få målte dage eller ingen data", () => {
    const kort = opdigtetHistorik("2026-01-01", 40, { niveauStoej: 20, timeStoej: 5 });
    expect(maaVisePrognose(kort, laegDage("2026-01-01", 39)).tilladt).toBe(false);
    expect(bestaarKrav(null).bestaaet).toBe(false);
    expect(tilbageskuendeTest(new Map(), "2026-01-01", "2026-02-01", 1)).toBeNull();
  });
});

describe("hvilken dag er billigst", () => {
  const prog = (dato: string, gns: number, spaend: number) =>
    ({ dato, gennemsnit: gns, gennemsnitInterval: { lav: gns - spaend, hoej: gns + spaend } }) as never;

  it("udpeger kun en vinder, når forskellen er større end usikkerheden", () => {
    const v = vurderBilligsteDag({ dato: "d1", gennemsnit: 40 }, [prog("d2", 80, 10), prog("d3", 90, 10)]);
    expect(v).toEqual({ type: "billigst", dato: "d1", sikker: true });
  });
  it("siger 'tæt løb', når intervallerne overlapper", () => {
    const v = vurderBilligsteDag({ dato: "d1", gennemsnit: 60 }, [prog("d2", 55, 20), prog("d3", 90, 10)]);
    expect(v.type).toBe("taet_loeb");
    if (v.type === "taet_loeb") expect(v.datoer).toEqual(["d1", "d2"]);
  });
});

describe("gemte prognoser", () => {
  it("læses både som objekt og som JSON-tekst, og ugyldige springes over", async () => {
    const { laesPrognoseData } = await import("@/lib/offentlig");
    const p = { dato: "2026-10-25", horisont: 1, gennemsnit: 71.5 };
    expect(laesPrognoseData(p)?.dato).toBe("2026-10-25");
    expect(laesPrognoseData(JSON.stringify(p))?.dato).toBe("2026-10-25");
    expect(laesPrognoseData("ikke json")).toBeNull();
    expect(laesPrognoseData(null)).toBeNull();
  });
});
