import type { Metadata } from "next";
import Link from "next/link";
import { sti } from "@/lib/sti";

export const metadata: Metadata = { robots: { index: false } };

export default async function Bekraeft({ searchParams }: { searchParams: Promise<{ token?: string; resultat?: string }> }) {
  const { token, resultat } = await searchParams;
  if (resultat === "ok") {
    return (
      <main className="side">
        <div className="rude">
          <h2>Du er tilmeldt</h2>
          <p>Fra i dag eller i morgen kl. 16 får du morgendagens elpriser og en prognose, når den er pålidelig nok.</p>
        </div>
      </main>
    );
  }
  if (resultat === "ugyldig" || !token) {
    return (
      <main className="side">
        <div className="rude">
          <h2>Linket virker ikke</h2>
          <p>
            Linket er udløbet eller allerede brugt. Du kan <Link href="/">tilmelde dig igen</Link>.
          </p>
        </div>
      </main>
    );
  }
  return (
    <main className="side">
      <div className="rude">
        <h2>Bekræft din tilmelding</h2>
        <form method="post" action={sti("/api/bekraeft")}>
          <input type="hidden" name="token" value={token} />
          <button className="knap" type="submit">Ja, bekræft min tilmelding</button>
        </form>
      </div>
    </main>
  );
}
