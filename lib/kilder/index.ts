import { priskilde } from "../config";
import { energiDataService } from "./energidataservice";
import { testKilde } from "./test";
import type { Priskilde } from "./typer";

/** PRISKILDE=live bruger Energi Data Service. Alt andet bruger opdigtede testdata, som aldrig sendes til rigtige modtagere. */
export function valgKilde(): Priskilde {
  return priskilde() === "live" ? energiDataService() : testKilde();
}
