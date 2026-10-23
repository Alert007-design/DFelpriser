import type { Metadata } from "next";
import Link from "next/link";
import { laesAfmeldToken, sletToken } from "@/lib/tokens";

export const metadata: Metadata = { robots: { index: false } };

export default async function Afmeld({ searchParams }: { searchParams: Promise<{ token?: string; resultat?: string }> }) {
  const { token, resultat } = await searchParams;
  if (resultat === "ok") {
    return (
      <main className="side">
        <div className="rude">
          <h2>Du er afmeldt</h2>
          <p>Du får ikke flere mails fra DF-Elpriser. Dit samtykke er trukket tilbage. Vi gemmer en kort registrering af tilmelding, samtykke og afmelding, så vi kan dokumentere, hvad der er sket. Den slettes efter den frist, der står i <Link href="/privatlivspolitik">privatlivspolitikken</Link>. Vil du have alt slettet med det samme, så skriv til <a href="mailto:df@df.dk">df@df.dk</a>, eller brug linket i en tidligere mail.</p>
        </div>
      </main>
    );
  }
  if (resultat === "slettet") {
    return (
      <main className="side">
        <div className="rude">
          <h2>Dine oplysninger er slettet</h2>
          <p>Vi har slettet din tilmelding og dine samtykker.</p>
        </div>
      </main>
    );
  }
  const id = token ? laesAfmeldToken(token) : null;
  if (resultat === "ugyldig" || !token || !id) {
    return (
      <main className="side">
        <div className="rude">
          <h2>Linket virker ikke</h2>
          <p>Brug linket i en af de mails, du har fået.</p>
        </div>
      </main>
    );
  }
  return (
    <main className="side">
      <div className="rude">
        <h2>Afmeld DF-Elpriser</h2>
        <p>Når du afmelder, får du ikke flere mails, og dit samtykke er trukket tilbage.</p>
        <form method="post" action="/api/afmeld">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="fra_side" value="1" />
          <button className="knap" type="submit">Afmeld nyhedsbrevet</button>
        </form>
      </div>
      <div className="rude">
        <h2>Slet alle mine oplysninger</h2>
        <p>Vil du i stedet have alle oplysninger om dig slettet nu, inklusive registreringen af dit samtykke, kan du gøre det her.</p>
        <form method="post" action="/api/slet">
          <input type="hidden" name="token" value={sletToken(id)} />
          <button className="knap fare" type="submit">Slet mine oplysninger</button>
        </form>
      </div>
    </main>
  );
}
