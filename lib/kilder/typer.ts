import type { Omraade, Slot } from "../pris/typer";

/** En kilde til offentliggjorte spotpriser (day-ahead). Giver kun det, kilden faktisk har offentliggjort. */
export interface Priskilde {
  /** Gemmes sammen med hver pris og i loggen. */
  navn: string;
  /**
   * Alle intervaller, der starter fra og med `fra` og før `til` (UTC). Områder uden data mangler i svaret
   * eller har en tom liste. Kaster en fejl, hvis kilden svarer forkert eller utydeligt.
   */
  hent(fra: Date, til: Date): Promise<Record<Omraade, Slot[]>>;
}
