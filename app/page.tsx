import { juraGodkendt } from "@/lib/config";
import { forsidePerioder } from "@/lib/forside";
import { offentligeDage } from "@/lib/offentlig";
import { KILDE_TEKST } from "@/lib/mail/skabeloner";
import { ELPRIS_SAMTYKKE } from "@/lib/samtykke";
import { tekstHash } from "@/lib/samtykke-bevis";
import { laesbarDato } from "@/lib/tid";
import { FraFacebookTaeller } from "./fra-facebook-taeller";
import { Tilmeldingsformular } from "./tilmeldingsformular";
import { sti } from "@/lib/sti";

export const dynamic = "force-dynamic";

/**
 * Forsiden er en tilmeldingsside (Morten, 3/11-2026): den viser kun, hvornår strømmen er billigst i Øst- og
 * Vestdanmark, og formularen lige under. Graf, dyreste tidspunkt og sammenligning får man i mailen.
 */
export default async function Forside() {
  const nu = new Date();
  const perioder = forsidePerioder({
    DK2: await offentligeDage("DK2", nu),
    DK1: await offentligeDage("DK1", nu),
  });
  const samtykke = { ...ELPRIS_SAMTYKKE, hash: tekstHash(ELPRIS_SAMTYKKE.tekst) };
  const imorgen = perioder.length > 0 && perioder.every((p) => p.hvornaar === "I morgen");

  return (
    <main>
      <section className="rude">
        <h2>{imorgen ? "Her bliver strømmen billigst i morgen" : "Her er strømmen billigst"}</h2>
        {perioder.length > 0 ? (
          <div className="kort-raekke">
            {perioder.map((p) => (
              <div className="kort groen" key={p.omraade}>
                <div className="lille">
                  {p.navn} · {p.hvornaar.toLowerCase()}, {laesbarDato(p.dato).replace(" den ", " ")}
                  {p.testdata && " · testdata, ikke rigtige priser"}
                </div>
                <div className="stor">{p.tid}</div>
                <div>{p.gennemsnit}</div>
              </div>
            ))}
          </div>
        ) : (
          <p>Priserne for næste døgn offentliggøres normalt om eftermiddagen. Vi viser kun priser, der er offentliggjort.</p>
        )}
        <p>
          Tilmeld dig, og få hver dag kl. 16 en mail med morgendagens billigste og dyreste tidspunkt i dit område og en
          graf over hele døgnet.
        </p>
        <p className="forbehold">
          Kun spotprisen før moms. Nettarif, elafgift, moms, abonnement og elselskabets tillæg er ikke regnet med. Kilde:{" "}
          {KILDE_TEKST}. <a href={sti("/om-priserne")}>Om priserne</a>.
        </p>
      </section>

      <Tilmeldingsformular samtykke={samtykke} aaben={juraGodkendt()} />
      <FraFacebookTaeller />
    </main>
  );
}
