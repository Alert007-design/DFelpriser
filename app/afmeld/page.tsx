import type { Metadata } from "next";
import Link from "next/link";
import { laesAfmeldToken, sletToken } from "@/lib/tokens";
import { sti } from "@/lib/sti";

// Siden hører ikke hjemme i søgeresultater (indeholder personlige links).
export const metadata: Metadata = { robots: { index: false } };

export default async function Afmeld({ searchParams }: { searchParams: Promise<{ token?: string; resultat?: string }> }) {
  const { token, resultat } = await searchParams;
  const id = token ? laesAfmeldToken(token) : null;

  if (resultat === "ok") {
    return (
      <main className="side">
        <div className="rude">
          <h2>Du får ikke længere den daglige mail</h2>
          <p>Vi har stoppet den daglige mail med elpriser. Dine oplysninger og dit samtykke er stadig gemt, så Dansk Folkeparti kan sende dig relevant politisk information.</p>
          <p>
            Vil du have alle dine oplysninger slettet, kan du {id ? <Link href={`/slet?token=${encodeURIComponent(sletToken(id))}`}>gøre det her</Link> : "bruge linket nederst i en af de mails, du har fået"}, eller skrive til <a href="mailto:df@df.dk">df@df.dk</a>.
          </p>
          <p>
            Vil du have den daglige mail igen, kan du <Link href="/">tilmelde dig på ny</Link> og bekræfte via den mail, vi sender dig.
          </p>
        </div>
      </main>
    );
  }
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
        <h2>Stop den daglige mail fra DF-Elpriser</h2>
        <p>Når du stopper, får du ikke flere daglige mails med elpriser. Dine oplysninger og dit samtykke bliver gemt, så Dansk Folkeparti fortsat kan sende dig relevant politisk information.</p>
        <form method="post" action={sti("/api/afmeld")}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="fra_side" value="1" />
          <button className="knap" type="submit">Stop den daglige mail</button>
        </form>
        <p className="forklaring">
          Vil du i stedet have alle dine oplysninger slettet? Det kan du <Link href={`/slet?token=${encodeURIComponent(sletToken(id))}`}>gøre her</Link>.
        </p>
      </div>
    </main>
  );
}
