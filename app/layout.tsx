import type { Metadata } from "next";
import type { ReactNode } from "react";
import { erOffentlig } from "@/lib/config";
import "./globals.css";
import { sti } from "@/lib/sti";
import { kanonisk } from "@/lib/seo";
import { Analytics } from "@vercel/analytics/next";

const BESKRIVELSE =
  "Få hver dag at vide, hvornår strømmen er billigst i morgen. En gratis service fra Dansk Folkeparti.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL?.trim() || "http://localhost:3000"),
  title: "DF-Elpriser – hvornår er strømmen billigst?",
  description: BESKRIVELSE,
  // Hjemmesiden må ikke indekseres, før ejeren har godkendt lanceringen (OFFENTLIG=ja).
  robots: erOffentlig() ? undefined : { index: false, follow: false },
  // Kanonisk adresse sættes på hver side for sig. Står den her, arver alle sider forsidens adresse.
  openGraph: {
    type: "website",
    locale: "da_DK",
    siteName: "DF-Elpriser",
    title: "DF-Elpriser",
    description: BESKRIVELSE,
    url: kanonisk("/"),
    images: [{ url: kanonisk("/mail/df-logo.png"), width: 240, height: 240, alt: "Dansk Folkeparti" }],
  },
  twitter: { card: "summary", title: "DF-Elpriser", description: BESKRIVELSE, images: [kanonisk("/mail/df-logo.png")] },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <body>
        <header className="top">
          <div className="top-indhold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src={sti("/mail/df-logo.png")} width={64} height={64} alt="Dansk Folkeparti" />
            <div>
              <h1>DF-Elpriser</h1>
              <p>En gratis service fra Dansk Folkeparti</p>
            </div>
          </div>
        </header>
        {children}
        <footer className="bund">
          <p>
            Afsender og dataansvarlig: Dansk Folkeparti. <a href={sti("/privatlivspolitik")}>Privatlivspolitik</a> ·{" "}
            <a href={sti("/om-priserne")}>Om priserne</a> · <a href="mailto:df@df.dk">df@df.dk</a>
          </p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
