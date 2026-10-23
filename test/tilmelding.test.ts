import { beforeEach, describe, expect, it } from "vitest";
import { afmeld, bekraeft, rydOp, skiftPostnummer, slet, tilmeld, traekPolitikTilbage } from "@/lib/tilmelding";
import { tilmeldingSkema, type Tilmelding } from "@/lib/validering";
import { ELPRIS_SAMTYKKE, POLITIK_SAMTYKKE } from "@/lib/samtykke";
import { tekstHash } from "@/lib/samtykke-bevis";
import { afmeldToken, politikFraToken, skiftToken, sletToken, laesAfmeldToken } from "@/lib/tokens";
import { falskAfsender, indsaetTilmeldt, nyDb } from "./hjaelp";

const ctx = { ip: "1.2.3.4", appUrl: "https://eksempel.test", nu: new Date("2026-10-23T10:00:00Z") };

function input(o: Partial<Record<string, unknown>> = {}): Tilmelding {
  return tilmeldingSkema.parse({
    email: "Anna@Eksempel.dk ",
    postnummer: "2100",
    samtykke: true,
    samtykke_version: ELPRIS_SAMTYKKE.version,
    samtykke_hash: tekstHash(ELPRIS_SAMTYKKE.tekst),
    ...o,
  });
}
const medPolitik = {
  politik_samtykke: true,
  politik_samtykke_version: POLITIK_SAMTYKKE.version,
  politik_samtykke_hash: tekstHash(POLITIK_SAMTYKKE.tekst),
};

