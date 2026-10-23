import postgres from "postgres";

/** Det eneste, resten af koden kender til databasen. Gør det muligt at teste mod PGlite. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

let delt: Db | undefined;

/** Forbindelse til Supabase via DATABASE_URL (transaction pooler, derfor prepare: false). */
export function hentDb(): Db {
  if (delt) return delt;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL mangler");
  const sql = postgres(url, { prepare: false, max: 5, ssl: "require" });
  delt = {
    async query<T>(tekst: string, params: unknown[] = []) {
      const rows = await sql.unsafe(tekst, params as never[]);
      return rows as unknown as T[];
    },
  };
  return delt;
}
