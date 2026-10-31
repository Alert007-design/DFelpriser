import type { Metadata } from "next";
import { sti } from "@/lib/sti";

export const metadata: Metadata = { robots: { index: false } };

export default async function SkiftPostnummer({ searchParams }: { searchParams: Promise<{ token?: string; resultat?: string }> }) {
  const { token, resultat } = await searchParams;
  if (resultat === "ok") {
    return (
      <main className="side">
        <div className="rude">
          <h2>Dit postnummer er ændret</h2>
          <p>Fra næste udsendelse får du priserne for dit nye elprisområde.</p>
        </div>
      </main>
    );
  }
  if (!token || resultat === "ugyldig") {
    return (
      <main className="side">
        <div className="rude">
          <h2>Linket virker ikke</h2>
          <p>Brug linket i en af de mails, du har fået. Kun aktive tilmeldinger kan skifte postnummer.</p>
        </div>
      </main>
    );
  }
  return (
    <main className="side">
      <div className="rude">
        <h2>Skift postnummer</h2>
        <form method="post" action={sti("/api/skift-postnummer")}>
          <input type="hidden" name="token" value={token} />
          <div className="felt" style={{ maxWidth: 200 }}>
            <label htmlFor="postnummer">Nyt postnummer</label>
            <input id="postnummer" name="postnummer" required inputMode="numeric" pattern="\d{4}" maxLength={4} />
            {resultat === "ukendt_postnummer" && <p className="feltfejl">Vi kender ikke det postnummer.</p>}
          </div>
          <button className="knap" type="submit">Gem postnummer</button>
        </form>
      </div>
    </main>
  );
}