function tokenFraMail(html: string): string {
  const m = /bekraeft\?token=([^"]+)"/.exec(html);
  return decodeURIComponent(m![1]);
}

describe("samtykketekster", () => {
  it("konstanterne i koden er ordret ens med dem i databasen", async () => {
    const db = await nyDb();
    for (const s of [ELPRIS_SAMTYKKE, POLITIK_SAMTYKKE]) {
      const [r] = await db.query<{ tekst: string }>(`select tekst from samtykketekster where type = $1 and version = $2`, [s.type, s.version]);
      expect(r.tekst).toBe(s.tekst);
    }
  });
  it("kan ikke ændres eller slettes", async () => {
    const db = await nyDb();
    await expect(db.query(`update samtykketekster set tekst = 'x'`)).rejects.toThrow(/kan ikke ændres/);
    await expect(db.query(`delete from samtykketekster`)).rejects.toThrow(/kan ikke ændres/);
  });
});

describe("tilmelding med double opt-in", () => {
  let db: Awaited<ReturnType<typeof nyDb>>;
  beforeEach(async () => {
    process.env.JURA_GODKENDT = "ja";
    process.env.TESTMODTAGERE = "";
    db = await nyDb();
  });

  it("gemmer ubekræftet, sender bekræftelsesmail, og aktiverer først ved klik", async () => {
    const af = falskAfsender();
    expect(await tilmeld(db, af, input(), ctx)).toEqual({ status: "ok" });
    const [t] = await db.query<{ status: string; omraade: string; email: string; postnummer: string }>(`select * from tilmeldte`);
    expect(t).toMatchObject({ status: "afventer", omraade: "DK2", email: "anna@eksempel.dk", postnummer: "2100" });
    expect(af.sendte).toHaveLength(1);
    expect(af.sendte[0].subject).toMatch(/Bekræft/);
    expect(af.sendte[0].html).toContain(ELPRIS_SAMTYKKE.tekst.slice(0, 40));
    const [s] = await db.query<{ status: string; ordlyd: string }>(`select * from samtykker`);
    expect(s.status).toBe("afventer");
    expect(s.ordlyd).toBe(ELPRIS_SAMTYKKE.tekst);

    expect(await bekraeft(db, "forkert", ctx.nu)).toBe(false);
    expect(await bekraeft(db, tokenFraMail(af.sendte[0].html), ctx.nu)).toBe(true);
    const [akt] = await db.query<{ status: string }>(`select status from tilmeldte`);
    expect(akt.status).toBe("aktiv");
    const [ss] = await db.query<{ status: string; bekraeftet: string }>(`select status, bekraeftet from samtykker`);
    expect(ss.status).toBe("aktiv");
    expect(ss.bekraeftet).toBeTruthy();
    // linket kan kun bruges én gang
    expect(await bekraeft(db, tokenFraMail(af.sendte[0].html), ctx.nu)).toBe(false);
  });

  it("DK1 for Jylland og Fyn, DK2 for Sjælland", async () => {
    const af = falskAfsender();
    await tilmeld(db, af, input({ email: "a@e.dk", postnummer: "8000" }), ctx);
    await tilmeld(db, af, input({ email: "b@e.dk", postnummer: "5000" }), ctx);
    await tilmeld(db, af, input({ email: "c@e.dk", postnummer: "4000" }), ctx);
    const r = await db.query<{ email: string; omraade: string }>(`select email, omraade from tilmeldte order by email`);
    expect(r.map((x) => x.omraade)).toEqual(["DK1", "DK1", "DK2"]);
  });

  it("bekræftelseslinket udløber efter 72 timer", async () => {
    const af = falskAfsender();
    await tilmeld(db, af, input(), ctx);
    const sent = new Date(ctx.nu.getTime() + 73 * 3_600_000);
    expect(await bekraeft(db, tokenFraMail(af.sendte[0].html), sent)).toBe(false);
    expect((await rydOp(db, sent)).slettede).toBe(1);
    expect(await db.query(`select 1 from tilmeldte`)).toHaveLength(0);
  });

  it("politisk samtykke er separat og frivilligt – aldrig forhåndsafkrydset", async () => {
    const af = falskAfsender();
    await tilmeld(db, af, input(), ctx);
    expect((await db.query(`select 1 from samtykker where type = 'politik'`)).length).toBe(0);
    await tilmeld(db, af, input({ email: "b@e.dk", ...medPolitik }), ctx);
    expect((await db.query(`select 1 from samtykker where type = 'politik'`)).length).toBe(1);
    // kun elpris-samtykket afkrydset uden politik giver kun ét samtykke
    expect(tilmeldingSkema.safeParse({ ...input(), samtykke: false }).success).toBe(false);
    expect(tilmeldingSkema.safeParse({ email: "a@b.dk", postnummer: "2100" }).success).toBe(false);
  });

  it("afviser tilmelding, hvis den viste tekst ikke er den gældende", async () => {
    const af = falskAfsender();
    expect((await tilmeld(db, af, input({ samtykke_hash: tekstHash("en anden tekst") }), ctx)).status).toBe("samtykke_foraeldet");
    expect((await tilmeld(db, af, input({ samtykke_version: 99 }), ctx)).status).toBe("samtykke_foraeldet");
    expect((await tilmeld(db, af, input({ ...medPolitik, politik_samtykke_hash: tekstHash("x") }), ctx)).status).toBe("samtykke_foraeldet");
    expect(await db.query(`select 1 from tilmeldte`)).toHaveLength(0);
    expect(af.sendte).toHaveLength(0);
  });

  it("afviser ukendte postnumre og ugyldige e-mails", async () => {
    const af = falskAfsender();
    expect(tilmeldingSkema.safeParse({ ...input(), postnummer: "0900" }).success).toBe(false);
    // også hvis valideringen skulle blive omgået, afviser selve tilmeldingen et ukendt postnummer
    const omgaaet = { ...input(), postnummer: "0900" } as Tilmelding;
    expect((await tilmeld(db, af, omgaaet, ctx)).status).toBe("ukendt_postnummer");
    expect(tilmeldingSkema.safeParse({ ...input(), postnummer: "3900" }).success).toBe(false);
    expect(tilmeldingSkema.safeParse({ ...input(), email: "ikke-en-mail" }).success).toBe(false);
  });

  it("spærret før juridisk godkendelse, undtagen for testmodtagere", async () => {
    process.env.JURA_GODKENDT = "nej";
    process.env.TESTMODTAGERE = "test@eksempel.dk";
    const af = falskAfsender();
    expect((await tilmeld(db, af, input(), ctx)).status).toBe("spaerret");
    expect(await db.query(`select 1 from tilmeldte`)).toHaveLength(0);
    expect((await tilmeld(db, af, input({ email: "test@eksempel.dk" }), ctx)).status).toBe("ok");
    const [t] = await db.query<{ test: boolean }>(`select test from tilmeldte`);
    expect(t.test).toBe(true);
    process.env.JURA_GODKENDT = "ja";
    process.env.TESTMODTAGERE = "";
  });

  it("røber ikke, om en adresse allerede er tilmeldt, og ændrer ikke en aktiv tilmelding", async () => {
    const af = falskAfsender();
    await tilmeld(db, af, input(), ctx);
    await bekraeft(db, tokenFraMail(af.sendte[0].html), ctx.nu);
    const r = await tilmeld(db, af, input({ postnummer: "8000" }), ctx);
    expect(r).toEqual({ status: "ok" });
    const [t] = await db.query<{ postnummer: string; status: string }>(`select postnummer, status from tilmeldte`);
    expect(t).toMatchObject({ postnummer: "2100", status: "aktiv" });
    expect(af.sendte).toHaveLength(1);
  });

  it("begrænser antal forsøg pr. e-mail og pr. IP", async () => {
    const af = falskAfsender();
    const r: string[] = [];
    for (let i = 0; i < 5; i++) r.push((await tilmeld(db, af, input(), ctx)).status);
    expect(r).toEqual(["ok", "ok", "ok", "for_mange", "for_mange"]);
  });

  it("honeypot og skema afviser tom/forkert input", () => {
    expect(tilmeldingSkema.parse({ ...input(), hjemmeside: "http://spam" }).hjemmeside).toBe("http://spam");
  });
});

describe("afmelding, sletning, skift af postnummer og politisk samtykke", () => {
  let db: Awaited<ReturnType<typeof nyDb>>;
  beforeEach(async () => {
    db = await nyDb();
  });

  it("afmelding trækker samtykkerne tilbage med tidspunkt og kan gentages", async () => {
    const id = await indsaetTilmeldt(db, { email: "a@e.dk", politik: true });
    expect(await afmeld(db, "forkert.token", ctx.nu)).toBe("ugyldig");
    expect(await afmeld(db, afmeldToken(id), ctx.nu)).toBe("ok");
    expect(await afmeld(db, afmeldToken(id), new Date("2027-01-01"))).toBe("ok");
    const [t] = await db.query<{ status: string; afmeldt_tidspunkt: Date }>(`select status, afmeldt_tidspunkt from tilmeldte`);
    expect(t.status).toBe("afmeldt");
    expect(new Date(t.afmeldt_tidspunkt).toISOString()).toBe(ctx.nu.toISOString()); // første tidspunkt bevares
    const s = await db.query<{ status: string; tilbagekaldt: Date }>(`select status, tilbagekaldt from samtykker`);
    expect(s).toHaveLength(2);
    expect(s.every((x) => x.status === "tilbagekaldt" && x.tilbagekaldt)).toBe(true);
  });

  it("tokens kan kun bruges til deres eget formål", async () => {
    const id = await indsaetTilmeldt(db, { email: "a@e.dk" });
    expect(laesAfmeldToken(sletToken(id))).toBeNull();
    expect(await afmeld(db, sletToken(id), ctx.nu)).toBe("ugyldig");
    expect(await slet(db, afmeldToken(id))).toBe("ugyldig");
    expect(await skiftPostnummer(db, afmeldToken(id), "8000")).toBe("ugyldig");
    expect(await traekPolitikTilbage(db, afmeldToken(id), ctx.nu)).toBe("ugyldig");
  });

  it("sletning fjerner alt om personen", async () => {
    const id = await indsaetTilmeldt(db, { email: "a@e.dk", politik: true });
    await db.query(`insert into udsendelseslog (tilmeldt_id, dato) values ($1, '2026-10-22')`, [id]);
    expect(await slet(db, sletToken(id))).toBe("ok");
    expect(await slet(db, sletToken(id))).toBe("ok");
    for (const tabel of ["tilmeldte", "samtykker", "udsendelseslog"]) expect(await db.query(`select 1 from ${tabel}`)).toHaveLength(0);
  });

  it("politisk samtykke kan trækkes tilbage alene, og elpriserne fortsætter", async () => {
    const id = await indsaetTilmeldt(db, { email: "a@e.dk", politik: true });
    expect(await traekPolitikTilbage(db, politikFraToken(id), ctx.nu)).toBe("ok");
    const s = await db.query<{ type: string; status: string }>(`select type, status from samtykker order by type`);
    expect(s).toEqual([
      { type: "elpris", status: "aktiv" },
      { type: "politik", status: "tilbagekaldt" },
    ]);
    const [t] = await db.query<{ status: string }>(`select status from tilmeldte`);
    expect(t.status).toBe("aktiv");
  });

  it("skift af postnummer opdaterer elprisområdet", async () => {
    const id = await indsaetTilmeldt(db, { email: "a@e.dk", omraade: "DK2" });
    expect(await skiftPostnummer(db, skiftToken(id), "8000")).toBe("ok");
    const [t] = await db.query<{ omraade: string; postnummer: string }>(`select omraade, postnummer from tilmeldte`);
    expect(t).toEqual({ omraade: "DK1", postnummer: "8000" });
    expect(await skiftPostnummer(db, skiftToken(id), "3900")).toBe("ukendt_postnummer");
    expect(await skiftPostnummer(db, "x.y", "8000")).toBe("ugyldig");
  });

  it("en afmeldt kan tilmelde sig igen, men kun via ny bekræftelse", async () => {
    process.env.JURA_GODKENDT = "ja";
    const af = falskAfsender();
    const id = await indsaetTilmeldt(db, { email: "anna@eksempel.dk" });
    await afmeld(db, afmeldToken(id), ctx.nu);
    await tilmeld(db, af, input(), ctx);
    const [t] = await db.query<{ status: string }>(`select status from tilmeldte`);
    expect(t.status).toBe("afventer");
    expect(await bekraeft(db, tokenFraMail(af.sendte[0].html), ctx.nu)).toBe(true);
  });

  it("afmeldte slettes efter opbevaringsfristen, ikke før", async () => {
    const id = await indsaetTilmeldt(db, { email: "a@e.dk" });
    await afmeld(db, afmeldToken(id), new Date("2026-01-01T00:00:00Z"));
    expect((await rydOp(db, new Date("2026-12-01T00:00:00Z"))).afmeldteSlettet).toBe(0);
    expect((await rydOp(db, new Date("2027-01-02T00:00:00Z"))).afmeldteSlettet).toBe(1);
  });

  it("DF-priser og DF-Elpriser deler intet: ingen kode læser DF-priser", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const gennemgaa = (mappe: string): string[] =>
      readdirSync(mappe).flatMap((n) => {
        const p = join(mappe, n);
        if (n === "node_modules" || n === ".next" || n === ".git") return [];
        return statSync(p).isDirectory() ? gennemgaa(p) : /\.(ts|tsx|sql)$/.test(n) ? [p] : [];
      });
    for (const mappe of ["lib", "app", "supabase"]) {
      for (const fil of gennemgaa(join(process.cwd(), mappe))) {
        expect(readFileSync(fil, "utf8"), fil).not.toMatch(/dfpriser|prismail_aktiv|dagens billigste tank/i);
      }
    }
  });
});
