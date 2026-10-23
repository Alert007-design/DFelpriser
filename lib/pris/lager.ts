import type { Db } from "../db";
import type { Priskilde } from "../kilder/typer";
import { dagensGraenser, laegDage } from "../tid";
import { erFuldDag } from "./dag";
import { OMRAADER, type Omraade, type Slot } from "./typer";
import { lokalTimeprofil } from "../prognose/model";
import type { Historik } from "../prognose/model";

interface Raekke {
  start_utc: string | Date;
  minutter: number;
  oere_kwh: number;
}

export async function hentSlots(db: Db, omr: Omraade, dato: string): Promise<Slot[]> {
  const { start, slut } = dagensGraenser(dato);
  const rows = await db.query<Raekke>(
    `select start_utc, minutter, oere_kwh from spotpriser
     where omraade = $1 and start_utc >= $2 and start_utc < $3 order by start_utc`,
    [omr, start.toISOString(), slut.toISOString()],
  );
  return rows.map((r) => ({ start: new Date(r.start_utc), minutter: r.minutter, oerePrKwh: Number(r.oere_kwh) }));
}

/** Kun døgn med fuldstændige data. Døgn med huller udelades, aldrig udfyldes. */
export async function hentHistorik(db: Db, omr: Omraade, tilDato: string, dage: number): Promise<Historik> {
  const fra = laegDage(tilDato, -(dage - 1));
  const rows = await db.query<Raekke>(
    `select start_utc, minutter, oere_kwh from spotpriser
     where omraade = $1 and start_utc >= $2 and start_utc < $3 order by start_utc`,
    [omr, dagensGraenser(fra).start.toISOString(), dagensGraenser(tilDato).slut.toISOString()],
  );
  const alle = rows.map((r) => ({ start: new Date(r.start_utc), minutter: r.minutter, oerePrKwh: Number(r.oere_kwh) }));
  const h: Historik = new Map();
  for (let d = fra; d <= tilDato; d = laegDage(d, 1)) {
    const { start, slut } = dagensGraenser(d);
    const dagen = alle.filter((s) => s.start >= start && s.start < slut);
    if (erFuldDag(d, dagen).fuld) h.set(d, lokalTimeprofil(dagen));
  }
  return h;
}

export interface HentResultat {
  omraade: Omraade;
  dato: string;
  fuld: boolean;
  aarsag?: string;
}

async function log(db: Db, kilde: string, omr: Omraade | null, fra: string, til: string, status: "ok" | "fejl" | "ufuldstaendig", antal: number, besked?: string) {
  await db.query(
    `insert into hentelog (kilde, omraade, fra_dato, til_dato, status, antal, besked) values ($1,$2,$3,$4,$5,$6,$7)`,
    [kilde, omr, fra, til, status, antal, besked ?? null],
  );
}

/**
 * Henter priser for de danske kalenderdage fra `fra` til og med `til`, gemmer dem og logger resultatet.
 * Allerede gemte priser overskrives kun, hvis kilden nu giver en anden værdi, og det logges som advarsel.
 * Returnerer for hver dag og hvert område, om døgnet nu er fuldstændigt.
 */
export async function hentOgGem(db: Db, kilde: Priskilde, fra: string, til: string): Promise<HentResultat[]> {
  const start = dagensGraenser(fra).start;
  const slut = dagensGraenser(til).slut;
  let data;
  try {
    data = await kilde.hent(start, slut);
  } catch (fejl) {
    const besked = fejl instanceof Error ? fejl.message : String(fejl);
    await log(db, kilde.navn, null, fra, til, "fejl", 0, besked);
    await db.query(`insert into driftslog (niveau, kilde, besked) values ('fejl', 'hent-priser', $1)`, [besked]);
    throw fejl;
  }
  const resultat: HentResultat[] = [];
  for (const omr of OMRAADER) {
    const slots = data[omr];
    let aendrede = 0;
    for (let i = 0; i < slots.length; i += 500) {
      const del = slots.slice(i, i + 500);
      const [r] = await db.query<{ aendrede: number }>(
        `with inn as (select * from unnest($2::timestamptz[], $3::int[], $4::float8[]) as t(start_utc, minutter, oere_kwh)),
              gammel as (select s.start_utc from spotpriser s join inn using (start_utc) where s.omraade = $1),
              ny as (
                insert into spotpriser (omraade, start_utc, minutter, oere_kwh, kilde)
                select $1, start_utc, minutter, oere_kwh, $5 from inn
                on conflict (omraade, start_utc) do update
                  set oere_kwh = excluded.oere_kwh, minutter = excluded.minutter, kilde = excluded.kilde, hentet = now()
                  where spotpriser.oere_kwh is distinct from excluded.oere_kwh
                returning start_utc)
         select count(*)::int as aendrede from ny where start_utc in (select start_utc from gammel)`,
        [omr, del.map((x) => x.start.toISOString()), del.map((x) => x.minutter), del.map((x) => x.oerePrKwh), kilde.navn],
      );
      aendrede += r.aendrede;
    }
    if (aendrede > 0) {
      await db.query(`insert into driftslog (niveau, kilde, besked) values ('advarsel', 'hent-priser', $1)`, [
        `${aendrede} allerede gemte priser for ${omr} fik en ny værdi fra kilden`,
      ]);
    }
    let fuldeDage = 0;
    for (let d = fra; d <= til; d = laegDage(d, 1)) {
      const g = dagensGraenser(d);
      const f = erFuldDag(d, slots.filter((s) => s.start >= g.start && s.start < g.slut));
      resultat.push({ omraade: omr, dato: d, fuld: f.fuld, aarsag: f.fuld ? undefined : f.aarsag });
      if (f.fuld) fuldeDage++;
    }
    const dageIAlt = resultat.filter((r) => r.omraade === omr).length;
    await log(db, kilde.navn, omr, fra, til, fuldeDage === dageIAlt ? "ok" : "ufuldstaendig", slots.length,
      fuldeDage === dageIAlt ? undefined : `${fuldeDage} af ${dageIAlt} døgn fuldstændige`);
  }
  return resultat;
}
