import { describe, expect, it } from "vitest";
import { energiDataService, lavUrl, tolkSvar } from "@/lib/kilder/energidataservice";
import { omraadeForPostnummer } from "@/lib/omraade";
import { dagensGraenser } from "@/lib/tid";
import { erFuldDag } from "@/lib/pris/dag";

function svarFor(dato: string, pris: (omr: string, i: number) => number | null, minutter = 15) {
  const { start, slut } = dagensGraenser(dato);
  const records = [];
  for (const omr of ["DK1", "DK2"]) {
    for (let t = start.getTime(), i = 0; t < slut.getTime(); t += minutter * 60_000, i++) {
      records.push({ TimeUTC: new Date(t).toISOString().slice(0, 19), PriceArea: omr, DayAheadPriceDKK: pris(omr, i) });
    }
  }
  return { total: records.length, records };
}

describe("Energi Data Service-tolkning", () => {
  const { start, slut } = dagensGraenser("2026-10-24");

  it("omregner DKK/MWh til øre/kWh og giver et fuldstændigt døgn pr. område", () => {
    const ud = tolkSvar(svarFor("2026-10-24", (o, i) => (o === "DK1" ? 500 : 800 + i)), start, slut, "x");
    expect(ud.DK1).toHaveLength(96);
    expect(ud.DK1[0].oerePrKwh).toBe(50);
    expect(ud.DK2[3].oerePrKwh).toBe(80.3);
    expect(erFuldDag("2026-10-24", ud.DK1).fuld).toBe(true);
    expect(erFuldDag("2026-10-24", ud.DK2).fuld).toBe(true);
  });

  it("tåler timepriser og filtrerer andre døgn fra", () => {
    const ud = tolkSvar(svarFor("2026-10-24", () => 100, 60), start, slut, "x");
    expect(ud.DK1).toHaveLength(24);
    expect(ud.DK1[0].minutter).toBe(60);
  });

  it("kaster ved manglende pris, forkert format eller dobbeltrækker – i stedet for at gætte", () => {
    expect(() => tolkSvar(svarFor("2026-10-24", (_o, i) => (i === 10 ? null : 1)), start, slut, "x")).toThrow(/Pris mangler/);
    expect(() => tolkSvar({ fejl: "x" }, start, slut, "x")).toThrow(/records/);
    const dobbelt = svarFor("2026-10-24", () => 1);
    dobbelt.records.push(dobbelt.records[0]);
    expect(() => tolkSvar(dobbelt, start, slut, "x")).toThrow(/Dobbelt/);
    const forkert = svarFor("2026-10-24", () => 1);
    (forkert.records[0] as Record<string, unknown>).DayAheadPriceDKK = "12";
    expect(() => tolkSvar(forkert, start, slut, "x")).toThrow(/Pris mangler/);
  });

  it("et delvist døgn (kun nogle kvarterer) er ikke fuldstændigt", () => {
    const halv = svarFor("2026-10-24", () => 1);
    halv.records = halv.records.filter((r) => r.PriceArea !== "DK2" || r.TimeUTC < "2026-10-24T10:00:00");
    const ud = tolkSvar(halv, start, slut, "x");
    expect(erFuldDag("2026-10-24", ud.DK2).fuld).toBe(false);
  });

  it("bygger URL med de forventede parametre", () => {
    const u = new URL(lavUrl(start, slut));
    expect(u.origin + u.pathname).toBe("https://api.energidataservice.dk/dataset/DayAheadPrices");
    expect(u.searchParams.get("filter")).toBe('{"PriceArea":["DK1","DK2"]}');
    expect(u.searchParams.get("columns")).toBe("TimeUTC,PriceArea,DayAheadPriceDKK");
  });

  it("forsøger igen ved 5xx og giver endelig fejl ved 4xx", async () => {
    let kald = 0;
    const kilde = energiDataService({
      hent: async () => {
        kald++;
        return kald < 3 ? new Response("", { status: 503 }) : Response.json(svarFor("2026-10-24", () => 100));
      },
    });
    const ud = await kilde.hent(start, slut);
    expect(kald).toBe(3);
    expect(ud.DK1).toHaveLength(96);

    let k2 = 0;
    const d4 = energiDataService({ hent: async () => (k2++, new Response("", { status: 404 })) });
    await expect(d4.hent(start, slut)).rejects.toThrow(/404/);
    expect(k2).toBe(1);
  }, 20000);
});

describe("elprisområde ud fra postnummer", () => {
  it("Sjælland, Lolland-Falster og Bornholm er DK2", () => {
    for (const p of ["1050", "2100", "3000", "3700", "4000", "4700", "4800", "4990"]) expect(omraadeForPostnummer(p)).toBe("DK2");
  });
  it("Fyn og Jylland er DK1", () => {
    for (const p of ["5000", "5900", "5970", "6000", "8000", "8305", "9000", "9940"]) expect(omraadeForPostnummer(p)).toBe("DK1");
  });
  it("afviser ugyldige og ikke-danske-elnet-numre", () => {
    for (const p of ["", "123", "12345", "abcd", "0800", "3900", "3800"]) expect(omraadeForPostnummer(p)).toBeNull();
  });
});
