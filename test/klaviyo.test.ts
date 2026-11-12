import { afterEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { EL_PRISER, KLAVIYO_FRA, klaviyoKlient, overfoerEn, overfoerManglende, postnummerTilKlaviyo, sletIKlaviyo } from "@/lib/klaviyo";
import { skiftPostnummer, slet } from "@/lib/tilmelding";
import { skiftToken, sletToken } from "@/lib/tokens";
import { indsaetTilmeldt, nyDb } from "./hjaelp";

const sov = async () => {};
const EFTER = new Date(KLAVIYO_FRA.getTime() + 60 * 60 * 1000);
const FOER = new Date(KLAVIYO_FRA.getTime() - 60 * 60 * 1000);

afterEach(() => {
  delete process.env.KLAVIYO_API_KEY;
  delete process.env.KLAVIYO_LIST_ID;
});

function medNoegle() {
  process.env.KLAVIYO_API_KEY = "pk_hemmelig_testnoegle";
  process.env.KLAVIYO_LIST_ID = "LISTE42";
}

interface Kald {
  metode: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Falsk Klaviyo. `profil` er den profil, opslag på e-mail finder (null = ingen). `fejl` afgør status pr. kald.
 */
function falskKlaviyo(o: { profil?: { id: string; properties: Record<string, unknown> } | null; fejl?: (k: Kald, nr: number) => number | Error } = {}) {
  const kald: Kald[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const k = { metode: init?.method ?? "GET", url: String(url), headers: init?.headers as Record<string, string>, body: String(init?.body ?? "") };
    kald.push(k);
    const s = o.fejl?.(k, kald.length);
    if (s instanceof Error) throw s;
    if (s && s >= 400) return new Response("{}", { status: s });
    if (k.metode === "GET") {
      const p = o.profil ?? null;
      return Response.json({ data: p ? [{ type: "profile", id: p.id, attributes: { email: "x", properties: p.properties } }] : [] });
    }
    return new Response(null, { status: 202 });
  }) as typeof fetch;
  return { f, kald };
}

async function person(
  db: Db,
  email: string,
  o: { givet?: Date; version?: 1 | 2 | 3; test?: boolean; status?: string; elprisAktiv?: boolean; postnummer?: string; fornavn?: string; efternavn?: string } = {},
) {
  const id = await indsaetTilmeldt(db, {
    email,
    test: o.test,
    status: o.status,
    version: o.version,
    elprisAktiv: o.elprisAktiv,
    postnummer: o.postnummer,
    omraade: "DK2",
    fornavn: o.fornavn,
    efternavn: o.efternavn,
  });
  await db.query(`update samtykker set givet = $2 where tilmeldt_id = $1`, [id, (o.givet ?? EFTER).toISOString()]);
  return id;
}

const krop = (k: Kald) => JSON.parse(k.body);

describe("overførsel ved bekræftelse", () => {
  it("sender e-mail, postnummer (Location og Zipcode) og Pris emne = EL priser og tilmelder listen", async () => {
    const db = await nyDb();
    const id = await person(db, "a@x.dk", { postnummer: "2100" });
    medNoegle();
    const { f, kald } = falskKlaviyo();
    expect(await overfoerEn(db, id, { klient: klaviyoKlient(f), sov }, EFTER)).toBe("overfoert");

    const imp = kald.find((k) => k.url.endsWith("/api/profile-import"))!;
    expect(krop(imp)).toEqual({
      data: {
        type: "profile",
        attributes: { email: "a@x.dk", location: { zip: "2100" }, properties: { Zipcode: "2100", "Pris emne": [EL_PRISER] } },
      },
    });
    const abo = kald.find((k) => k.url.endsWith("/api/profile-subscription-bulk-create-jobs"))!;
    expect(krop(abo).data.relationships.list.data).toEqual({ type: "list", id: "LISTE42" });
    expect(krop(abo).data.attributes.profiles.data[0].attributes).toEqual({
      email: "a@x.dk",
      subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
    });
    for (const k of kald) {
      expect(k.headers.Authorization).toBe("Klaviyo-API-Key pk_hemmelig_testnoegle");
      expect(k.body).not.toContain("pk_hemmelig_testnoegle");
    }
    const [r] = await db.query<{ klaviyo_overfoert: Date | null }>(`select klaviyo_overfoert from tilmeldte where id = $1`, [id]);
    expect(new Date(r.klaviyo_overfoert!).toISOString()).toBe(EFTER.toISOString());
  });

  it("sender fornavn og efternavn, når navnet findes (samtykke version 3)", async () => {
    const db = await nyDb();
    const id = await person(db, "n@x.dk", { version: 3, fornavn: "Anna", efternavn: "Hansen", postnummer: "2100" });
    medNoegle();
    const { f, kald } = falskKlaviyo();
    expect(await overfoerEn(db, id, { klient: klaviyoKlient(f), sov }, EFTER)).toBe("overfoert");
    const imp = kald.find((k) => k.url.endsWith("/api/profile-import"))!;
    expect(krop(imp).data.attributes).toEqual({
      email: "n@x.dk",
      first_name: "Anna",
      last_name: "Hansen",
      location: { zip: "2100" },
      properties: { Zipcode: "2100", "Pris emne": [EL_PRISER] },
    });
  });

  it("uden navn (tilmeldt før ændringen) sendes navnefelterne slet ikke, så et navn fra benzinpriserne bevares", async () => {
    const db = await nyDb();
    const id = await person(db, "u@x.dk");
    medNoegle();
    const { f, kald } = falskKlaviyo({ profil: { id: "P1", properties: { "Pris emne": ["Benzin priser"] } } });
    expect(await overfoerEn(db, id, { klient: klaviyoKlient(f), sov }, EFTER)).toBe("overfoert");
    const a = krop(kald.find((k) => k.url.endsWith("/api/profile-import"))!).data.attributes;
    expect(a).not.toHaveProperty("first_name");
    expect(a).not.toHaveProperty("last_name");
  });

  it("bevarer Benzin priser, når profilen allerede har den", async () => {
    const db = await nyDb();
    const id = await person(db, "b@x.dk");
    medNoegle();
    const { f, kald } = falskKlaviyo({ profil: { id: "P1", properties: { "Pris emne": ["Benzin priser"] } } });
    expect(await overfoerEn(db, id, { klient: klaviyoKlient(f), sov }, EFTER)).toBe("overfoert");
    const imp = kald.find((k) => k.url.endsWith("/api/profile-import"))!;
    expect(krop(imp).data.attributes.properties["Pris emne"]).toEqual(["Benzin priser", EL_PRISER]);
  });

  it("tilføjer ikke EL priser to gange, og en tekstværdi i stedet for en liste bevares", async () => {
    const db = await nyDb();
    const a = await person(db, "c@x.dk");
    medNoegle();
    const en = falskKlaviyo({ profil: { id: "P1", properties: { "Pris emne": [EL_PRISER] } } });
    await overfoerEn(db, a, { klient: klaviyoKlient(en.f), sov }, EFTER);
    expect(krop(en.kald.find((k) => k.url.endsWith("/api/profile-import"))!).data.attributes.properties["Pris emne"]).toEqual([EL_PRISER]);

    const b = await person(db, "d@x.dk");
    const to = falskKlaviyo({ profil: { id: "P2", properties: { "Pris emne": "Benzin priser" } } });
    await overfoerEn(db, b, { klient: klaviyoKlient(to.f), sov }, EFTER);
    expect(krop(to.kald.find((k) => k.url.endsWith("/api/profile-import"))!).data.attributes.properties["Pris emne"]).toEqual([
      "Benzin priser",
      EL_PRISER,
    ]);
  });

  it("overfører ikke personer, der gav samtykke før grænsen, testtilmeldinger, ubekræftede eller samtykke version 1", async () => {
    const db = await nyDb();
    const ids = [
      await person(db, "foer@x.dk", { givet: FOER }),
      await person(db, "test@x.dk", { test: true }),
      await person(db, "afventer@x.dk", { status: "afventer" }),
      await person(db, "v1@x.dk", { version: 1 }),
    ];
    medNoegle();
    const { f, kald } = falskKlaviyo();
    for (const id of ids) expect(await overfoerEn(db, id, { klient: klaviyoKlient(f), sov }, EFTER)).toBe("ikke_udvalgt");
    expect(kald).toHaveLength(0);
  });

  it("tilbagekaldt samtykke overføres ikke", async () => {
    const db = await nyDb();
    const id = await person(db, "tilbage@x.dk");
    await db.query(`update samtykker set status = 'tilbagekaldt', tilbagekaldt = now() where tilmeldt_id = $1`, [id]);
    medNoegle();
    const { f, kald } = falskKlaviyo();
    expect(await overfoerEn(db, id, { klient: klaviyoKlient(f), sov }, EFTER)).toBe("ikke_udvalgt");
    expect(kald).toHaveLength(0);
  });

  it("personer, der har stoppet den daglige mail, overføres stadig (samtykket gælder)", async () => {
    const db = await nyDb();
    const id = await person(db, "stop@x.dk", { elprisAktiv: false });
    medNoegle();
    const { f } = falskKlaviyo();
    expect(await overfoerEn(db, id, { klient: klaviyoKlient(f), sov }, EFTER)).toBe("overfoert");
  });

  it("er slået fra uden nøgle eller liste, og intet kaldes", async () => {
    const db = await nyDb();
    const id = await person(db, "a@x.dk");
    const { f, kald } = falskKlaviyo();
    expect(klaviyoKlient(f)).toBeNull();
    process.env.KLAVIYO_API_KEY = "k";
    expect(klaviyoKlient(f)).toBeNull();
    expect(await overfoerEn(db, id, { klient: null, sov }, EFTER)).toBe("slaaet_fra");
    expect(kald).toHaveLength(0);
  });

  it("en fejl hos Klaviyo kaster ikke, markeres og tages af den timelige kørsel", async () => {
    const db = await nyDb();
    const id = await person(db, "a@x.dk");
    medNoegle();
    const nede = falskKlaviyo({ fejl: () => 503 });
    const orig = console.error;
    console.error = () => {};
    try {
      expect(await overfoerEn(db, id, { klient: klaviyoKlient(nede.f), sov }, EFTER)).toBe("fejlet");
    } finally {
      console.error = orig;
    }
    expect(nede.kald.length).toBeGreaterThan(1); // ét genforsøg
    const [r] = await db.query<{ klaviyo_overfoert: Date | null; klaviyo_fejlet: Date | null }>(
      `select klaviyo_overfoert, klaviyo_fejlet from tilmeldte where id = $1`,
      [id],
    );
    expect(r.klaviyo_overfoert).toBeNull();
    expect(r.klaviyo_fejlet).not.toBeNull();

    const ok = falskKlaviyo();
    expect(await overfoerManglende(db, { klient: klaviyoKlient(ok.f), sov }, EFTER)).toEqual({ overfoert: 1, fejlet: 0 });
    expect(await overfoerManglende(db, { klient: klaviyoKlient(ok.f), sov }, EFTER)).toEqual({ overfoert: 0, fejlet: 0 });
  });

  it("genforsøger ikke ved 401, og nøglen står ikke i fejlen", async () => {
    const db = await nyDb();
    const id = await person(db, "a@x.dk");
    medNoegle();
    const { f, kald } = falskKlaviyo({ fejl: () => 401 });
    const fejl: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => fejl.push(a.map(String).join(" "));
    try {
      expect(await overfoerEn(db, id, { klient: klaviyoKlient(f), sov }, EFTER)).toBe("fejlet");
    } finally {
      console.error = orig;
    }
    // Opslaget og importen forsøges hver én gang; ingen genforsøg ved en fast fejl.
    expect(kald.map((k) => k.metode)).toEqual(["GET", "POST"]);
    expect(fejl.join("\n")).not.toContain("pk_hemmelig_testnoegle");
    expect(fejl.join("\n")).not.toContain("a@x.dk");
  });

  it("kan profilen ikke slås op, overføres personen med EL priser alene", async () => {
    const db = await nyDb();
    const id = await person(db, "g@x.dk");
    medNoegle();
    const { f, kald } = falskKlaviyo({ fejl: (k) => (k.metode === "GET" ? 403 : 202) });
    const orig = console.error;
    console.error = () => {};
    try {
      expect(await overfoerEn(db, id, { klient: klaviyoKlient(f), sov }, EFTER)).toBe("overfoert");
    } finally {
      console.error = orig;
    }
    expect(krop(kald.find((k) => k.url.endsWith("/api/profile-import"))!).data.attributes.properties["Pris emne"]).toEqual([EL_PRISER]);
  });

  it("den timelige kørsel stopper ved første fejl", async () => {
    const db = await nyDb();
    for (const e of ["a@x.dk", "b@x.dk", "c@x.dk"]) await person(db, e);
    medNoegle();
    const { f } = falskKlaviyo({ fejl: () => 500 });
    const orig = console.error;
    console.error = () => {};
    try {
      expect(await overfoerManglende(db, { klient: klaviyoKlient(f), sov, pauser: [] }, EFTER)).toEqual({ overfoert: 0, fejlet: 1 });
    } finally {
      console.error = orig;
    }
  });
});

describe("skift af postnummer", () => {
  it("sender det nye postnummer til Klaviyo for overførte og rører ikke Pris emne", async () => {
    const db = await nyDb();
    const id = await person(db, "a@x.dk", { postnummer: "2100" });
    await db.query(`update tilmeldte set klaviyo_overfoert = now() where id = $1`, [id]);
    medNoegle();
    const { f, kald } = falskKlaviyo();
    const afh = { klient: klaviyoKlient(f), sov };
    expect(await skiftPostnummer(db, skiftToken(id), "8000", (p) => postnummerTilKlaviyo(p, afh))).toBe("ok");
    expect(kald.map((k) => k.url)).toEqual(["https://a.klaviyo.com/api/profile-import"]);
    expect(krop(kald[0])).toEqual({
      data: { type: "profile", attributes: { email: "a@x.dk", location: { zip: "8000" }, properties: { Zipcode: "8000" } } },
    });
  });

  it("sender intet for personer, der ikke er overført", async () => {
    const db = await nyDb();
    const id = await person(db, "a@x.dk");
    medNoegle();
    const { f, kald } = falskKlaviyo();
    expect(await skiftPostnummer(db, skiftToken(id), "8000", (p) => postnummerTilKlaviyo(p, { klient: klaviyoKlient(f), sov }))).toBe("ok");
    expect(kald).toHaveLength(0);
  });

  it("skiftet gennemføres, selv om Klaviyo fejler", async () => {
    const db = await nyDb();
    const id = await person(db, "a@x.dk");
    await db.query(`update tilmeldte set klaviyo_overfoert = now() where id = $1`, [id]);
    medNoegle();
    const { f } = falskKlaviyo({ fejl: () => 500 });
    const orig = console.error;
    console.error = () => {};
    try {
      expect(await skiftPostnummer(db, skiftToken(id), "8000", (p) => postnummerTilKlaviyo(p, { klient: klaviyoKlient(f), sov, pauser: [] }))).toBe("ok");
    } finally {
      console.error = orig;
    }
    const [r] = await db.query<{ postnummer: string }>(`select postnummer from tilmeldte where id = $1`, [id]);
    expect(r.postnummer).toBe("8000");
  });
});

describe("sletning", () => {
  async function overfoert(db: Db, email: string) {
    const id = await person(db, email);
    await db.query(`update tilmeldte set klaviyo_overfoert = now() where id = $1`, [id]);
    return id;
  }

  it("kun EL priser: Pris emne, Zipcode, fornavn og efternavn fjernes, og personen tages af listen; profilen slettes ikke", async () => {
    const db = await nyDb();
    const id = await overfoert(db, "a@x.dk");
    medNoegle();
    const { f, kald } = falskKlaviyo({ profil: { id: "P1", properties: { "Pris emne": [EL_PRISER], Zipcode: "2100" } } });
    const afh = { klient: klaviyoKlient(f), sov };
    expect(await slet(db, sletToken(id), (p) => sletIKlaviyo(p, afh))).toBe("ok");
    expect(await db.query(`select 1 from tilmeldte`)).toHaveLength(0);

    const patch = kald.find((k) => k.metode === "PATCH")!;
    expect(krop(patch)).toEqual({
      data: { type: "profile", id: "P1", attributes: { first_name: null, last_name: null }, meta: { patch_properties: { unset: ["Pris emne", "Zipcode"] } } },
    });
    const ud = kald.find((k) => k.metode === "DELETE")!;
    expect(ud.url).toBe("https://a.klaviyo.com/api/lists/LISTE42/relationships/profiles");
    expect(krop(ud)).toEqual({ data: [{ type: "profile", id: "P1" }] });
    expect(kald.some((k) => /data-privacy|deletion/.test(k.url))).toBe(false);
  });

  it("også Benzin priser: kun EL priser fjernes, og personen bliver på listen", async () => {
    const db = await nyDb();
    const id = await overfoert(db, "b@x.dk");
    medNoegle();
    const { f, kald } = falskKlaviyo({ profil: { id: "P2", properties: { "Pris emne": ["Benzin priser", EL_PRISER], Zipcode: "2100" } } });
    expect(await slet(db, sletToken(id), (p) => sletIKlaviyo(p, { klient: klaviyoKlient(f), sov }))).toBe("ok");
    const patch = kald.find((k) => k.metode === "PATCH")!;
    // Navnet røres ikke: det kan stamme fra benzinpriserne.
    expect(krop(patch)).toEqual({ data: { type: "profile", id: "P2", attributes: { properties: { "Pris emne": ["Benzin priser"] } } } });
    expect(kald.some((k) => k.metode === "DELETE")).toBe(false);
  });

  it("ikke overførte: intet kaldes", async () => {
    const db = await nyDb();
    const id = await person(db, "c@x.dk");
    medNoegle();
    const { f, kald } = falskKlaviyo();
    expect(await slet(db, sletToken(id), (p) => sletIKlaviyo(p, { klient: klaviyoKlient(f), sov }))).toBe("ok");
    expect(kald).toHaveLength(0);
  });

  it("sletningen gennemføres, selv om Klaviyo fejler, og fejlen logges uden e-mailadresse", async () => {
    const db = await nyDb();
    const id = await overfoert(db, "d@x.dk");
    medNoegle();
    const { f } = falskKlaviyo({ fejl: () => 500 });
    const fejl: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => fejl.push(a.map(String).join(" "));
    try {
      expect(await slet(db, sletToken(id), (p) => sletIKlaviyo(p, { klient: klaviyoKlient(f), sov, pauser: [] }))).toBe("ok");
    } finally {
      console.error = orig;
    }
    expect(await db.query(`select 1 from tilmeldte`)).toHaveLength(0);
    expect(fejl.join("\n")).toContain("manuelt");
    expect(fejl.join("\n")).not.toContain("d@x.dk");
  });

  it("sletning og skift virker, før migrationen er kørt", async () => {
    const db = await nyDb();
    const a = await person(db, "e@x.dk");
    const b = await person(db, "f@x.dk");
    await db.query(`alter table tilmeldte drop column klaviyo_overfoert, drop column klaviyo_fejlet`);
    medNoegle();
    const { f, kald } = falskKlaviyo();
    const afh = { klient: klaviyoKlient(f), sov };
    expect(await skiftPostnummer(db, skiftToken(a), "8000", (p) => postnummerTilKlaviyo(p, afh))).toBe("ok");
    expect(await slet(db, sletToken(b), (p) => sletIKlaviyo(p, afh))).toBe("ok");
    expect(kald).toHaveLength(0);
  });
});
