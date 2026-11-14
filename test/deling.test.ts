// Send elpris-mailen videre til en ven (Morten 14/11-2026).
import { describe, expect, it } from "vitest";
import { DEL_BESKED_TEKST, DEL_MAIL_TEKST, delBesked, delLink, delSide } from "@/lib/deling";
import { elprisMail } from "@/lib/mail/skabeloner";
import { testDag } from "@/lib/kilder/test";
import { opsummer, timeserie } from "@/lib/pris/dag";

describe("delingslinket", () => {
  it("vennen får forsiden med mærket del-el", () => {
    expect(delLink("https://dfpriser.dk/el")).toBe("https://dfpriser.dk/el?fra=del-el");
    expect(delLink("https://dfpriser.dk/el/")).toBe("https://dfpriser.dk/el?fra=del-el");
  });
  it("siden med knapperne ligger på /el/del", () => {
    expect(delSide("https://dfpriser.dk/el")).toBe("https://dfpriser.dk/el/del");
  });
  it("beskeden slutter med linket og indeholder ingen personoplysninger", () => {
    const b = delBesked("https://dfpriser.dk/el");
    expect(b.startsWith(DEL_BESKED_TEKST)).toBe(true);
    expect(b.endsWith("https://dfpriser.dk/el?fra=del-el")).toBe(true);
    expect(b).not.toMatch(/token|@/);
  });
});

describe("linjen i elpris-mailen", async () => {
  const slots = await testDag("DK2", "2026-10-24");
  const grund = {
    omraade: "DK2" as const, postnummer: "2100", dag: opsummer("2026-10-24", slots), serie: timeserie(slots),
    seneste: [], typisk: null, prognose: null,
  };
  const links = { hjemmeside: "https://h", logo: "https://h/l.png", privatliv: "#", stop: "https://h/stop", stopEtKlik: "#", skiftPostnummer: "#", slet: "#" };
  it("vises med link til /del, når linket er sat", () => {
    const m = elprisMail({ ...grund, links: { ...links, del: "https://h/del" } });
    expect(m.html).toContain(DEL_MAIL_TEKST.foer);
    expect(m.html).toContain('href="https://h/del"');
    expect(m.text).toContain("https://h/del");
  });
  it("vises ikke uden link", () => {
    const m = elprisMail({ ...grund, links });
    expect(m.html).not.toContain(DEL_MAIL_TEKST.foer);
  });
  it("står før STOP-knappen", () => {
    const m = elprisMail({ ...grund, links: { ...links, del: "https://h/del" } });
    expect(m.html.indexOf(DEL_MAIL_TEKST.foer)).toBeLessThan(m.html.indexOf("STOP modtagelse"));
  });
});
