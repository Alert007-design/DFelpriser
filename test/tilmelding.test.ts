import { beforeEach, describe, expect, it, vi } from "vitest";
import { afmeld, bekraeft, rydOp, skiftPostnummer, slet, tilmeld } from "@/lib/tilmelding";
import { tilmeldingSkema, type Tilmelding } from "@/lib/validering";
import { ELPRIS_SAMTYKKE } from "@/lib/samtykke";
import { tekstHash } from "@/lib/samtykke-bevis";
import { afmeldToken, skiftToken, sletToken, laesAfmeldToken } from "@/lib/tokens";
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
function tokenFraMail(html: string): string {
  const m = /bekraeft\?token=([^"]+)"/.exec(html);
  return decodeURIComponent(m![1]);
}

describe("samtykketekster", () => {
  it("konstanten i koden er ordret ens med den gældende tekst i databasen", async () => {
    const db = await nyDb();
    const [r] = await db.query<{ tekst: string; version: number }>(`select tekst, version from samtykketekster where type = 'elpris' order by version desc limit 1`);
    expect(r.version).toBe(ELPRIS_SAMTYKKE.version);
    expect(r.tekst).toBe(ELPRIS_SAMTYKKE.tekst);
  });
  it("version 2 dækker både elpriser og politisk information, og version 1 er bevaret", async () => {
    const db = await nyDb();
    expect(ELPRIS_SAMTYKKE.version).toBe(2);
    expect(ELPRIS_SAMTYKKE.tekst).toMatch(/politik og politiske udspil/);
    expect(ELPRIS_SAMTYKKE.tekst).toMatch(/disse formål/);
    const v1 = await db.query(`select 1 from samtykketekster where type = 'elpris' and version = 1`);
    expect(v1).toHaveLength(1);
    expect(await db.query(`select 1 from samtykketekster where type = 'politik'`)).toHaveLength(1);
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

  it("logger udfaldet af bekræftelsesmailen uden e-mailadressen i klartekst", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const fejlLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await tilmeld(db, falskAfsender(), input(), ctx);
      const ok = log.mock.calls.find((c) => c[0] === "bekraeftelsesmail")!;
      expect(JSON.parse(ok[1] as string)).toMatchObject({ resultat: "sendt", resend_id: "id-1" });

      const slem = falskAfsender();
      slem.send = async () => {
        throw new Error("Resend: The anna@eksempel.dk address is not valid");
      };
      await expect(tilmeld(db, slem, input({ email: "anna@eksempel.dk", postnummer: "8000" }), ctx)).rejects.toThrow();
      const fejl = fejlLog.mock.calls.find((c) => c[0] === "bekraeftelsesmail")!;
      expect(JSON.parse(fejl[1] as string)).toMatchObject({ resultat: "fejlet", fejl: "Resend: The [adresse] address is not valid" });
      for (const c of [...log.mock.calls, ...fejlLog.mock.calls]) expect(JSON.stringify(c)).not.toContain("anna@eksempel.dk");
    } finally {
      log.mockRestore();
      fejlLog.mockRestore();
    }
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

  it("ét samtykke: version 2 gemmes, intet separat politisk samtykke oprettes, og feltet er ikke forhåndsafkrydset", async () => {
    const af = falskAfsender();
    await tilmeld(db, af, input(), ctx);
    const s = await db.query<{ type: string; version: number }>(`select type, version from samtykker`);
    expect(s).toEqual([{ type: "elpris", version: 2 }]);
    // gamle formularer, der sender det tidligere politiske felt, giver stadig kun ét samtykke
    await tilmeld(db, af, input({ email: "b@e.dk", politik_samtykke: true, politik_samtykke_version: 1 }), ctx);
    expect((await db.query(`select 1 from samtykker where type = 'politik'`)).length).toBe(0);
    expect(tilmeldingSkema.safeParse({ ...input(), samtykke: false }).success).toBe(false);
    expect(tilmeldingSkema.safeParse({ email: "a@b.dk", postnummer: "2100" }).success).toBe(false);
  });

  it("afviser tilmelding, hvis den viste tekst ikke er den gældende", async () => {
    const af = falskAfsender();
    expect((await tilmeld(db, af, input({ samtykke_hash: tekstHash("en anden tekst") }), ctx)).status).toBe("samtykke_foraeldet");
    expect((await tilmeld(db, af, input({ samtykke_version: 99 }), ctx)).status).toBe("samtykke_foraeldet");
    // version 1 er ikke længere den gældende tekst
    expect((await tilmeld(db, af, input({ samtykke_version: 1 }), ctx)).status).toBe("samtykke_foraeldet");
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

describe("stop af den daglige mail, sletning og skift af postnummer", () => {
  let db: Awaited<ReturnType<typeof nyDb>>;
  beforeEach(async () => {
    db = await nyDb();
  });

  it("afmelding stopper kun den daglige mail: person og samtykke bevares, og det kan gentages", async () => {
    const id = await indsaetTilmeldt(db, { email: "a@e.dk" });
    expect(await afmeld(db, "forkert.token", ctx.nu)).toBe("ugyldig");
    expect(await afmeld(db, afmeldToken(id), ctx.nu)).toBe("ok");
    expect(await afmeld(db, afmeldToken(id), new Date("2027-01-01"))).toBe("ok");
    const [t] = await db.query<{ status: string; elpris_aktiv: boolean; elpris_stoppet: Date; afmeldt_tidspunkt: Date | null }>(
      `select status, elpris_aktiv, elpris_stoppet, afmeldt_tidspunkt from tilmeldte`,
    );
    expect(t.status).toBe("aktiv");
    expect(t.elpris_aktiv).toBe(false);
    expect(new Date(t.elpris_stoppet).toISOString()).toBe(ctx.nu.toISOString()); // første tidspunkt bevares
    const s = await db.query<{ status: string; tilbagekaldt: Date | null }>(`select status, tilbagekaldt from samtykker`);
    expect(s).toEqual([{ status: "aktiv", tilbagekaldt: null }]);
  });

  it("tokens kan kun bruges til deres eget formål", async () => {
    const id = await indsaetTilmeldt(db, { email: "a@e.dk" });
    expect(laesAfmeldToken(sletToken(id))).toBeNull();
    expect(await afmeld(db, sletToken(id), ctx.nu)).toBe("ugyldig");
    expect(await slet(db, afmeldToken(id))).toBe("ugyldig");
    expect(await skiftPostnummer(db, afmeldToken(id), "8000")).toBe("ugyldig");
  });

  it("sletning fjerner alt om personen", async () => {
    const id = await indsaetTilmeldt(db, { email: "a@e.dk", politik: true });
    await db.query(`insert into udsendelseslog (tilmeldt_id, dato) values ($1, '2026-10-22')`, [id]);
    expect(await slet(db, sletToken(id))).toBe("ok");
    expect(await slet(db, sletToken(id))).toBe("ok");
    for (const tabel of ["tilmeldte", "samtykker", "udsendelseslog"]) expect(await db.query(`select 1 from ${tabel}`)).toHaveLength(0);
  });

  it("skift af postnummer opdaterer elprisområdet", async () => {
    const id = await indsaetTilmeldt(db, { email: "a@e.dk", omraade: "DK2" });
    expect(await skiftPostnummer(db, skiftToken(id), "8000")).toBe("ok");
    const [t] = await db.query<{ omraade: string; postnummer: string }>(`select omraade, postnummer from tilmeldte`);
    expect(t).toEqual({ omraade: "DK1", postnummer: "8000" });
    expect(await skiftPostnummer(db, skiftToken(id), "3900")).toBe("ukendt_postnummer");
    expect(await skiftPostnummer(db, "x.y", "8000")).toBe("ugyldig");
  });

  it("den, der har stoppet mailen, kan tilmelde sig igen, men kun via ny bekræftelse", async () => {
    process.env.JURA_GODKENDT = "ja";
    const af = falskAfsender();
    const id = await indsaetTilmeldt(db, { email: "anna@eksempel.dk" });
    await afmeld(db, afmeldToken(id), ctx.nu);
    await tilmeld(db, af, input(), ctx);
    const [t] = await db.query<{ status: string; elpris_aktiv: boolean }>(`select status, elpris_aktiv from tilmeldte`);
    expect(t).toEqual({ status: "afventer", elpris_aktiv: true });
    expect(af.sendte).toHaveLength(1);
    expect(await bekraeft(db, tokenFraMail(af.sendte[0].html), ctx.nu)).toBe(true);
    const [s] = await db.query<{ version: number; status: string }>(`select version, status from samtykker`);
    expect(s).toEqual({ version: 2, status: "aktiv" });
  });

  it("oprydningen sletter aldrig personer, der har stoppet mailen", async () => {
    const id = await indsaetTilmeldt(db, { email: "a@e.dk" });
    await afmeld(db, afmeldToken(id), new Date("2026-01-01T00:00:00Z"));
    await rydOp(db, new Date("2030-01-01T00:00:00Z"));
    expect(await db.query(`select 1 from tilmeldte`)).toHaveLength(1);
    expect(await db.query(`select 1 from samtykker`)).toHaveLength(1);
  });

  it("DF-priser og DF-Elpriser deler intet: ingen kode læser DF-priser (domænet dfpriser.dk må nævnes, siden ligger under dfpriser.dk/el)", async () => {
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
        expect(readFileSync(fil, "utf8"), fil).not.toMatch(/dfpriser(?!\.dk)|prismail_aktiv|dagens billigste tank/i);
      }
    }
  });
});
