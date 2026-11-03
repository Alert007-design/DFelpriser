import { omraadeNavn } from "./omraade";
import type { Dagsvisning } from "./offentlig";
import { periodeTekst } from "./pris/format";
import type { Omraade } from "./pris/typer";

export interface ForsidePeriode {
  omraade: Omraade;
  /** "Østdanmark" eller "Vestdanmark". */
  navn: string;
  /** "I morgen", når morgendagens priser er offentliggjort, ellers "I dag". */
  hvornaar: "I morgen" | "I dag";
  dato: string;
  /** "kl. 00–03" */
  tid: string;
  /** "168 øre/kWh i gennemsnit" */
  gennemsnit: string;
  testdata: boolean;
}

type Dage = { idag: Dagsvisning | null; imorgen: Dagsvisning | null };

/**
 * Det, forsiden på dfpriser.dk/el viser (Morten, 3/11-2026): billigste periode for Øst og Vest, i morgen hvis
 * priserne er offentliggjort, ellers i dag. Et område uden kendte priser udelades. Der gættes aldrig.
 */
export function forsidePerioder(dage: Record<Omraade, Dage>): ForsidePeriode[] {
  const raekkefoelge: Omraade[] = ["DK2", "DK1"];
  return raekkefoelge.flatMap((omraade) => {
    const { idag, imorgen } = dage[omraade];
    const v = imorgen ?? idag;
    if (!v) return [];
    const b = v.opsummering.billigste;
    return [
      {
        omraade,
        navn: omraadeNavn(omraade).split(" (")[0],
        hvornaar: imorgen ? ("I morgen" as const) : ("I dag" as const),
        dato: v.dato,
        tid: periodeTekst(b).replace("Kl. ", "kl. "),
        gennemsnit: `${Math.round(b.gennemsnit)} øre/kWh i gennemsnit`,
        testdata: v.testdata,
      },
    ];
  });
}
