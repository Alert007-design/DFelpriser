import type { Metadata } from "next";
import { laesSletToken } from "@/lib/tokens";
import { sti } from "@/lib/sti";

// Siden hører ikke hjemme i søgeresultater (indeholder personlige links).
export const metadata: Metadata = { robots: { index: false } };

/**
 * Fuld sletning på personens egen anmodning. Kræver et ekstra, udtrykkeligt klik, og siden forklarer
 * forskellen på at stoppe den daglige mail og at blive slettet.
 */
export default async function Slet({ searchParams }: { searchParams: Promise<{ token?: string; resultat?: string }> }) {
  const { token, resultat } = await searchParams;
  if (resultat === "slettet") {
    return (
      <main className="side">
        <div className="rude">
          <h2>Dine oplysninger er slettet</h2>
          <p>Vi har slettet din tilmelding, dit samtykke og registreringen af, hvilke dage vi har sendt dig en mail. Du hører ikke mere fra DF-Elpriser.</p>
        </div>
      </main>
    );
  }
  const id = token ? laesSletToken(token) : null;
  if (resultat === "ugyldig" || !token || !id) {
    return (
      <main className="side">
        <div className="rude">
          <h2>Linket virker ikke</h2>
          <p>Brug linket nederst i en af de mails, du har fået, eller skriv til <a href="mailto:df@df.dk">df@df.dk</a>.</p>
        </div>
      </main>
    );
  }
  return (
    <main className="side">
      <div className="rude">
        <h2>Slet alle mine oplysninger</h2>
        <p>Her sletter du alt, hvad DF-Elpriser har om dig: din e-mailadresse, dit postnummer, dit samtykke og registreringen af sendte mails. Dit samtykke er dermed trukket tilbage, og Dansk Folkeparti sender dig ikke mere fra denne tjeneste.</p>
        <p>Vil du kun slippe for den daglige mail, men stadig modtage relevant politisk information, skal du i stedet bruge knappen »STOP modtagelse af dette nyhedsbrev« i mailen.</p>
        <form method="post" action={sti("/api/slet")}>
          <input type="hidden" name="token" value={token} />
          <button className="knap fare" type="submit">Ja, slet alle mine oplysninger</button>
        </form>
      </div>
    </main>
  );
}
