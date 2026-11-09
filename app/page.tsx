import { juraGodkendt } from "@/lib/config";
import { offentligeDage } from "@/lib/offentlig";
import { IKKE_MEDREGNET } from "@/lib/mail/skabeloner";
import { periodeTekst } from "@/lib/pris/format";
import type { Omraade } from "@/lib/pris/typer";
import { ELPRIS_SAMTYKKE } from "@/lib/samtykke";
import { tekstHash } from "@/lib/samtykke-bevis";
import { FraFacebookTaeller } from "./fra-facebook-taeller";
import { Tilmeldingsformular } from "./tilmeldingsformular";

import type { Metadata } from "next";
import { kanonisk } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: kanonisk("/") } };

/**
 * Siden er bygget som dfpriser.dk/benzin (Mike Kaltoft, 2/11-2026): kun dagens billigste tidspunkt for Øst- og
 * Vestdanmark og tilmeldingen. Resten af oplysningerne får man i mailen. Teaseren er holdt lille, så formularen
 * kan ses uden at scrolle på en mobil (Mike Kaltoft og Morten, 5/11-2026).
 */
const OMRAADER_VIST: { omraade: Omraade; navn: string }[] = [
  { omraade: "DK2", navn: "Østdanmark" },
  { omraade: "DK1", navn: "Vestdanmark" },
];

export default async function Forside() {
  const nu = new Date();
  const dage = await Promise.all(OMRAADER_VIST.map(async (o) => ({ ...o, idag: (await offentligeDage(o.omraade, nu)).idag })));
  const samtykke = { ...ELPRIS_SAMTYKKE, hash: tekstHash(ELPRIS_SAMTYKKE.tekst) };

  return (
    <main className="side">
      <section className="rude teaser">
        <h2>I dag er strømmen billigst</h2>
        <div className="kort-raekke kompakt">
          {dage.map((d) => (
            <div className="kort groen" key={d.omraade}>
              <div className="lille">{d.navn}</div>
              <div className="stor">{d.idag ? periodeTekst(d.idag.opsummering.billigste) : "Ikke klar endnu"}</div>
            </div>
          ))}
        </div>
      </section>

      <Tilmeldingsformular samtykke={samtykke} aaben={juraGodkendt()} />
      <p className="forklaring">{IKKE_MEDREGNET}</p>
      <FraFacebookTaeller />
    </main>
  );
}
