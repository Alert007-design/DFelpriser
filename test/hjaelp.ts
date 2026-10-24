import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "@/lib/db";
import type { Afsender, Mail } from "@/lib/mail/afsender";
import { hentOgGem } from "@/lib/pris/lager";
import { testKilde } from "@/lib/kilder/test";
import { laegDage } from "@/lib/tid";
import { hashToken } from "@/lib/tokens";

const MIGRATIONER = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));

/** En frisk Postgres i hukommelsen med projektets rigtige migrationer. */
export async function nyDb(): Promise<Db & { pg: PGlite }> {
  const pg = new PGlite();
  for (const fil of readdirSync(MIGRATIONER).sort()) await pg.exec(readFileSync(join(MIGRATIONER, fil), "utf8"));
  return {
    pg,
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pg.query<T>(sql, params);
      return res.rows;
    },
  };
}

export interface FalskAfsender extends Afsender {
  sendte: Mail[];
  noegler: string[];
  fejlNaeste?: boolean;
}

export function falskAfsender(): FalskAfsender {
  let n = 0;
  const a: FalskAfsender = {
    sendte: [],
    noegler: [],
    async send(mail) {
      a.sendte.push(mail);
      return `id-${++n}`;
    },
    async sendPortion(mails, noegle) {
      await new Promise((r) => setTimeout(r, 5));
      if (a.fejlNaeste) {
        a.fejlNaeste = false;
        throw new Error("simuleret fejl");
      }
      a.noegler.push(noegle);
      a.sendte.push(...mails);
      return mails.map(() => `id-${++n}`);
    },
  };
  return a;
}

export async function indsaetTilmeldt(
  db: Db,
  o: { email: string; omraade?: "DK1" | "DK2"; postnummer?: string; status?: string; test?: boolean; politik?: boolean; version?: 1 | 2; elprisAktiv?: boolean },
): Promise<string> {
  const omraade = o.omraade ?? "DK2";
  const postnummer = o.postnummer ?? (omraade === "DK2" ? "2100" : "8000");
  const [{ id }] = await db.query<{ id: string }>(
    `insert into tilmeldte (email, postnummer, omraade, status, test, bekraeftet_tidspunkt, bekraeft_token_hash, elpris_aktiv, elpris_stoppet)
     values ($1,$2,$3,$4,$5, now(), $6, $7, case when $7 then null else now() end) returning id`,
    [o.email, postnummer, omraade, o.status ?? "aktiv", o.test ?? false, hashToken(o.email), o.elprisAktiv ?? true],
  );
  // Standard er den gældende tekst (version 2). version: 1 efterligner en tilmelding fra før omlægningen.
  const version = o.version ?? 2;
  const aktiv = (o.status ?? "aktiv") === "aktiv";
  for (const type of ["elpris", ...(o.politik ? ["politik"] : [])]) {
    await db.query(
      `insert into samtykker (tilmeldt_id, type, version, ordlyd, givet, bekraeftet, status)
       select $1, type, version, tekst, now(), ${aktiv ? "now()" : "null"}, $3 from samtykketekster
       where type = $2 and version = case when $2 = 'elpris' then $4::int else 1 end`,
      [id, type, aktiv ? "aktiv" : "afventer", version],
    );
  }
  return id;
}

/** Fylder databasen med testpriser (opdigtede) for en række danske dage. */
export async function indsaetTestpriser(db: Db, fra: string, til: string) {
  await hentOgGem(db, testKilde(), fra, til);
}

export function dageFoer(dato: string, n: number) {
  return laegDage(dato, -n);
}

/**
 * OPDIGTET historik i timeopløsning til test af prognosen: fast døgnforløb, tilfældigt dagsniveau og timestøj.
 * Giver en historik, hvor modellen tydeligt slår de enkle metoder. Ikke rigtige priser.
 */
export async function indsaetOpdigtetHistorik(db: Db, omr: "DK1" | "DK2", tilDato: string, dage: number, kilde: string) {
  const { dagensGraenser } = await import("@/lib/tid");
  let a = 7;
  const u = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const n = () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
  for (let i = dage - 1; i >= 0; i--) {
    const d = laegDage(tilDato, -i);
    const { start, slut } = dagensGraenser(d);
    const niveau = 80 + 20 * n();
    const tider: string[] = [];
    const priser: number[] = [];
    for (let t = start.getTime(); t < slut.getTime(); t += 3_600_000) {
      const lokal = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hourCycle: "h23" }).format(new Date(t)));
      tider.push(new Date(t).toISOString());
      priser.push(niveau + 40 * Math.exp(-(((lokal - 19) / 2) ** 2)) - 30 * Math.exp(-(((lokal - 13) / 3) ** 2)) + 5 * n());
    }
    await db.query(
      `insert into spotpriser (omraade, start_utc, minutter, oere_kwh, kilde)
       select $1, unnest($2::timestamptz[]), 60, unnest($3::float8[]), $4 on conflict do nothing`,
      [omr, tider, priser, kilde],
    );
  }
}
