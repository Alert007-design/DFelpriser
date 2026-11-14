import type { Metadata } from "next";
import { appUrl } from "@/lib/config";
import { DEL_BESKED_TEKST, DEL_EMNE, delBesked, delLink } from "@/lib/deling";
import { DelKnapper } from "./del-knapper";

export const metadata: Metadata = { title: "Send Dagens elpriser videre", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function DelSide() {
  const base = appUrl();
  const link = delLink(base);
  const besked = delBesked(base);
  return (
    <main className="side">
      <div className="rude">
        <h2>Send Dagens elpriser videre</h2>
        <p>
          Kender du nogen, der også gerne vil vide, hvornår strømmen er billigst? Send dem et link, så de selv kan
          tilmelde sig.
        </p>
      </div>
      <div className="rude">
        <h2>Beskeden, de får</h2>
        <blockquote className="delbesked">{besked}</blockquote>
        <DelKnapper
          tekst={DEL_BESKED_TEKST}
          link={link}
          besked={besked}
          facebookUrl={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}
          mailUrl={`mailto:?subject=${encodeURIComponent(DEL_EMNE)}&body=${encodeURIComponent(besked)}`}
        />
      </div>
    </main>
  );
}
