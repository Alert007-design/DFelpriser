"use client";

import { useState, useSyncExternalStore } from "react";

const ingenAendringer = () => () => {};

/**
 * Knapperne på /del. "Del" åbner telefonens egen delingsmenu og vises kun, hvor browseren har en.
 * Facebook, Mail og "Kopiér besked" vises altid.
 */
export function DelKnapper(p: { tekst: string; link: string; besked: string; facebookUrl: string; mailUrl: string }) {
  // Delingsmenuen findes kun i browseren (typisk på telefoner). Ved serverrendering vises knappen ikke.
  const kanDele = useSyncExternalStore(
    ingenAendringer,
    () => typeof navigator.share === "function",
    () => false,
  );
  const [kopieret, setKopieret] = useState(false);


  async function del() {
    try {
      await navigator.share({ text: p.tekst, url: p.link });
    } catch {
      // Brugeren lukkede menuen. Intet at gøre.
    }
  }

  async function kopier() {
    try {
      await navigator.clipboard.writeText(p.besked);
      setKopieret(true);
    } catch {
      setKopieret(false);
    }
  }

  return (
    <div className="delknapper">
      {kanDele && (
        <button type="button" className="knap" onClick={del}>
          Del med venner
        </button>
      )}
      <p className="delknapper-tekst">{kanDele ? "Eller send den sådan her:" : "Send den sådan her:"}</p>
      <div className="delknapper-raekke">
        <a className="delknap" href={p.facebookUrl} target="_blank" rel="noopener">
          <Ikon d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9c0-.6.4-1 1-1z" />
          Facebook
        </a>
        <a className="delknap" href={p.mailUrl}>
          <Ikon d="M3 5h18v14H3V5zm2 2v.4l7 4.6 7-4.6V7H5zm14 2.8-7 4.6-7-4.6V17h14V9.8z" />
          Mail
        </a>
        <button type="button" className="delknap" onClick={kopier} aria-live="polite">
          <Ikon d="M8 3h11v13h-2V5H8V3zM5 7h11v14H5V7zm2 2v10h7V9H7z" />
          {kopieret ? "Kopieret" : "Kopiér besked"}
        </button>
      </div>
    </div>
  );
}

function Ikon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={d} fill="currentColor" />
    </svg>
  );
}
