import { laegDage } from "../tid";
import { billigsteVindue, forudsig, middel, type Historik, type Timeprofil } from "./model";

export interface Maal {
  /** Antal prognosedage, der er målt på. */
  dage: number;
  /** Gennemsnitlig absolut fejl på døgnets gennemsnitspris (øre/kWh). */
  maeDagsgennemsnit: number;
  /** Gennemsnitlig absolut fejl pr. time (øre/kWh). */
  maeTime: number;
  /** Hvor meget dyrere (øre/kWh) det faktisk blev at bruge strøm i det forudsagte billigste tretimersvindue end i det faktisk billigste. */
  fortrydelse: number;
  /** Andel dage, hvor det forudsagte og det faktiske billigste vindue overlapper med mindst to timer. */
  trefProcent: number;
}

export interface Udfald {
  model: Maal;
  /** Gentag seneste kendte dag. */
  naivSidsteDag: Maal;
  /** Samme ugedag i sidste uge (relativt til seneste kendte dag). */
  naivSidsteUge: Maal;
}

function maalFra(par: { prog: Timeprofil; fakta: Timeprofil }[]): Maal {
  const fejlGns = par.map((p) => Math.abs(middel(p.prog) - middel(p.fakta)));
  const fejlTime = par.flatMap((p) => p.prog.map((v, t) => Math.abs(v - p.fakta[t])));
  const fortrydelse = par.map((p) => {
    const forudsagt = billigsteVindue(p.prog).start;
    const faktisk = billigsteVindue(p.fakta);
    return middel(p.fakta.slice(forudsagt, forudsagt + 3)) - faktisk.gennemsnit;
  });
  const traef = par.map((p) => {
    const a = billigsteVindue(p.prog).start;
    const b = billigsteVindue(p.fakta).start;
    return Math.max(0, 3 - Math.abs(a - b)) >= 2 ? 1 : 0;
  });
  const n = par.length;
  return {
    dage: n,
    maeDagsgennemsnit: middel(fejlGns),
    maeTime: middel(fejlTime),
    fortrydelse: middel(fortrydelse),
    trefProcent: (100 * traef.reduce((a: number, b: number) => a + b, 0)) / n,
  };
}

/**
 * Tilbageskuende test: for hver dag K i perioden forudsiges dag K+horisont kun ud fra priser kendt til og
 * med K, og sammenlignes med det faktiske udfald. Modellen sammenlignes med to enkle metoder.
 * horisont 1 = dag 2 efter udsendelsen, horisont 2 = dag 3.
 */
export function tilbageskuendeTest(historik: Historik, fraKendt: string, tilKendt: string, horisont: 1 | 2): Udfald | null {
  const model: { prog: Timeprofil; fakta: Timeprofil }[] = [];
  const dag: typeof model = [];
  const uge: typeof model = [];
  for (let k = fraKendt; k <= tilKendt; k = laegDage(k, 1)) {
    const maal = laegDage(k, horisont);
    const fakta = historik.get(maal);
    const p = forudsig(historik, k, maal);
    const sidsteUge = historik.get(laegDage(maal, -7));
    if (!fakta || !p || !historik.get(k) || !sidsteUge) continue;
    model.push({ prog: p, fakta });
    dag.push({ prog: historik.get(k)!, fakta });
    uge.push({ prog: sidsteUge, fakta });
  }
  if (model.length === 0) return null;
  return { model: maalFra(model), naivSidsteDag: maalFra(dag), naivSidsteUge: maalFra(uge) };
}

/**
 * Kravene, en prognose skal opfylde, før den vises. Tallene er et forslag til godkendelse:
 *  - mindst 45 målte dage,
 *  - dagsgennemsnittets fejl mindst 5 % lavere end begge enkle metoder, og
 *  - fortrydelsen ved billigste vindue mindst 5 % lavere end begge enkle metoder.
 */
export const KRAV = { minDage: 45, forbedring: 0.95 };

export function bestaarKrav(u: Udfald | null): { bestaaet: boolean; begrundelse: string } {
  if (!u) return { bestaaet: false, begrundelse: "ingen målinger" };
  if (u.model.dage < KRAV.minDage) return { bestaaet: false, begrundelse: `kun ${u.model.dage} målte dage, kræver ${KRAV.minDage}` };
  const m = u.model;
  for (const [navn, n] of [
    ["sidste dag", u.naivSidsteDag],
    ["sidste uge", u.naivSidsteUge],
  ] as const) {
    if (!(m.maeDagsgennemsnit <= n.maeDagsgennemsnit * KRAV.forbedring)) {
      return { bestaaet: false, begrundelse: `dagsgennemsnittet er ikke tydeligt bedre end metoden "${navn}"` };
    }
    if (!(m.fortrydelse <= n.fortrydelse * KRAV.forbedring)) {
      return { bestaaet: false, begrundelse: `billigste vindue er ikke tydeligt bedre end metoden "${navn}"` };
    }
  }
  return { bestaaet: true, begrundelse: "modellen slår begge enkle metoder" };
}
