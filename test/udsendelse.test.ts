import { beforeEach, describe, expect, it } from "vitest";
import { udsend } from "@/lib/udsendelse";
import { testKilde } from "@/lib/kilder/test";
import type { Priskilde } from "@/lib/kilder/typer";
import { hentOgGem } from "@/lib/pris/lager";
import { dagensGraenser } from "@/lib/tid";
import type { Slot } from "@/lib/pris/typer";
import { falskAfsender, indsaetTestpriser, indsaetTilmeldt, nyDb } from "./hjaelp";

const APP = "https://eksempel.test";
// Fredag 23. oktober 2026, 16.00 dansk tid (sommertid er slut 25. oktober) = 14.00 UTC.
const KL16 = new Date("2026-10-23T14:00:00Z");
const KL1830 = new Date("2026-10-23T16:30:00Z");
const KL19 = new Date("2026-10-23T17:00:00Z");
const KL1530 = new Date("2026-10-23T13:30:00Z");

/** En kilde, der opfører sig som live (ikke TESTDATA), men giver testpriser. Tillader at styre, om morgendagen er udkommet. */
function livelignende(opt: { udgiv: () => boolean }): Priskilde & { kald: number } {
  const t = testKilde();
  const k = {
    navn: "energidataservice:DayAheadPrices",
    kald: 0,
    async hent(fra: Date, til: Date) {
      k.kald++;
      const ud = await t.hent(fra, til);
      if (!opt.udgiv()) {
        const graense = dagensGraenser("2026-10-24").start;
        return { DK1: ud.DK1.filter((s: Slot) => s.start < graense), DK2: ud.DK2.filter((s: Slot) => s.start < graense) };
      }
      return ud;
    },
  };
  return k;
}

