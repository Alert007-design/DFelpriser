import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

export default async function PolitikFra({ searchParams }: { searchParams: Promise<{ token?: string; resultat?: string }> }) {
  const { token, resultat } = await searchParams;
  if (resultat === "ok") {
    return (
      <main className="side">
        <div className="rude">
          <h2>Politisk information er stoppet</h2>
          <p>Du får ikke længere politisk information fra Dansk Folkeparti i mailen. Du får stadig elpriserne.</p>
        </div>
      </main>
    );
  }
  if (resultat === "ugyldig" || !token) {
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
        <h2>Stop politisk information</h2>
        <p>Du fortsætter med at få elpriserne, men uden politisk information.</p>
        <form method="post" action="/api/politik-fra">
          <input type="hidden" name="token" value={token} />
          <button className="knap" type="submit">Stop politisk information</button>
        </form>
      </div>
    </main>
  );
}
