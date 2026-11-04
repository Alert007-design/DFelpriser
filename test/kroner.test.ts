import { describe, expect, it } from "vitest";
import { elprisMail, kronerPrKwh } from "@/lib/mail/skabeloner";
import { testDag } from "@/lib/kilder/test";
import { opsummer, timeserie } from "@/lib/pris/dag";

describe("priser i kroner, som medierne skriver dem (Morten, 4/11-2026)", async () => {
  it("276 øre bliver 2,76 kr.", () => {
    expect(kronerPrKwh(276)).toBe("2,76");
    expect(kronerPrKwh(162.4)).toBe("1,62");
    expect(kronerPrKwh(99.5)).toBe("1,00");
    expect(kronerPrKwh(5)).toBe("0,05");
    expect(kronerPrKwh(-3)).toBe("−0,03");
    expect(kronerPrKwh(-0.2)).toBe("0,00");
  });

  const slots = await testDag("DK2", "2026-10-24");
  const mail = elprisMail({
    omraade: "DK2", postnummer: "2100", dag: opsummer("2026-10-24", slots), serie: timeserie(slots),
    seneste: [], typisk: null, prognose: null,
    links: { hjemmeside: "https://h", logo: "https://h/mail/df-logo.png", privatliv: "#", stop: "#", stopEtKlik: "#", skiftPostnummer: "#", slet: "#" },
  });
  it("mailen skriver kr. pr. kWh og aldrig øre", () => {
    expect(mail.html).toMatch(/\d,\d\d kr\. pr\. kWh i gennemsnit/);
    expect(mail.text).toMatch(/\(\d,\d\d kr\. pr\. kWh\)/);
    expect(mail.html).toContain("Kr. pr. kWh, kun spotpris.");
    // »gøre det her« i slettelinket må gerne stå der, så der søges kun efter øre som ord.
    expect(mail.html).not.toMatch(/(^|[^\p{L}])øre/iu);
    expect(mail.text).not.toMatch(/(^|[^\p{L}])øre/iu);
  });
});
