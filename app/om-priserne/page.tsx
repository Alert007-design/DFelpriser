import type { Metadata } from "next";
import { IKKE_MEDREGNET, KILDE_TEKST } from "@/lib/mail/skabeloner";
import { KRAV } from "@/lib/prognose/evaluering";

export const metadata: Metadata = { title: "Om priserne og prognosen – DF-Elpriser" };

export default function OmPriserne() {
  return (
    <main className="side">
      <div className="rude">
        <h2>Om priserne</h2>
        <p>Kilde: {KILDE_TEKST}. Priserne er markedets spotpriser for næste døgn, opgjort i 15-minutters-intervaller, og vi viser dem i øre pr. kWh. Vi bruger kun priser, der er officielt offentliggjort. Mangler en del af døgnet, sender vi ingenting.</p>
        <p><strong>Det er ikke regnet med.</strong> {IKKE_MEDREGNET}</p>
        <p>Det billigste og dyreste tidsrum er det billigste og dyreste sammenhængende tidsrum på tre timer i et døgn. Besparelseseksemplet ganger prisforskellen mellem de to tidsrum med 10 kWh. Det viser, hvad forskellen i spotprisen er, ikke hvad din egen regning bliver.</p>
        <h2>Om prognosen</h2>
        <p>Priserne for dag to og tre er en prognose og ikke kendte priser. Modellen bygger på prisernes forløb de seneste uger: hvordan et almindeligt døgn ser ud for hverdage og fridage, og hvor niveauet ligger lige nu. Den kender ikke vejret.</p>
        <p>Vi viser kun prognosen, når modellen i en tilbageskuende test på de seneste 90 dage har gjort det tydeligt bedre end to enkle metoder (at gentage den seneste dag og at gentage samme ugedag fra sidste uge). Kravet er mindst {KRAV.minDage} målte dage og mindst 5 procent lavere fejl. Er kravet ikke opfyldt, viser vi ingen prognose i stedet for at gætte.</p>
        <p>Usikkerheden angives ud fra modellens egne fejl de seneste 60 dage.</p>
      </div>
    </main>
  );
}
