import { dkkMwhTilOereKwh } from "../pris/dag";
import type { Omraade, Slot } from "../pris/typer";
import type { Priskilde } from "./typer";

/**
 * Energi Data Service (Energinet), datasættet DayAheadPrices: officielle day-ahead-priser for DK1 og DK2.
 * Åbne data under licensen CC BY 4.0, ingen nøgle. Priserne er i DKK pr. MWh og regnes om til øre pr. kWh.
 *
 * Feltnavnene (TimeUTC, PriceArea, DayAheadPriceDKK) er taget fra datasættets dokumentation, som den er
 * beskrevet i åbne klientbiblioteker; udviklingsmiljøet havde ikke adgang til api.energidataservice.dk, så
 * svaret er ikke prøvet mod den rigtige tjeneste. Parseren er derfor streng: svarer tjenesten med andre
 * felter, tomme priser eller uens intervaller, kastes en fejl, og systemet sender ingenting.
 */
export const EDS_URL = "https://api.energidataservice.dk/dataset/DayAheadPrices";

type Hent = (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<Response>;

interface Raekke {
  TimeUTC: unknown;
  PriceArea: unknown;
  DayAheadPriceDKK: unknown;
}

const TIMEOUT_MS = 20_000;
const FORSOEG = 3;

export function lavUrl(fra: Date, til: Date): string {
  // Tidsgrænserne gives i UTC med ekstra margen og filtreres bagefter, så der ikke afhænges af, hvordan
  // tjenesten fortolker tidszonen i start og end.
  const t = (d: Date) => d.toISOString().slice(0, 16);
  const margen = 2 * 3_600_000;
  const p = new URLSearchParams({
    start: t(new Date(fra.getTime() - margen)),
    end: t(new Date(til.getTime() + margen)),
    filter: JSON.stringify({ PriceArea: ["DK1", "DK2"] }),
    columns: "TimeUTC,PriceArea,DayAheadPriceDKK",
    sort: "TimeUTC asc",
    limit: "0",
  });
  return `${EDS_URL}?${p.toString()}`;
}

function tidUtc(v: unknown): Date {
  if (typeof v !== "string") throw new Error("TimeUTC er ikke en tekst");
  // Tjenesten angiver UTC uden zoneangivelse ("2026-10-24T22:00:00").
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Ugyldigt tidspunkt: ${v}`);
  return d;
}

/** Omsætter svaret til intervaller. Kaster ved enhver afvigelse fra det forventede format. */
export function tolkSvar(svar: unknown, fra: Date, til: Date, navn: string): Record<Omraade, Slot[]> {
  const raekker = (svar as { records?: unknown })?.records;
  if (!Array.isArray(raekker)) throw new Error("Svaret mangler feltet 'records'");
  const pr: Record<Omraade, { start: Date; oere: number }[]> = { DK1: [], DK2: [] };
  for (const r of raekker as Raekke[]) {
    if (r.PriceArea !== "DK1" && r.PriceArea !== "DK2") continue;
    const start = tidUtc(r.TimeUTC);
    if (start < fra || start >= til) continue;
    if (typeof r.DayAheadPriceDKK !== "number" || !Number.isFinite(r.DayAheadPriceDKK)) {
      throw new Error(`Pris mangler for ${r.PriceArea} ${start.toISOString()}`);
    }
    pr[r.PriceArea].push({ start, oere: dkkMwhTilOereKwh(r.DayAheadPriceDKK) });
  }
  const ud: Record<Omraade, Slot[]> = { DK1: [], DK2: [] };
  for (const omr of ["DK1", "DK2"] as const) {
    const liste = pr[omr].sort((a, b) => a.start.getTime() - b.start.getTime());
    const unikke = new Set(liste.map((x) => x.start.getTime()));
    if (unikke.size !== liste.length) throw new Error(`Dobbeltrækker i svaret for ${omr}`);
    if (liste.length === 0) continue;
    // Opløsningen er afstanden mellem nabointervaller (15 eller 60 minutter). Ét interval alene kan ikke afgøres.
    const afstande = new Set<number>();
    for (let i = 1; i < liste.length; i++) afstande.add((liste[i].start.getTime() - liste[i - 1].start.getTime()) / 60_000);
    const minutter = afstande.size === 0 ? 15 : Math.min(...afstande);
    if (minutter !== 15 && minutter !== 60) throw new Error(`Uventet opløsning for ${omr}: ${minutter} minutter`);
    if ([...afstande].some((a) => a % minutter !== 0)) throw new Error(`Uens intervaller for ${omr}`);
    ud[omr] = liste.map((x) => ({ start: x.start, minutter, oerePrKwh: x.oere }));
  }
  void navn;
  return ud;
}

export function energiDataService(opt: { hent?: Hent } = {}): Priskilde {
  const hent: Hent = opt.hent ?? ((url, init) => fetch(url, init));
  return {
    navn: "energidataservice:DayAheadPrices",
    async hent(fra, til) {
      const url = lavUrl(fra, til);
      let sidsteFejl: unknown;
      for (let forsoeg = 1; forsoeg <= FORSOEG; forsoeg++) {
        try {
          const svar = await hent(url, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { Accept: "application/json", "User-Agent": "DF-Elpriser/1.0 (kontakt: df@df.dk)" },
          });
          // 429 og 5xx forsøges igen; andre fejl er endelige.
          if (svar.status === 429 || svar.status >= 500) throw new Error(`Energi Data Service svarede ${svar.status}`);
          if (!svar.ok) throw Object.assign(new Error(`Energi Data Service svarede ${svar.status}`), { endelig: true });
          return tolkSvar(await svar.json(), fra, til, "energidataservice");
        } catch (fejl) {
          sidsteFejl = fejl;
          if ((fejl as { endelig?: boolean }).endelig || forsoeg === FORSOEG) break;
          await new Promise((r) => setTimeout(r, 1000 * 2 ** (forsoeg - 1)));
        }
      }
      throw sidsteFejl instanceof Error ? sidsteFejl : new Error(String(sidsteFejl));
    },
  };
}
