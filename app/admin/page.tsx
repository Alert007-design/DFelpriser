import type { Metadata } from "next";
import { cookies } from "next/headers";
import { hentDb } from "@/lib/db";
import { ADMIN_COOKIE, adminOversigt, erAdminCookie } from "@/lib/admin";
import { oere } from "@/lib/pris/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administration – DF-Elpriser", robots: { index: false, follow: false } };

const dato = (iso: string) =>
  new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));

export default async function Admin({ searchParams }: { searchParams: Promise<{ fejl?: string }> }) {
  const { fejl } = await searchParams;
  if (!erAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="side">
        <div className="rude">
          <h2>Administration</h2>
          <form method="post" action="/api/admin/login">
            <div className="felt" style={{ maxWidth: 300 }}>
              <label htmlFor="kode">Adgangskode</label>
              <input id="kode" name="kode" type="password" required autoComplete="current-password" />
              {fejl && <p className="feltfejl">Forkert adgangskode.</p>}
            </div>
            <button className="knap" type="submit">Log ind</button>
          </form>
        </div>
      </main>
    );
  }
  const o = await adminOversigt(hentDb(), new Date());
  const a = o.abonnenter;
  return (
    <main>
      <div className="rude">
        <form method="post" action="/api/admin/logout" style={{ float: "right" }}>
          <button className="knap sekundaer" style={{ marginTop: 0 }} type="submit">Log ud</button>
        </form>
        <h2>Abonnenter</h2>
        <div className="talraekke">
          <div className="kort"><div className="lille">Aktive</div><div className="stor">{a.aktive}</div></div>
          <div className="kort"><div className="lille">DK1 / DK2</div><div className="stor">{a.pr_omraade.DK1} / {a.pr_omraade.DK2}</div></div>
          <div className="kort"><div className="lille">Med politisk samtykke</div><div className="stor">{a.med_politisk_samtykke}</div></div>
          <div className="kort"><div className="lille">Afventer bekræftelse</div><div className="stor">{a.afventer}</div></div>
          <div className="kort"><div className="lille">Afmeldte (gemt som dokumentation)</div><div className="stor">{a.afmeldte}</div></div>
          <div className="kort"><div className="lille">Testmodtagere</div><div className="stor">{a.test}</div></div>
        </div>
      </div>

      <div className="rude">
        <h2>Indstillinger (kun status, aldrig hemmeligheder)</h2>
        <p>
          Juridisk godkendt (JURA_GODKENDT): <strong>{o.indstillinger.juraGodkendt ? "ja" : "nej"}</strong> · Priskilde: <strong>{o.indstillinger.priskilde}</strong> · Offentlig: <strong>{o.indstillinger.offentlig ? "ja" : "nej"}</strong> · Fejlmail (ADMIN_EMAIL) sat: <strong>{o.indstillinger.adminMailSat ? "ja" : "nej"}</strong> · DF-budskab udfyldt: <strong>{o.indstillinger.budskabSat ? "ja" : "nej"}</strong>
        </p>
      </div>

      <div className="rude">
        <h2>Morgendagens priser og prognose</h2>
        <table className="data">
          <thead><tr><th>Område</th><th>Dato</th><th>Priser fuldstændige</th><th>Døgn i lager (130 dage)</th><th>Prognose må vises</th></tr></thead>
          <tbody>
            {o.priser.map((p, i) => (
              <tr key={p.omraade}>
                <td>{p.omraade}</td><td>{p.dato}</td>
                <td className={p.fuld ? "" : "fejl-raekke"}>{p.fuld ? "ja" : `nej: ${p.aarsag}`}</td>
                <td>{p.dage_i_lager}</td>
                <td>{o.prognoseStatus[i].tilladt ? "ja" : `nej: ${o.prognoseStatus[i].begrundelse}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rude">
        <h2>Udsendelser</h2>
        <table className="data">
          <thead><tr><th>Dato</th><th>Område</th><th>Status</th><th>Sendt</th><th>Fejlet</th><th>Prognose</th><th>Note</th></tr></thead>
          <tbody>
            {o.udsendelser.map((u) => (
              <tr key={u.dato + u.omraade} className={u.fejlet > 0 || u.status === "droppet" ? "fejl-raekke" : ""}>
                <td>{u.dato}</td><td>{u.omraade}</td><td>{u.status}</td><td>{u.sendt}</td><td>{u.fejlet}</td><td>{u.prognose ? "ja" : "nej"}</td><td>{u.note}</td>
              </tr>
            ))}
            {o.udsendelser.length === 0 && <tr><td colSpan={7}>Ingen udsendelser endnu.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="rude">
        <h2>Prognoser mod faktiske priser</h2>
        <table className="data">
          <thead><tr><th>Område</th><th>Dato</th><th>Forudsagt gns.</th><th>Faktisk gns.</th><th>Fejl (øre/kWh)</th></tr></thead>
          <tbody>
            {o.opfoelgning.map((f) => (
              <tr key={f.omraade + f.for_dato}><td>{f.omraade}</td><td>{f.for_dato}</td><td>{oere(f.forudsagt_gennemsnit)}</td><td>{oere(f.faktisk_gennemsnit)}</td><td>{oere(f.fejl)}</td></tr>
            ))}
            {o.opfoelgning.length === 0 && <tr><td colSpan={5}>Ingen afsluttede prognoser endnu.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="rude">
        <h2>Hentninger fra datakilder</h2>
        <table className="data">
          <thead><tr><th>Tidspunkt</th><th>Kilde</th><th>Område</th><th>Status</th><th>Antal</th><th>Besked</th></tr></thead>
          <tbody>
            {o.hentelog.map((h, i) => (
              <tr key={i} className={h.status === "ok" ? "" : "fejl-raekke"}><td>{dato(h.tidspunkt)}</td><td>{h.kilde}</td><td>{h.omraade}</td><td>{h.status}</td><td>{h.antal}</td><td>{h.besked}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rude">
        <h2>Driftslog</h2>
        <table className="data">
          <thead><tr><th>Tidspunkt</th><th>Niveau</th><th>Kilde</th><th>Besked</th></tr></thead>
          <tbody>
            {o.driftslog.map((l, i) => (
              <tr key={i} className={l.niveau === "fejl" ? "fejl-raekke" : ""}><td>{dato(l.tidspunkt)}</td><td>{l.niveau}</td><td>{l.kilde}</td><td>{l.besked}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
