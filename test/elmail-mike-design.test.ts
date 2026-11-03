import { describe, expect, it } from "vitest";
import { elprisMail } from "@/lib/mail/skabeloner";
import { testDag } from "@/lib/kilder/test";
import { opsummer, timeserie } from "@/lib/pris/dag";
import type { DagsPrognose } from "@/lib/prognose/prognose";

// Elmailen i samme design som benzinmailen (Morten, 3/11-2026): grå baggrund, hvid blok, lyseblå header,
// ingen prognose for de næste dage og ingen "gratis service".

describe("elmailen i Mikes design", async () => {
  const slots = await testDag("DK2", "2026-11-03");
  const dag = opsummer("2026-11-03", slots);
  const links = {
    hjemmeside: "https://h/el", logo: "https://h/el/mail/df-logo.png", privatliv: "https://h/el/privatlivspolitik",
    stop: "https://h/el/afmeld?t=1", stopEtKlik: "https://h/el/api/afmeld?t=1", skiftPostnummer: "https://h/el/skift", slet: "https://h/el/slet?t=1",
  };
  const prognose: DagsPrognose = {
    dato: "2026-11-04", billigste: { startTime: 2, slutTime: 5 }, gennemsnit: 150, usikkerhed: "middel",
  } as unknown as DagsPrognose;
  const grund = {
    omraade: "DK2" as const, postnummer: "2920", dag, serie: timeserie(slots), seneste: [],
    typisk: { dage: 14, billigste: [{ startTime: 2, slutTime: 5 }], dyreste: { startTime: 17, slutTime: 20 } },
    prognose: null, dfBudskab: "Danmark har nogle af Europas højeste elpriser.", links,
  } as unknown as Parameters<typeof elprisMail>[0];
  const m = elprisMail(grund);
  const i = (t: string) => m.html.indexOf(t);

  it("har grå baggrund, hvid blok og lyseblå header med logo og titel", () => {
    expect(m.html).toContain('<body style="margin:0;padding:0;background-color:#f4f6fa" bgcolor="#f4f6fa">');
    expect(m.html).toContain('bgcolor="#D9EFFF"');
    expect(m.html).toContain('src="https://h/el/mail/df-logo.png"');
    expect(m.html).toContain(">Dagens elpriser</div>");
    expect(m.html).toContain("text-transform:uppercase");
    expect(m.html).toContain("Østdanmark · postnummer 2920");
    expect(i("df-logo.png")).toBeLessThan(i(">Dagens elpriser</div>"));
    expect(m.html).not.toContain("Georgia");
    expect(m.html).not.toContain("border-radius");
  });

  it("viser billigst og dyrest i hver sin boks, og grafen og sammenligningen bagefter", () => {
    expect(m.html.match(/class="boks"/g)).toHaveLength(2);
    expect(i(">Billigst</div>")).toBeLessThan(i(">Dyrest</div>"));
    expect(m.html).toContain("øre/kWh i gennemsnit");
    expect(i("Sammenlignet med de seneste dage")).toBeGreaterThan(i(">Dyrest</div>"));
  });

  it("har ingen prognose og ingen typiske tidsrum for de næste dage", () => {
    for (const t of ["Vi har ingen sikker prognose", "har strømmen i gennemsnit", "Onsdag og torsdag", "prognose"]) {
      expect(m.html).not.toContain(t);
      expect(m.text).not.toContain(t);
    }
    const medPrognose = elprisMail({ ...grund, prognose: { dage: [prognose], vurdering: { type: "ingen" } } } as unknown as Parameters<typeof elprisMail>[0]);
    expect(medPrognose.html).not.toContain("prognose");
    expect(medPrognose.html).not.toContain("Et bud, ikke kendte priser");
    expect(medPrognose.text.toLowerCase()).not.toContain("prognose");
  });

  it("har ikke linjen om gratis service, men beholder links, STOP og sletning", () => {
    expect(m.html.toLowerCase()).not.toContain("gratis service");
    expect(m.text.toLowerCase()).not.toContain("gratis service");
    expect(m.html).toContain("Du får mailen, fordi du har tilmeldt dig og bekræftet det.");
    expect(m.html).toContain('href="https://h/el/skift"');
    expect(m.html).toContain('href="https://h/el/privatlivspolitik"');
    expect(m.html).toContain("STOP modtagelse af dette nyhedsbrev");
    expect(m.html).toContain('href="https://h/el/afmeld?t=1"');
    expect(m.html).toContain('href="https://h/el/slet?t=1"');
    expect(m.text).toContain("https://h/el/slet?t=1");
    expect(m.headers?.["List-Unsubscribe"]).toBe("<https://h/el/api/afmeld?t=1>");
  });

  it("viser den politiske tekst, når den er med, og forbeholdet om spotpris", () => {
    expect(m.html).toContain("Fra Dansk Folkeparti");
    expect(m.html).toContain("Danmark har nogle af Europas højeste elpriser.");
    expect(m.html).toContain("Kun spotprisen før moms.");
    const uden = elprisMail({ ...grund, dfBudskab: undefined });
    expect(uden.html).not.toContain("Fra Dansk Folkeparti");
  });
});
