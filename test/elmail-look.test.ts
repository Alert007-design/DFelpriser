import { describe, expect, it } from "vitest";
import { elprisMail, EMNE } from "@/lib/mail/skabeloner";
import { testDag } from "@/lib/kilder/test";
import { opsummer, timeserie } from "@/lib/pris/dag";

describe("elmailen i samme udtryk som benzinmailen (Mike Kaltoft 2/11-2026)", async () => {
  const slots = await testDag("DK2", "2026-10-24");
  const mail = elprisMail({
    omraade: "DK2", postnummer: "2100", dag: opsummer("2026-10-24", slots), serie: timeserie(slots),
    seneste: [], typisk: null, prognose: null,
    links: { hjemmeside: "https://h", logo: "https://h/mail/df-logo.png", privatliv: "#", stop: "https://h/stop", stopEtKlik: "#", skiftPostnummer: "#", slet: "#" },
  });
  it("emnet afslører ikke tallene", () => {
    expect(mail.subject).toBe(EMNE);
    expect(EMNE).toBe("Dagens elpriser: Her bliver det billigst");
  });
  it("grå baggrund, lyseblå header med logo og »Dagens elpriser«, hvid blok", () => {
    expect(mail.html).toContain('src="https://h/mail/df-logo.png"');
    expect(mail.html).toContain("text-transform:uppercase\">Dagens elpriser</div>");
    expect(mail.html).toContain('<body style="margin:0;padding:0;background-color:#f4f6fa" bgcolor="#f4f6fa">');
    expect(mail.html).toContain('bgcolor="#D9EFFF"');
    expect(mail.html).toContain('bgcolor="#ffffff"');
    expect(mail.html).not.toContain("Georgia");
  });
  it("billigst, dyrest og graf – uden prognose og uden »gratis service«", () => {
    const b = mail.html.indexOf(">Billigst</div>");
    const dy = mail.html.indexOf(">Dyrest</div>");
    const g = mail.html.indexOf("Priserne time for time");
    expect(b).toBeGreaterThan(-1);
    expect(dy).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(dy);
    expect(mail.html).not.toContain("prognose");
    expect(mail.html.toLowerCase()).not.toContain("gratis service");
    expect(mail.text.toLowerCase()).not.toContain("gratis service");
  });
  it("STOP-knappen står der stadig", () => {
    expect(mail.html).toContain("STOP modtagelse af dette nyhedsbrev");
    expect(mail.text).toContain("STOP modtagelse af dette nyhedsbrev: https://h/stop");
  });
});
