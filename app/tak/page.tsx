import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

export default function Tak() {
  return (
    <main className="side">
      <div className="rude">
        <h2>Tak for din tilmelding</h2>
        <p>Vi har sendt dig en e-mail. Klik på linket i mailen for at bekræfte, ellers får du ikke nyhedsbrevet.</p>
      </div>
    </main>
  );
}
