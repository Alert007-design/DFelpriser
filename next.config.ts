import type { NextConfig } from "next";
import { BASE_STI } from "./lib/sti";

/**
 * Hvis VIDERESTIL_TIL er sat (fx "https://dfpriser.dk"), sendes besøgende på de gamle domæner
 * (dfelpriser.dk og www.dfelpriser.dk) videre til samme side under dfpriser.dk/el. API-kald videresendes
 * ikke, så afmelding med ét klik fra mailprogrammer (POST) virker på den gamle adresse.
 */
const videre = (process.env.VIDERESTIL_TIL ?? "").trim().replace(/\/$/, "");
const gamleDomaener = ["dfelpriser.dk", "www.dfelpriser.dk"];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  basePath: BASE_STI,
  async redirects() {
    if (!videre) return [];
    return gamleDomaener.flatMap((host) => [
      {
        source: `${BASE_STI}/:path((?!api/).*)`,
        basePath: false as const,
        has: [{ type: "host" as const, value: host }],
        destination: `${videre}${BASE_STI}/:path`,
        permanent: false,
      },
      {
        source: "/:path((?!el/|el$|api/|_next/).*)",
        basePath: false as const,
        has: [{ type: "host" as const, value: host }],
        destination: `${videre}${BASE_STI}/:path`,
        permanent: false,
      },
    ]);
  },
  // Gamle adresser uden /el (links i mails, der allerede er sendt) omskrives i vercel.json.
  // Tjenesten må ikke indlejres på andre sider.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
