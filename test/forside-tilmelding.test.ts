import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { forsidePerioder } from "@/lib/forside";
import { testDag } from "@/lib/kilder/test";
import { opsummer, timeserie } from "@/lib/pris/dag";
import type { Dagsvisning } from "@/lib/offentlig";

// dfpriser.dk/el som tilmeldingsside (Morten, 3/11-2026): kun morgendagens billigste tidspunkt for Øst- og
// Vestdanmark og formularen lige under. Resten får man i mailen.

const visning = async (omr: "DK1" | "DK2", dato: string): Promise<Dagsvisning> => {
  const slots = await testDag(omr, dato);
  return { dato, opsummering: opsummer(dato, slots), serie: timeserie(slots), testdata: true };
};

describe("forsidePerioder", () => {
  it("viser i morgen for begge områder, Øst først", async () => {
    const p = forsidePerioder({
      DK2: { idag: await visning("DK2", "2026-11-03"), imorgen: await visning("DK2", "2026-11-04") },
      DK1: { idag: await visning("DK1", "2026-11-03"), imorgen: await visning("DK1", "2026-11-04") },
    });
    expect(p.map((x) => [x.omraade, x.navn, x.hvornaar, x.dato])).toEqual([
      ["DK2", "Østdanmark", "I morgen", "2026-11-04"],
      ["DK1", "Vestdanmark", "I morgen", "2026-11-04"],
    ]);
    expect(p[0].tid).toMatch(/^kl\. \d{2}(\.\d{2})?–\d{2}(\.\d{2})?$/);
    expect(p[0].gennemsnit).toMatch(/^\d+ øre\/kWh i gennemsnit$/);
  });

  it("falder tilbage til i dag, når morgendagens priser ikke er offentliggjort endnu", async () => {
    const p = forsidePerioder({
      DK2: { idag: await visning("DK2", "2026-11-03"), imorgen: null },
      DK1: { idag: await visning("DK1", "2026-11-03"), imorgen: await visning("DK1", "2026-11-04") },
    });
    expect(p.map((x) => [x.omraade, x.hvornaar])).toEqual([
      ["DK2", "I dag"],
      ["DK1", "I morgen"],
    ]);
  });

  it("udelader et område uden kendte priser og giver en tom liste, når intet er kendt", async () => {
    expect(forsidePerioder({ DK2: { idag: null, imorgen: null }, DK1: { idag: await visning("DK1", "2026-11-03"), imorgen: null } }).map((x) => x.omraade)).toEqual(["DK1"]);
    expect(forsidePerioder({ DK2: { idag: null, imorgen: null }, DK1: { idag: null, imorgen: null } })).toEqual([]);
  });

  it("markerer testdata, så de aldrig kan forveksles med rigtige priser", async () => {
    const p = forsidePerioder({ DK2: { idag: null, imorgen: await visning("DK2", "2026-11-04") }, DK1: { idag: null, imorgen: null } });
    expect(p[0].testdata).toBe(true);
  });
});

describe("selve siden", () => {
  const side = readFileSync("app/page.tsx", "utf8");

  it("har formularen og de to områders billigste tidspunkt", () => {
    expect(side).toContain("<Tilmeldingsformular");
    expect(side).toContain("forsidePerioder(");
    expect(side).toContain("offentligeDage(\"DK2\"");
    expect(side).toContain("offentligeDage(\"DK1\"");
  });

  it("viser ikke længere faner, postnummersøgning, grafer, prognose eller regneeksempel", () => {
    for (const t of ["gemtePrognoser", "Prisgraf", "faner", "postnummer", "besparelseKr", "PRAEMISSE_PROGNOSE", "Prognose"]) {
      expect(side, t).not.toContain(t);
    }
  });

  it("har ingen overskrift formuleret som spørgsmål", () => {
    const overskrifter = side.match(/<h2>[^<]*<\/h2>/g) ?? [];
    expect(overskrifter.length).toBeGreaterThan(0);
    for (const h of overskrifter) expect(h).not.toMatch(/\?["<]/);
  });

  it("lover ikke længere en prognose i sidens beskrivelse", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    expect(layout).not.toContain("prognose for de to følgende dage");
  });
});
