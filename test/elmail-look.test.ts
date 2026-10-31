import { describe, expect, it } from "vitest";
import { elprisMail, EMNE } from "@/lib/mail/skabeloner";
import { testDag } from "@/lib/kilder/test";
import { opsummer, timeserie } from "@/lib/pris/dag";

describe("elmailen i samme udtryk som benzinmailen (Mike Kaltoft 30/10-2026)", async () => {
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
  it("logo med »Dagens elpriser« ved siden af", () => {
    expect(mail.html).toContain('src="https://h/mail/df-logo.png"');
    expect(mail.html).toContain(">Dagens elpriser</td>");
  });
  it("STOP-knappen står der stadig", () => {
    expect(mail.html).toContain("STOP modtagelse af dette nyhedsbrev");
    expect(mail.text).toContain("STOP modtagelse af dette nyhedsbrev: https://h/stop");
  });
});
