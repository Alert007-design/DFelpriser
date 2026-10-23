"use client";

import { useState, type FormEvent } from "react";
import { omraadeForPostnummer, omraadeNavn } from "@/lib/omraade";
import { delOmkringLink, PRIVATLIVSPOLITIK_STI, type Samtykketekst } from "@/lib/samtykke";

type Felt = "email" | "postnummer" | "samtykke" | "politik_samtykke";
export type VistSamtykke = Samtykketekst & { hash: string };

function Feltfejl({ id, tekst }: { id: string; tekst?: string }) {
  return tekst ? (
    <p className="feltfejl" id={id}>
      {tekst}
    </p>
  ) : null;
}

export function Tilmeldingsformular({
  samtykker,
  aaben,
}: {
  samtykker: { elpris: VistSamtykke; politik: VistSamtykke };
  aaben: boolean;
}) {
  const [sender, setSender] = useState(false);
  const [postnummer, setPostnummer] = useState("");
  const [fejl, setFejl] = useState<Partial<Record<Felt, string>>>({});
  const [besked, setBesked] = useState<{ tekst: string; ok: boolean } | null>(null);
  const omraade = omraadeForPostnummer(postnummer);
  const elpris = delOmkringLink(samtykker.elpris.tekst);

  async function indsend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSender(true);
    setFejl({});
    setBesked(null);
    try {
      const politik = data.get("politik_samtykke") === "ja";
      const svar = await fetch("/api/tilmeld", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          postnummer: data.get("postnummer"),
          samtykke: data.get("samtykke") === "ja",
          samtykke_version: samtykker.elpris.version,
          samtykke_hash: samtykker.elpris.hash,
          politik_samtykke: politik,
          ...(politik ? { politik_samtykke_version: samtykker.politik.version, politik_samtykke_hash: samtykker.politik.hash } : {}),
          hjemmeside: data.get("hjemmeside"),
        }),
      });
      const body = (await svar.json().catch(() => ({}))) as { status?: string; besked?: string; fejl?: Partial<Record<Felt, string>> };
      if (svar.ok) {
        setBesked({ tekst: body.besked ?? "Tak! Tjek din indbakke og bekræft din tilmelding.", ok: true });
        return;
      }
      if (body.status === "ukendt_postnummer") setFejl({ postnummer: body.besked });
      else if (body.fejl) setFejl(body.fejl);
      setBesked({ tekst: body.besked ?? "Noget gik galt. Prøv igen senere.", ok: false });
    } catch {
      setBesked({ tekst: "Noget gik galt. Prøv igen senere.", ok: false });
    } finally {
      setSender(false);
    }
  }

  if (besked?.ok) {
    return (
      <section className="rude" aria-live="polite">
        <h2>Tak for din tilmelding</h2>
        <p className="besked">{besked.tekst}</p>
      </section>
    );
  }

  return (
    <section className="rude" aria-labelledby="tilmeld-overskrift">
      <h2 id="tilmeld-overskrift">Få strømpriserne i din indbakke hver dag kl. 16</h2>
      {!aaben && (
        <p className="udkast">
          <strong>Tilmeldingen er ikke åbnet endnu.</strong> Formularen kan ses, men der tages ikke imod tilmeldinger.
        </p>
      )}
      <form method="post" action="/api/tilmeld" onSubmit={indsend}>
        <input type="hidden" name="samtykke_version" value={samtykker.elpris.version} />
        <input type="hidden" name="samtykke_hash" value={samtykker.elpris.hash} />
        <div className="felter">
          <div className="felt">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required autoComplete="email" maxLength={254} aria-invalid={fejl.email ? true : undefined} />
            <Feltfejl id="email-fejl" tekst={fejl.email} />
          </div>
          <div className="felt">
            <label htmlFor="postnummer">Postnummer</label>
            <input
              id="postnummer"
              name="postnummer"
              type="text"
              required
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoComplete="postal-code"
              value={postnummer}
              onChange={(e) => setPostnummer(e.target.value)}
              aria-invalid={fejl.postnummer ? true : undefined}
            />
            <Feltfejl id="postnummer-fejl" tekst={fejl.postnummer} />
          </div>
        </div>
        {postnummer.length === 4 && (
          <p className="forklaring" aria-live="polite">
            {omraade ? `Dit elprisområde: ${omraade} – ${omraadeNavn(omraade)}.` : "Vi kender ikke det postnummer."}
          </p>
        )}

        <div className="skjult" aria-hidden="true">
          <label htmlFor="hjemmeside">Lad dette felt stå tomt</label>
          <input id="hjemmeside" name="hjemmeside" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {/* Ingen forhåndsafkrydsede felter. */}
        <div className="samtykke">
          <input id="samtykke" name="samtykke" type="checkbox" value="ja" required defaultChecked={false} />
          <label htmlFor="samtykke" data-samtykke-version={samtykker.elpris.version}>
            {elpris.foer}
            <a href={PRIVATLIVSPOLITIK_STI} target="_blank" rel="noopener">
              {elpris.link}
            </a>
            {elpris.efter}
          </label>
        </div>
        <Feltfejl id="samtykke-fejl" tekst={fejl.samtykke} />

        <div className="samtykke">
          <input id="politik_samtykke" name="politik_samtykke" type="checkbox" value="ja" defaultChecked={false} />
          <label htmlFor="politik_samtykke" data-samtykke-version={samtykker.politik.version}>
            <strong>Frivilligt: </strong>
            {samtykker.politik.tekst}
          </label>
        </div>
        <Feltfejl id="politik_samtykke-fejl" tekst={fejl.politik_samtykke} />

        <button className="knap" type="submit" disabled={sender || !aaben}>
          {sender ? "Sender …" : "Tilmeld mig"}
        </button>
        {besked && !besked.ok && (
          <p className="besked fejl" role="alert">
            {besked.tekst}
          </p>
        )}
      </form>
    </section>
  );
}
