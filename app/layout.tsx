import type { Metadata } from "next";
import type { ReactNode } from "react";
import { erOffentlig } from "@/lib/config";
import "./globals.css";

const BESKRIVELSE =
  "Se hver dag, hvornår strømmen er billigst i morgen, og få en prognose for de to følgende dage. En gratis service fra Dansk Folkeparti.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL?.trim() || "http://localhost:3000"),
  title: "DF-Elpriser – hvornår er strømmen billigst?",
  description: BESKRIVELSE,
  // Hjemmesiden må ikke indekseres, før ejeren har godkendt lanceringen (OFFENTLIG=ja).
  robots: erOffentlig() ? undefined : { index: false, follow: false },
  openGraph: { type: "website", locale: "da_DK", siteName: "DF-Elpriser", title: "DF-Elpriser", description: BESKRIVELSE },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <body>
        <header className="top">
          <div className="top-indhold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/mail/logo-lys.png" width={64} height={64} alt="Dansk Folkeparti" />
            <div>
              <h1>DF-Elpriser</h1>
              <p>En gratis service fra Dansk Folkeparti</p>
            </div>
          </div>
        </header>
        {children}
        <footer className="bund">
          <p>
            Afsender og dataansvarlig: Dansk Folkeparti. <a href="/privatlivspolitik">Privatlivspolitik</a> ·{" "}
            <a href="/om-priserne">Om priserne og prognosen</a> · <a href="mailto:df@df.dk">df@df.dk</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
