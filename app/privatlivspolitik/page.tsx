import type { Metadata } from "next";
import { afmeldtOpbevaringDage, juraGodkendt } from "@/lib/config";
import { ELPRIS_SAMTYKKE, POLITIK_SAMTYKKE } from "@/lib/samtykke";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privatlivspolitik – DF-Elpriser" };

export default function Privatlivspolitik() {
  return (
    <main className="side">
      {!juraGodkendt() && (
        <p className="udkast">
          <strong>Udkast.</strong> Denne privatlivspolitik er ikke juridisk godkendt endnu. Punkter markeret med [skal bekræftes] mangler en afklaring, før tjenesten åbnes.
        </p>
      )}
      <div className="rude">
        <h2>Privatlivspolitik for DF-Elpriser</h2>
        <h3>Hvem er dataansvarlig?</h3>
        <p>
          Dansk Folkeparti Landsorganisationen, CVR 20857390, Søndergade 1, 7361 Ejstrupholm, er dataansvarlig for de oplysninger, du giver ved tilmelding til DF-Elpriser [skal bekræftes: at dette er den rigtige juridiske enhed]. Kontakt: <a href="mailto:df@df.dk">df@df.dk</a>.
        </p>
        <h3>Hvilke oplysninger behandler vi, og hvorfor?</h3>
        <p>Vi behandler din e-mailadresse og dit postnummer. Postnummeret bruges til at finde dit elprisområde (Vestdanmark eller Østdanmark), så du får de rigtige priser. Formålet er at sende dig et dagligt nyhedsbrev kl. 16 med morgendagens elpriser og en prognose for de to følgende dage.</p>
        <p>Hvis du har sat kryds i det frivillige felt, bruger vi også din e-mailadresse og dit postnummer til at sende dig information om Dansk Folkepartis politik og politiske udspil i samme mail. Uden det kryds får du ingen politisk information.</p>
        <p>Vi gemmer desuden, hvornår du tilmeldte dig og bekræftede, hvilken tekst du samtykkede til (versionsnummer og ordlyd), og hvornår du eventuelt trak samtykket tilbage. Vi gemmer, hvilke dage vi har sendt dig en mail, men ikke indholdet. Vi indsamler ikke dit navn og bruger ingen sporings- eller statistikcookies.</p>
        <h3>Retsgrundlag</h3>
        <p>Din tilmelding kan afsløre politisk interesse, fordi afsenderen er et politisk parti. Vi behandler derfor oplysningerne på grundlag af dit udtrykkelige samtykke, jf. databeskyttelsesforordningens artikel 6, stk. 1, litra a, og artikel 9, stk. 2, litra a. Samtykket er frivilligt. Du kan trække det tilbage når som helst.</p>
        <p>De to samtykker, du kan give, lyder:</p>
        <blockquote>{ELPRIS_SAMTYKKE.tekst}</blockquote>
        <blockquote>{POLITIK_SAMTYKKE.tekst}</blockquote>
        <h3>Hvor længe gemmer vi oplysningerne?</h3>
        <p>Ubekræftede tilmeldinger slettes automatisk efter 72 timer. Aktive tilmeldinger gemmes, så længe du er tilmeldt. Afmelder du dig, trækkes samtykket tilbage, og vi stopper alle mails. Vi gemmer derefter en registrering af tilmelding, samtykke og afmelding i {afmeldtOpbevaringDage()} dage som dokumentation [skal bekræftes af jurist], hvorefter den slettes. Du kan altid få alt slettet med det samme via linket på afmeldingssiden eller ved at skrive til os.</p>
        <h3>Hvem modtager oplysningerne?</h3>
        <p>Vi bruger databehandlere til at drive tjenesten: Supabase (database), Resend (udsendelse af e-mail) og Vercel (hjemmeside og planlagte job). De behandler kun oplysningerne efter vores instruks. [Skal bekræftes: databehandleraftaler, placering af data i EU og eventuelle overførsler til tredjelande.] Vi videregiver ikke oplysningerne til andre og overfører ikke abonnenter fra andre af partiets tjenester.</p>
        <h3>Dine rettigheder</h3>
        <p>Du har ret til indsigt i, hvad vi har om dig, til at få rettet og slettet oplysninger, til at begrænse behandlingen, til dataportabilitet og til at gøre indsigelse. Skriv til <a href="mailto:df@df.dk">df@df.dk</a>. Du kan klage til Datatilsynet, <a href="https://www.datatilsynet.dk">datatilsynet.dk</a>.</p>
      </div>
    </main>
  );
}
