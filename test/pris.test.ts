import { describe, expect, it } from "vitest";
import { besparelseKr, dkkMwhTilOereKwh, erFuldDag, opsummer, timeserie, vinduer } from "@/lib/pris/dag";
import { kroner, oere, periodeTekst } from "@/lib/pris/format";
import type { Slot } from "@/lib/pris/typer";
import { dagensGraenser } from "@/lib/tid";

/** Hjælper: et helt døgn med en pris pr. interval givet af funktionen f(indeks, start). */
function dag(dato: string, minutter: 15 | 60, f: (i: number, start: Date) => number): Slot[] {
  const { start, slut } = dagensGraenser(dato);
  const ud: Slot[] = [];
  for (let t = start.getTime(), i = 0; t < slut.getTime(); t += minutter * 60_000, i++) {
    ud.push({ start: new Date(t), minutter, oerePrKwh: f(i, new Date(t)) });
  }
  return ud;
}

describe("enheder", () => {
  it("1000 DKK/MWh er 100 øre/kWh", () => {
    expect(dkkMwhTilOereKwh(1000)).toBe(100);
    expect(dkkMwhTilOereKwh(-250)).toBe(-25);
  });
});

describe("fuldstændigt døgn", () => {
  it("accepterer 96 kvarterer, 92 på forårsdøgnet og 100 på efterårsdøgnet", () => {
    expect(erFuldDag("2026-06-15", dag("2026-06-15", 15, () => 50))).toMatchObject({ fuld: true, antal: 96 });
    expect(erFuldDag("2026-03-29", dag("2026-03-29", 15, () => 50))).toMatchObject({ fuld: true, antal: 92 });
    expect(erFuldDag("2026-10-25", dag("2026-10-25", 15, () => 50))).toMatchObject({ fuld: true, antal: 100 });
    expect(erFuldDag("2026-06-15", dag("2026-06-15", 60, () => 50))).toMatchObject({ fuld: true, antal: 24 });
  });

  it("afviser huller, dobbeltrækker, manglende slutning og ugyldige priser", () => {
    const fuld = dag("2026-06-15", 15, () => 50);
    expect(erFuldDag("2026-06-15", fuld.filter((_, i) => i !== 40)).fuld).toBe(false);
    expect(erFuldDag("2026-06-15", [...fuld, fuld[3]]).fuld).toBe(false);
    expect(erFuldDag("2026-06-15", fuld.slice(0, 90)).fuld).toBe(false);
    expect(erFuldDag("2026-06-15", fuld.slice(2)).fuld).toBe(false);
    expect(erFuldDag("2026-06-15", []).fuld).toBe(false);
    const nan = fuld.map((s, i) => (i === 5 ? { ...s, oerePrKwh: NaN } : s));
    expect(erFuldDag("2026-06-15", nan).fuld).toBe(false);
    // et sommerdøgn med vinterdøgnets antal er forkert
    expect(erFuldDag("2026-03-29", dag("2026-03-30", 15, () => 50).slice(0, 96)).fuld).toBe(false);
  });
});

describe("billigste og dyreste tretimersperiode", () => {
  it("finder vinduerne i et kendt mønster (kvarterer)", () => {
    // Billigt kl. 12–15 (10 øre), dyrt kl. 18–21 (200 øre), ellers 100.
    const slots = dag("2026-06-15", 15, (_, s) => {
      const t = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hourCycle: "h23" }).format(s));
      return t >= 12 && t < 15 ? 10 : t >= 18 && t < 21 ? 200 : 100;
    });
    const { billigste, dyreste } = vinduer(slots);
    expect(periodeTekst(billigste)).toBe("Kl. 12–15");
    expect(periodeTekst(dyreste)).toBe("Kl. 18–21");
    expect(billigste.gennemsnit).toBe(10);
    expect(dyreste.gennemsnit).toBe(200);
    const o = opsummer("2026-06-15", slots);
    expect(o.forskel).toBe(190);
    expect(besparelseKr(o, 10)).toBeCloseTo(19, 10);
    expect(o.laveste).toBe(10);
    expect(o.hoeyeste).toBe(200);
  });

  it("vinduet kan starte på et kvarter, og tre timer er altid tolv kvarterer – også på skiftedøgn", () => {
    const slots = dag("2026-10-25", 15, (i) => (i >= 33 && i < 45 ? 1 : 100)); // kvarter 33..44
    const { billigste } = vinduer(slots);
    expect(billigste.slut.getTime() - billigste.start.getTime()).toBe(3 * 3_600_000);
    expect(billigste.gennemsnit).toBe(1);
    expect(periodeTekst(billigste)).toMatch(/^Kl\. \d\d\.\d\d–\d\d\.\d\d$/);
  });

  it("ved lige pris vinder det tidligste vindue, og negative priser håndteres", () => {
    const flad = dag("2026-06-15", 60, () => 42);
    expect(vinduer(flad).billigste.start.getTime()).toBe(flad[0].start.getTime());
    const neg = dag("2026-06-15", 60, (i) => (i === 13 ? -50 : 20));
    const o = opsummer("2026-06-15", neg);
    expect(o.laveste).toBe(-50);
    expect(o.billigste.gennemsnit).toBeCloseTo((20 + -50 + 20) / 3, 10);
  });

  it("nægter at opsummere et ufuldstændigt døgn", () => {
    expect(() => opsummer("2026-06-15", dag("2026-06-15", 15, () => 1).slice(0, 50))).toThrow(/ikke fuldstændigt/);
  });
});

describe("timeserie og formatering", () => {
  it("samler kvarterer til timer", () => {
    const t = timeserie(dag("2026-06-15", 15, (i) => i));
    expect(t).toHaveLength(24);
    expect(t[0].oerePrKwh).toBeCloseTo(1.5, 10);
  });
  it("dansk talformat", () => {
    expect(oere(52.34)).toBe("52,3");
    expect(oere(-3.04)).toBe("−3,0");
    expect(kroner(14.2)).toBe("14,20");
  });
});
