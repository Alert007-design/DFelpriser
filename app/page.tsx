import { juraGodkendt } from "@/lib/config";
import { offentligeDage, gemtePrognoser, type Dagsvisning } from "@/lib/offentlig";
import { IKKE_MEDREGNET, KILDE_TEKST, PRAEMISSE_PROGNOSE } from "@/lib/mail/skabeloner";
import { omraadeForPostnummer, omraadeNavn } from "@/lib/omraade";
import { besparelseKr } from "@/lib/pris/dag";
import { kroner, oere, periodeTekst } from "@/lib/pris/format";
import { OMRAADER, type Omraade } from "@/lib/pris/typer";
import { ELPRIS_SAMTYKKE, POLITIK_SAMTYKKE } from "@/lib/samtykke";
import { tekstHash } from "@/lib/samtykke-bevis";
import { laesbarDato, stortFoerst } from "@/lib/tid";
import { Prisgraf } from "./graf";
import { Tilmeldingsformular } from "./tilmeldingsformular";

export const dynamic = "force-dynamic";

function Dag({ d, titel }: { d: Dagsvisning; titel: string }) {
  const o = d.opsummering;
  return (
    <section className="rude">
      <span className="maerke kendt">Kendte priser</span>
      {d.testdata && <span className="maerke test"> Testdata, ikke rigtige priser</span>}
      <h2>
        {titel}: {stortFoerst(laesbarDato(d.dato))}
      </h2>
      <div className="kort-raekke">
        <div className="kort groen">
          <div className="lille">Billigste periode</div>
          <div className="stor">{periodeTekst(o.billigste)}</div>
          <div>{oere(o.billigste.gennemsnit)} øre/kWh i gennemsnit</div>
        </div>
        <div className="kort roed">
          <div className="lille">Dyreste periode</div>
          <div className="stor">{periodeTekst(o.dyreste)}</div>
          <div>{oere(o.dyreste.gennemsnit)} øre/kWh i gennemsnit</div>
        </div>
      </div>
      <p>
        Gennemsnitspris: <strong>{oere(o.gennemsnit)} øre/kWh</strong>. Forskel mellem dyreste og billigste periode:{" "}
        <strong>{oere(o.forskel)} øre/kWh</strong>. Flytter du 10 kWh fra den dyreste til den billigste periode, er prisforskellen{" "}
        <strong>{kroner(besparelseKr(o, 10))} kr.</strong> (kun spotprisen, et regneeksempel).
      </p>
      <Prisgraf serie={d.serie} billigste={o.billigste} dyreste={o.dyreste} titel={`Elpris pr. time ${d.dato}`} />
    </section>
  );
}

export default async function Forside({ searchParams }: { searchParams: Promise<{ omraade?: string; postnummer?: string }> }) {
  const sp = await searchParams;
  const fraPostnummer = sp.postnummer ? omraadeForPostnummer(sp.postnummer.trim()) : null;
  const valgt: Omraade = fraPostnummer ?? (sp.omraade === "DK1" ? "DK1" : "DK2");
  const nu = new Date();
  const { idag, imorgen } = await offentligeDage(valgt, nu);
  const kendteDatoer = new Set([idag?.dato, imorgen?.dato]);
  const prognoser = (await gemtePrognoser(valgt, nu)).filter((p) => !kendteDatoer.has(p.dato));
  const samtykker = {
    elpris: { ...ELPRIS_SAMTYKKE, hash: tekstHash(ELPRIS_SAMTYKKE.tekst) },
    politik: { ...POLITIK_SAMTYKKE, hash: tekstHash(POLITIK_SAMTYKKE.tekst) },
  };

  return (
    <main>
      <section className="rude">
        <h2>Hvornår er strømmen billigst?</h2>
        <p>
          Hver dag offentliggør elmarkedet morgendagens priser. Her kan du se, hvornår strømmen er billigst og dyrest, og
          hvad du kan spare ved at flytte for eksempel opladning af elbilen eller en vask til de billige timer. Du behøver
          ikke tilmelde dig for at se priserne.
        </p>
        <nav className="faner" aria-label="Vælg elprisområde">
          {OMRAADER.map((o) => (
            <a key={o} className="fane" href={`/?omraade=${o}`} aria-current={o === valgt}>
              {o} – {omraadeNavn(o)}
            </a>
          ))}
        </nav>
        <form method="get" action="/" className="felt" style={{ maxWidth: 320 }}>
          <label htmlFor="pn">Find dit område med postnummer</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="pn" name="postnummer" inputMode="numeric" pattern="\d{4}" maxLength={4} defaultValue={sp.postnummer ?? ""} />
            <button className="knap sekundaer" style={{ marginTop: 0 }} type="submit">
              Vis
            </button>
          </div>
          {sp.postnummer && !fraPostnummer && <p className="feltfejl">Vi kender ikke det postnummer.</p>}
        </form>
      </section>

      {imorgen ? <Dag d={imorgen} titel="I morgen" /> : (
        <section className="rude">
          <h2>Morgendagens priser er ikke offentliggjort endnu</h2>
          <p>Priserne for næste døgn offentliggøres normalt om eftermiddagen. Vi viser kun priser, der er offentliggjort.</p>
        </section>
      )}

      {prognoser.length > 0 && (
        <section className="rude">
          <span className="maerke prognose">Prognose</span>
          <h2>De følgende dage: forventede priser</h2>
          <p><strong>Disse tal er en prognose, ikke offentliggjorte priser.</strong></p>
          {prognoser.map((p) => (
            <div className="prognose-boks" key={p.dato}>
              <strong>{stortFoerst(laesbarDato(p.dato))} (prognose)</strong>
              <br />
              Forventet billigste periode: Kl. {String(p.billigste.startTime).padStart(2, "0")}–{String(p.billigste.slutTime).padStart(2, "0")}
              <br />
              Forventet gennemsnitspris: {oere(p.gennemsnit)} øre/kWh (i 8 ud af 10 af modellens seneste prognoser lå den faktiske gennemsnitspris mellem {oere(p.gennemsnitInterval.lav)} og {oere(p.gennemsnitInterval.hoej)})
              <br />
              Forventet laveste og højeste timepris: {oere(p.laveste)} og {oere(p.hoeyeste)} øre/kWh
              <br />
              Usikkerhed: {{ lav: "lav", middel: "middel", hoej: "høj" }[p.usikkerhed]}
            </div>
          ))}
        </section>
      )}

      {idag && <Dag d={idag} titel="I dag" />}

      <p className="forbehold">
        <strong>{PRAEMISSE_PROGNOSE}</strong>
        <br />
        {IKKE_MEDREGNET}
        <br />
        Kilde: {KILDE_TEKST}. Se <a href="/om-priserne">hvordan priserne og prognosen beregnes</a>.
      </p>

      <Tilmeldingsformular samtykker={samtykker} aaben={juraGodkendt()} />
    </main>
  );
}
