import Link from "next/link";
import type { Metadata } from "next";
import { ELPRIS_SAMTYKKE } from "@/lib/samtykke";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Privatlivspolitik – DF-Elpriser",
  description: "Sådan behandler Dansk Folkeparti dine oplysninger, når du tilmelder dig DF-Elpriser.",
};

/**
 * Privatlivspolitik for DF-Elpriser. Samtykketeksten linker hertil. Samme model som Dansk Folkepartis
 * brændstofpris-tjeneste; godkendt af ejeren 24. oktober 2026 (se docs/GDPR.md).
 */
export default function Privatlivspolitik() {
  return (
    <main className="side">
      <div className="rude">
        <h2>Privatlivspolitik for DF-Elpriser</h2>
        <p>Senest opdateret 24. oktober 2026.</p>
        <p>
          DF-Elpriser er en gratis tjeneste fra Dansk Folkeparti. Du får hver dag kl. 16 en e-mail med morgendagens
          elpriser i dit elprisområde og en prognose for de to følgende dage. Her kan du læse, hvilke oplysninger vi
          behandler om dig, og hvilke rettigheder du har.
        </p>

        <h3>Dataansvarlig</h3>
        <p>
          Dansk Folkeparti Landsorganisationen
          <br />
          CVR 20857390
          <br />
          Søndergade 1, 7361 Ejstrupholm
          <br />
          E-mail <a href="mailto:df@df.dk">df@df.dk</a>
        </p>
        <p>
          Dansk Folkepartis generelle privatlivspolitik finder du på{" "}
          <a href="https://danskfolkeparti.dk/privatlivspolitik">danskfolkeparti.dk/privatlivspolitik</a>. Denne side gælder
          for DF-Elpriser.
        </p>

        <h3>Hvilke oplysninger vi behandler</h3>
        <ul>
          <li>Din e-mailadresse og dit postnummer. Postnummeret bruges til at finde dit elprisområde (Vestdanmark eller Østdanmark). Vi beder ikke om dit navn.</li>
          <li>Dokumentation for dit samtykke: hvilken tekst du satte kryds ved (ordlyd og versionsnummer), hvornår du tilmeldte dig, hvornår du bekræftede tilmeldingen via linket i bekræftelsesmailen, og om og hvornår du har stoppet den daglige e-mail.</li>
          <li>En log over, hvilke dage vi har sendt dig den daglige e-mail, og om afsendelsen lykkedes. Vi gemmer ikke indholdet.</li>
          <li>For at beskytte tjenesten mod misbrug registrerer vi i op til et døgn en krypteret værdi (HMAC) af din IP-adresse og din e-mailadresse ved hver tilmelding.</li>
        </ul>
        <p>Vi bruger ingen sporings- eller statistikcookies.</p>
        <p>
          Fordi tjenesten kommer fra et politisk parti, kan din tilmelding vise en politisk interesse eller overbevisning. Vi
          behandler derfor oplysningerne med det udtrykkelige samtykke, du giver ved tilmeldingen.
        </p>

        <h3>Formål</h3>
        <p>
          At sende dig en daglig e-mail med morgendagens elpriser og en prognose for de to følgende dage i dit elprisområde
          samt information om Dansk Folkepartis politik og politiske udspil.
        </p>
        <p>
          Har du tilmeldt dig, før samtykketeksten blev ændret den 24. oktober 2026 (samtykke version 1), gælder dit samtykke
          kun elpriserne, medmindre du også satte kryds i det daværende frivillige felt om politisk information. Vi bruger
          dine oplysninger inden for det samtykke, du har givet.
        </p>

        <h3>Retsgrundlag</h3>
        <p>
          Dit samtykke efter databeskyttelsesforordningens artikel 6, stk. 1, litra a, og, i det omfang oplysningerne kan
          vise en politisk overbevisning, dit udtrykkelige samtykke efter artikel 9, stk. 2, litra a. Samtykket lyder:
        </p>
        <blockquote>{ELPRIS_SAMTYKKE.tekst}</blockquote>

        <h3>Automatisk behandling</h3>
        <p>
          Vi bruger dit postnummer automatisk til at vælge priserne for dit elprisområde. Vi anvender ikke oplysningerne til
          profilering af dine politiske holdninger eller til målretning af anden politisk reklame.
        </p>

        <h3>Sådan stopper du, eller trækker dit samtykke tilbage</h3>
        <p>Nederst i den daglige e-mail har du to muligheder:</p>
        <ul>
          <li>
            <strong>Stop den daglige e-mail:</strong> Klik på »STOP modtagelse af dette nyhedsbrev«. Så får du ikke længere
            den daglige e-mail med elpriser, men Dansk Folkeparti kan fortsat sende dig information om politik og politiske
            udspil, som er omfattet af dit samtykke, indtil du beder os om at slette dine oplysninger. Vi sletter ikke dine
            oplysninger og trækker ikke dit samtykke tilbage: Din e-mailadresse, dit postnummer og dokumentationen for dit
            samtykke bliver gemt, indtil du beder os om at slette dem. Vi registrerer, at og hvornår du har stoppet
            e-mailen. Det samme sker, hvis du bruger afmeldingsknappen i dit e-mailprogram.
          </li>
          <li>
            <strong>Slet alle mine oplysninger:</strong> Klik på linket »gøre det her« nederst i e-mailen og bekræft på den
            side, du kommer til. Så trækker du dit samtykke tilbage, og vi sletter straks alle dine oplysninger som
            beskrevet nedenfor. Du kan også skrive til <a href="mailto:df@df.dk">df@df.dk</a>.
          </li>
        </ul>
        <p>
          Har du stoppet e-mailen og vil have den igen, kan du tilmelde dig på ny på <Link href="/">dfpriser.dk/el</Link>. Du skal så bekræfte via en
          mail, vi sender til dig.
        </p>
        <p>
          Tilbagetrækningen gælder fremadrettet. Den påvirker ikke lovligheden af den behandling, der skete, før du trak
          samtykket tilbage.
        </p>

        <h3>Hvor længe vi opbevarer oplysningerne</h3>
        <ul>
          <li>Bekræfter du ikke din tilmelding inden for 72 timer, sletter vi oplysningerne automatisk (senest en time efter fristen).</li>
          <li>Så længe du er tilmeldt, opbevarer vi de oplysninger, der er nødvendige for at levere tjenesten.</li>
          <li>Stopper du den daglige e-mail, opbevarer vi dine oplysninger, indtil du beder os om at slette dem. Vi sender dig ikke den daglige e-mail, mens den er stoppet.</li>
          <li>Beder du om at blive slettet, sletter vi straks din e-mailadresse, dit postnummer, dokumentationen for dit samtykke og loggen over sendte e-mails. E-mails, der allerede er sendt, findes hos vores e-mailleverandør, indtil de slettes automatisk efter 30 dage.</li>
          <li>Vi bevarer kun anonyme optællinger, fx hvor mange e-mails der blev sendt en given dag. De kan ikke føres tilbage til dig.</li>
          <li>Selve ordlyden af vores samtykketekster bevares som dokumentation for, hvilke tekster tjenesten har brugt. Den indeholder ingen oplysninger om dig.</li>
        </ul>

        <h3>Databehandlere og overførsel til lande uden for EU</h3>
        <p>
          Vi bruger følgende leverandører (databehandlere), som kun må behandle oplysningerne efter vores instruks og på
          grundlag af en databehandleraftale:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> (database). Databasen ligger i Frankfurt, Tyskland. Supabase og deres underleverandører
            kan i forbindelse med drift, logning og support behandle oplysninger uden for EU, herunder i USA. Det sker på
            grundlag af EU-Kommissionens standardkontraktbestemmelser.
          </li>
          <li>
            <strong>Resend</strong> (afsendelse af e-mail). E-mails sendes fra Irland, men Resend opbevarer e-mailens indhold,
            leveringslogs og kontooplysninger i USA i 30 dage. Det sker på grundlag af EU-U.S. Data Privacy Framework og
            EU-Kommissionens standardkontraktbestemmelser.
          </li>
          <li>
            <strong>Vercel</strong> (drift af hjemmesiden, tilmeldingen og de planlagte udsendelser). Tjenesten kører i
            Frankfurt, Tyskland. Vercel er en amerikansk virksomhed og kan behandle oplysninger, fx logs, i USA. Det sker på
            grundlag af EU-U.S. Data Privacy Framework og EU-Kommissionens standardkontraktbestemmelser.
          </li>
        </ul>
        <p>Vi videregiver ikke dine oplysninger til andre og overfører ikke abonnenter fra andre af partiets tjenester.</p>

        <h3>Dine rettigheder</h3>
        <p>Du har ret til at:</p>
        <ul>
          <li>få indsigt i de oplysninger, vi behandler om dig,</li>
          <li>få urigtige oplysninger rettet,</li>
          <li>få dine oplysninger slettet,</li>
          <li>få behandlingen begrænset,</li>
          <li>få udleveret dine oplysninger i et almindeligt maskinlæsbart format (dataportabilitet) og</li>
          <li>trække dit samtykke tilbage når som helst, som beskrevet ovenfor.</li>
        </ul>
        <p>
          Skriv til <a href="mailto:df@df.dk">df@df.dk</a>, hvis du vil bruge dine rettigheder. Du kan klage til Datatilsynet
          over vores behandling af dine oplysninger. Se <a href="https://www.datatilsynet.dk">datatilsynet.dk</a>.
        </p>
      </div>
    </main>
  );
}
