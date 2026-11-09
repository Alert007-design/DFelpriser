import { describe, expect, it } from "vitest";
import { metadata as layoutMeta } from "@/app/layout";
import { metadata as forsideMeta } from "@/app/page";
import { metadata as omMeta } from "@/app/om-priserne/page";
import { metadata as privatMeta } from "@/app/privatlivspolitik/page";
import { kanonisk } from "@/lib/seo";

describe("SEO for elpriserne på dfpriser.dk/el", () => {
  it("kanonisk adresse peger på dfpriser.dk/el", () => {
    expect(kanonisk("/")).toBe("https://dfpriser.dk/el");
    expect(kanonisk("/om-priserne")).toBe("https://dfpriser.dk/el/om-priserne");
  });
  it("layoutet giver ikke alle sider forsidens kanoniske adresse", () => {
    expect(layoutMeta.alternates?.canonical).toBeUndefined();
  });
  it("hver offentlig side har sin egen kanoniske adresse", () => {
    expect(forsideMeta.alternates?.canonical).toBe("https://dfpriser.dk/el");
    expect(omMeta.alternates?.canonical).toBe("https://dfpriser.dk/el/om-priserne");
    expect(privatMeta.alternates?.canonical).toBe("https://dfpriser.dk/el/privatlivspolitik");
  });
  it("om priserne har sin egen beskrivelse", () => {
    expect(String(omMeta.description ?? "").length).toBeGreaterThan(80);
  });
  it("delingskortet har billede og twitter-kort", () => {
    const og = layoutMeta.openGraph as { images?: unknown };
    expect(JSON.stringify(og.images)).toContain("https://dfpriser.dk/el/mail/df-logo.png");
    expect((layoutMeta.twitter as { card?: string })?.card).toBe("summary");
  });
});