describe("udsendelse kl. 16", () => {
  let db: Awaited<ReturnType<typeof nyDb>>;
  beforeEach(async () => {
    process.env.JURA_GODKENDT = "ja";
    process.env.ADMIN_EMAIL = "";
    db = await nyDb();
  });

  it("sender til hvert område med områdets egne priser, og kun én gang pr. person", async () => {
    await indsaetTestpriser(db, "2026-10-23", "2026-10-24");
    // en kilde, der ikke er TESTDATA, så mailen må sendes til rigtige modtagere
    await db.query(`update spotpriser set kilde = 'energidataservice:DayAheadPrices'`);
    const a = await indsaetTilmeldt(db, { email: "vest@eksempel.dk", omraade: "DK1" });
    await indsaetTilmeldt(db, { email: "oest@eksempel.dk", omraade: "DK2" });
    const af = falskAfsender();
    const k = livelignende({ udgiv: () => true });
    const r1 = await udsend(db, af, { nu: KL16, appUrl: APP, kilde: k });
    expect(r1.omraader.DK1).toMatchObject({ status: "faerdig", sendt: 1 });
    expect(r1.omraader.DK2).toMatchObject({ status: "faerdig", sendt: 1 });
    expect(af.sendte.map((m) => m.to).sort()).toEqual(["oest@eksempel.dk", "vest@eksempel.dk"]);
    const vest = af.sendte.find((m) => m.to === "vest@eksempel.dk")!;
    const oest = af.sendte.find((m) => m.to === "oest@eksempel.dk")!;
    expect(vest.text).toContain("DK1");
    expect(oest.text).toContain("DK2");
    expect(vest.text).not.toBe(oest.text);
    expect(vest.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    // anden kørsel samme dag: ingen dobbeltudsendelse
    const r2 = await udsend(db, af, { nu: new Date(KL16.getTime() + 5 * 60_000), appUrl: APP, kilde: k });
    expect(r2.omraader.DK1!.status).toBe("allerede_faerdig");
    expect(af.sendte).toHaveLength(2);
    void a;
  });

  it("samtidige kørsler giver ingen dobbeltudsendelse", async () => {
    await indsaetTestpriser(db, "2026-10-23", "2026-10-24");
    await db.query(`update spotpriser set kilde = 'energidataservice:DayAheadPrices'`);
    for (let i = 0; i < 30; i++) await indsaetTilmeldt(db, { email: `p${i}@eksempel.dk`, omraade: i % 2 ? "DK1" : "DK2" });
    const af = falskAfsender();
    const k = livelignende({ udgiv: () => true });
    await Promise.all([1, 2, 3].map(() => udsend(db, af, { nu: KL16, appUrl: APP, kilde: k })));
    const til = af.sendte.map((m) => m.to);
    expect(til).toHaveLength(30);
    expect(new Set(til).size).toBe(30);
  });

  it("sender intet uden for vinduet og intet før kl. 16", async () => {
    const af = falskAfsender();
    const r = await udsend(db, af, { nu: KL1530, appUrl: APP, kilde: testKilde() });
    expect(r.status).toBe("uden_for_vindue");
    expect(af.sendte).toHaveLength(0);
  });

  it("udsætter, når morgendagens priser mangler, og sender så snart de kommer – uden at bruge gamle priser", async () => {
    await indsaetTestpriser(db, "2026-10-20", "2026-10-23"); // kun til og med i dag
    await db.query(`update spotpriser set kilde = 'energidataservice:DayAheadPrices'`);
    await indsaetTilmeldt(db, { email: "a@eksempel.dk", omraade: "DK2" });
    const af = falskAfsender();
    let udgivet = false;
    const k = livelignende({ udgiv: () => udgivet });

    const r1 = await udsend(db, af, { nu: KL16, appUrl: APP, kilde: k });
    expect(r1.omraader.DK2).toMatchObject({ status: "afventer_priser", sendt: 0 });
    expect(af.sendte).toHaveLength(0);
    const [u] = await db.query<{ status: string; note: string }>(`select status, note from udsendelser where omraade = 'DK2'`);
    expect(u.status).toBe("afventer_priser");
    expect(u.note).toMatch(/ikke fuldstændige/);
    expect((await db.query(`select 1 from driftslog where niveau = 'advarsel'`)).length).toBe(2);

    // fortsat forsinket ved næste kald: stadig intet, og ingen ny advarsel
    await udsend(db, af, { nu: new Date(KL16.getTime() + 5 * 60_000), appUrl: APP, kilde: k });
    expect(af.sendte).toHaveLength(0);
    expect((await db.query(`select 1 from driftslog where niveau = 'advarsel'`)).length).toBe(2);

    udgivet = true;
    const r3 = await udsend(db, af, { nu: new Date(KL16.getTime() + 10 * 60_000), appUrl: APP, kilde: k });
    expect(r3.omraader.DK2).toMatchObject({ status: "faerdig", sendt: 1 });
    expect(af.sendte).toHaveLength(1);
    expect(af.sendte[0].text).toContain("lørdag den 24. oktober");
  });

  it("dropper udsendelsen kl. 19, hvis priserne stadig mangler, og dokumenterer det", async () => {
    await indsaetTestpriser(db, "2026-10-20", "2026-10-23");
    await indsaetTilmeldt(db, { email: "a@eksempel.dk" });
    const af = falskAfsender();
    const k = livelignende({ udgiv: () => false });
    await udsend(db, af, { nu: KL1830, appUrl: APP, kilde: k });
    const r = await udsend(db, af, { nu: KL19, appUrl: APP, kilde: k });
    expect(r.omraader.DK2!.status).toBe("droppet");
    expect(af.sendte).toHaveLength(0);
    const [u] = await db.query<{ status: string }>(`select status from udsendelser where omraade = 'DK2'`);
    expect(u.status).toBe("droppet");
    expect((await db.query(`select 1 from driftslog where niveau = 'fejl'`)).length).toBeGreaterThan(0);
  });

  it("afviser et ufuldstændigt datasæt (hul i døgnet) i stedet for at sende", async () => {
    await indsaetTestpriser(db, "2026-10-23", "2026-10-24");
    await db.query(`update spotpriser set kilde = 'energidataservice:DayAheadPrices'`);
    const g = dagensGraenser("2026-10-24");
    const midt = new Date(g.start.getTime() + 10 * 3_600_000).toISOString();
    await db.query(`delete from spotpriser where omraade = 'DK2' and start_utc = $1`, [midt]);
    await indsaetTilmeldt(db, { email: "a@eksempel.dk", omraade: "DK2" });
    const af = falskAfsender();
    // kilden kan heller ikke udfylde hullet
    const hulKilde: Priskilde = {
      navn: "energidataservice:DayAheadPrices",
      async hent(fra, til) {
        const ud = await testKilde().hent(fra, til);
        return { DK1: ud.DK1, DK2: ud.DK2.filter((s) => s.start.toISOString() !== midt) };
      },
    };
    const r = await udsend(db, af, { nu: KL16, appUrl: APP, kilde: hulKilde });
    expect(r.omraader.DK2!.status).toBe("afventer_priser");
    expect(r.omraader.DK2!.aarsag).toMatch(/hul/);
    expect(af.sendte).toHaveLength(0);
  });

  it("sender aldrig testdata til rigtige modtagere, men gerne til testmodtagere", async () => {
    process.env.JURA_GODKENDT = "ja";
    await indsaetTestpriser(db, "2026-10-23", "2026-10-24"); // kilde = TESTDATA
    await indsaetTilmeldt(db, { email: "rigtig@eksempel.dk", omraade: "DK2" });
    await indsaetTilmeldt(db, { email: "test@eksempel.dk", omraade: "DK2", test: true });
    const af = falskAfsender();
    await udsend(db, af, { nu: KL16, appUrl: APP, kilde: testKilde() });
    expect(af.sendte.map((m) => m.to)).toEqual(["test@eksempel.dk"]);
  });

  it("sender kun til testmodtagere, før den juridiske godkendelse er givet", async () => {
    process.env.JURA_GODKENDT = "nej";
    await indsaetTestpriser(db, "2026-10-23", "2026-10-24");
    await db.query(`update spotpriser set kilde = 'energidataservice:DayAheadPrices'`);
    await indsaetTilmeldt(db, { email: "rigtig@eksempel.dk" });
    await indsaetTilmeldt(db, { email: "test@eksempel.dk", test: true });
    const af = falskAfsender();
    await udsend(db, af, { nu: KL16, appUrl: APP, kilde: livelignende({ udgiv: () => true }) });
    expect(af.sendte.map((m) => m.to)).toEqual(["test@eksempel.dk"]);
    process.env.JURA_GODKENDT = "ja";
  });

  it("sender ikke til ubekræftede og afmeldte", async () => {
    await indsaetTestpriser(db, "2026-10-23", "2026-10-24");
    await db.query(`update spotpriser set kilde = 'energidataservice:DayAheadPrices'`);
    await indsaetTilmeldt(db, { email: "afventer@eksempel.dk", status: "afventer" });
    await indsaetTilmeldt(db, { email: "afmeldt@eksempel.dk", status: "afmeldt" });
    await indsaetTilmeldt(db, { email: "aktiv@eksempel.dk" });
    const af = falskAfsender();
    await udsend(db, af, { nu: KL16, appUrl: APP, kilde: livelignende({ udgiv: () => true }) });
    expect(af.sendte.map((m) => m.to)).toEqual(["aktiv@eksempel.dk"]);
  });

  it("politisk tekst kun til dem, der har givet det politiske samtykke", async () => {
    await indsaetTestpriser(db, "2026-10-23", "2026-10-24");
    await db.query(`update spotpriser set kilde = 'energidataservice:DayAheadPrices'`);
    await db.query(`update indstillinger set vaerdi = 'TESTBUDSKAB-FRA-DF' where noegle = 'df_budskab_tekst'`);
    await indsaetTilmeldt(db, { email: "med@eksempel.dk", politik: true });
    await indsaetTilmeldt(db, { email: "uden@eksempel.dk", politik: false });
    const af = falskAfsender();
    await udsend(db, af, { nu: KL16, appUrl: APP, kilde: livelignende({ udgiv: () => true }) });
    const med = af.sendte.find((m) => m.to === "med@eksempel.dk")!;
    const uden = af.sendte.find((m) => m.to === "uden@eksempel.dk")!;
    expect(med.html).toContain("TESTBUDSKAB-FRA-DF");
    expect(med.html).toContain("politik-fra");
    expect(uden.html).not.toContain("TESTBUDSKAB-FRA-DF");
    expect(uden.html).not.toContain("politik-fra");
    expect(uden.text).not.toContain("TESTBUDSKAB-FRA-DF");
  });

  it("en trukket politisk tilladelse stopper den politiske tekst med det samme", async () => {
    await indsaetTestpriser(db, "2026-10-23", "2026-10-24");
    await db.query(`update spotpriser set kilde = 'energidataservice:DayAheadPrices'`);
    await db.query(`update indstillinger set vaerdi = 'TESTBUDSKAB-FRA-DF' where noegle = 'df_budskab_tekst'`);
    const id = await indsaetTilmeldt(db, { email: "med@eksempel.dk", politik: true });
    await db.query(`update samtykker set status = 'tilbagekaldt', tilbagekaldt = now() where tilmeldt_id = $1 and type = 'politik'`, [id]);
    const af = falskAfsender();
    await udsend(db, af, { nu: KL16, appUrl: APP, kilde: livelignende({ udgiv: () => true }) });
    expect(af.sendte[0].html).not.toContain("TESTBUDSKAB-FRA-DF");
  });

  it("registrerer fejlede portioner uden at sende dobbelt ved næste kald", async () => {
    await indsaetTestpriser(db, "2026-10-23", "2026-10-24");
    await db.query(`update spotpriser set kilde = 'energidataservice:DayAheadPrices'`);
    await indsaetTilmeldt(db, { email: "a@eksempel.dk" });
    const af = falskAfsender();
    af.fejlNaeste = true;
    const k = livelignende({ udgiv: () => true });
    const r = await udsend(db, af, { nu: KL16, appUrl: APP, kilde: k });
    expect(r.omraader.DK2).toMatchObject({ status: "faerdig", sendt: 0, fejlet: 1 });
    expect((await db.query(`select 1 from driftslog where niveau = 'fejl'`)).length).toBe(1);
    await udsend(db, af, { nu: new Date(KL16.getTime() + 60_000), appUrl: APP, kilde: k });
    expect(af.sendte).toHaveLength(0); // hellere én manglende end én dobbelt
  });

  it("viser ingen prognose uden dokumenteret datagrundlag, og siger det i mailen", async () => {
    await indsaetTestpriser(db, "2026-10-23", "2026-10-24");
    await db.query(`update spotpriser set kilde = 'energidataservice:DayAheadPrices'`);
    await indsaetTilmeldt(db, { email: "a@eksempel.dk" });
    const af = falskAfsender();
    await udsend(db, af, { nu: KL16, appUrl: APP, kilde: livelignende({ udgiv: () => true }) });
    expect(af.sendte[0].html).toContain("Vi viser ikke en prognose");
    expect(af.sendte[0].html).not.toContain("Forventet billigste periode");
    const [u] = await db.query<{ prognose: boolean }>(`select prognose from udsendelser where omraade = 'DK2'`);
    expect(u.prognose).toBe(false);
  });
});

describe("hentning og lager", () => {
  it("gemmer priser, og en ny hentning giver samme data uden dubletter", async () => {
    const db = await nyDb();
    const r1 = await hentOgGem(db, testKilde(), "2026-10-24", "2026-10-24");
    expect(r1.every((x) => x.fuld)).toBe(true);
    await hentOgGem(db, testKilde(), "2026-10-24", "2026-10-24");
    const [n] = await db.query<{ n: number }>(`select count(*)::int as n from spotpriser where omraade = 'DK1'`);
    expect(n.n).toBe(96);
    expect((await db.query(`select 1 from hentelog where status = 'ok'`)).length).toBe(4);
  });

  it("logger en advarsel, hvis en gemt pris ændres af kilden", async () => {
    const db = await nyDb();
    await hentOgGem(db, testKilde(), "2026-10-24", "2026-10-24");
    const andre: Priskilde = {
      navn: "x",
      async hent(fra, til) {
        const ud = await testKilde().hent(fra, til);
        return { ...ud, DK1: ud.DK1.map((s, i) => (i === 0 ? { ...s, oerePrKwh: s.oerePrKwh + 1 } : s)) };
      },
    };
    await hentOgGem(db, andre, "2026-10-24", "2026-10-24");
    const adv = await db.query<{ besked: string }>(`select besked from driftslog where niveau = 'advarsel'`);
    expect(adv).toHaveLength(1);
    expect(adv[0].besked).toContain("DK1");
  });

  it("logger fejl fra kilden og kaster videre", async () => {
    const db = await nyDb();
    const daarlig: Priskilde = { navn: "x", hent: async () => { throw new Error("nede"); } };
    await expect(hentOgGem(db, daarlig, "2026-10-24", "2026-10-24")).rejects.toThrow("nede");
    expect((await db.query(`select 1 from hentelog where status = 'fejl'`)).length).toBe(1);
    expect((await db.query(`select 1 from driftslog where niveau = 'fejl'`)).length).toBe(1);
  });

  it("håndterer skiftedøgn (92 og 100 kvarterer)", async () => {
    const db = await nyDb();
    const r = await hentOgGem(db, testKilde(), "2026-03-28", "2026-03-30");
    expect(r.every((x) => x.fuld)).toBe(true);
    const [n] = await db.query<{ n: number }>(
      `select count(*)::int as n from spotpriser where omraade = 'DK1' and start_utc >= $1 and start_utc < $2`,
      [dagensGraenser("2026-03-29").start.toISOString(), dagensGraenser("2026-03-29").slut.toISOString()],
    );
    expect(n.n).toBe(92);
    await hentOgGem(db, testKilde(), "2026-10-25", "2026-10-25");
    const [m] = await db.query<{ n: number }>(
      `select count(*)::int as n from spotpriser where omraade = 'DK2' and start_utc >= $1 and start_utc < $2`,
      [dagensGraenser("2026-10-25").start.toISOString(), dagensGraenser("2026-10-25").slut.toISOString()],
    );
    expect(m.n).toBe(100);
  });
});

describe("prognose i nyhedsbrevet", () => {
  it("viser prognosen tydeligt mærket som prognose, når modellen har bestået testen, og gemmer den til senere opfølgning", async () => {
    process.env.JURA_GODKENDT = "ja";
    const db = await nyDb();
    const { indsaetOpdigtetHistorik } = await import("./hjaelp");
    await indsaetOpdigtetHistorik(db, "DK2", "2026-10-24", 140, "energidataservice:DayAheadPrices");
    await indsaetOpdigtetHistorik(db, "DK1", "2026-10-24", 140, "energidataservice:DayAheadPrices");
    await indsaetTilmeldt(db, { email: "a@eksempel.dk", omraade: "DK2" });
    const af = falskAfsender();
    const kilde: Priskilde = { navn: "energidataservice:DayAheadPrices", hent: async () => ({ DK1: [], DK2: [] }) };
    const r = await udsend(db, af, { nu: KL16, appUrl: APP, kilde });
    expect(r.omraader.DK2).toMatchObject({ status: "faerdig", sendt: 1, prognose: true });
    const mail = af.sendte[0];
    expect(mail.html).toContain("Disse tal er en prognose, ikke offentliggjorte priser.");
    expect(mail.html).toContain("Forventet billigste periode");
    expect(mail.html).toContain("Usikkerhed:");
    expect(mail.html).toContain("Morgendagens priser er offentliggjorte og kendte.");
    expect(mail.text).toContain("PROGNOSE FOR DE TO FØLGENDE DAGE (ikke offentliggjorte priser)");
    expect(mail.text).toContain("søndag den 25. oktober - prognose");
    expect(mail.text).toContain("mandag den 26. oktober - prognose");
    const gemte = await db.query<{ for_dato: string }>(`select for_dato::text from prognoser where omraade = 'DK2' order by for_dato`);
    expect(gemte.map((g) => g.for_dato)).toEqual(["2026-10-25", "2026-10-26"]);
  });
});
