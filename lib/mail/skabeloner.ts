import { periodeTekst } from "../pris/format";
import { tidsrumTekst, type TypiskeTider } from "../pris/reference";
import type { Dagsopsummering, Omraade } from "../pris/typer";
import { omraadeNavn } from "../omraade";
import type { DagsPrognose, Vurdering } from "../prognose/prognose";
import { laegDage, laesbarDato, stortFoerst, ugedag } from "../tid";
import type { Mail } from "./afsender";
import { grafHtml, type Soejle } from "./graf";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const BLAA = "#1a2f57";
const ROED = "#eb4d5c";
const LYSEBLAA = "#D9EFFF";
const MOERKEBLAA = "#0f3459";
const FELT = "#f4f6fa";
const GROEN = "#1f8a4c";
const GUL = "#b36b00";
const FONT = "font-family:Arial,Helvetica,sans-serif";

export const AFSENDER_NAVN = "Dansk Folkeparti";
export const KONTAKT_EMAIL = "df@df.dk";
export const KILDE_TEKST = "Energinet, Energi Data Service (officielle day-ahead-priser for elmarkedet)";

/** Hvad de viste priser ikke indeholder. Står i hver mail, så ingen tager spotprisen for den samlede elpris. */
export const IKKE_MEDREGNET =
  "Priserne er spotpriser pr. kWh før moms. De omfatter ikke nettarif, elafgift, Energinets tariffer, moms, abonnement eller din elhandlers tillæg. Din egen samlede pris pr. kWh afhænger af din elaftale og dit netselskab, og vi kender dem ikke.";

export const PRAEMISSE_PROGNOSE =
  "Morgendagens priser er offentliggjorte og kendte. Priserne for de to følgende dage er en prognose og kan blive anderledes.";

export interface MailLinks {
  hjemmeside: string;
  logo: string;
  /** Bruges ikke længere i dagsmailen. */
  bolge?: string;
  privatliv: string;
  /** Stopper kun den daglige mail (siden /afmeld). Personen og samtykket bevares. */
  stop: string;
  /** Mailprogrammernes one-click-afmelding (RFC 8058). Gør det samme som stop. */
  stopEtKlik: string;
  skiftPostnummer: string;
  /** Fuld sletning af alle oplysninger på personens egen anmodning (siden /slet med bekræftelse). */
  slet: string;
}

export interface PrognoseDel {
  dage: DagsPrognose[];
  vurdering: Vurdering;
}

export interface MailIndhold {
  omraade: Omraade;
  postnummer: string;
  dag: Dagsopsummering;
  serie: Soejle[];
  prognose: PrognoseDel | null;
  /** Kendte dage før morgendagen (i går og i dag), til sammenligning. Ufuldstændige dage er udeladt. */
  seneste: Dagsopsummering[];
  /** Hvornår strømmen i gennemsnit har været billig og dyr de seneste 14 dage. Vises kun uden prognose. */
  typisk: TypiskeTider | null;
  /** Politisk tekst fra Dansk Folkeparti. Kun med, hvis modtagerens samtykke dækker politisk information. */
  dfBudskab?: string;
  links: MailLinks;
}

/** Hele øre uden decimaler: "165", "−3". Mailen viser runde tal, så den er nem at læse på en telefon. */
export function heleOere(v: number): string {
  return String(Math.round(v)).replace("-", "−");
}

/** "Lørdag" */
const dagNavn = (dato: string) => stortFoerst(ugedag(dato));
/** "Lørdag 24. oktober" */
const dagOgDato = (dato: string) => stortFoerst(laesbarDato(dato).replace(" den ", " "));

/** Den værste af to usikkerheder, så mailen aldrig lover mere end prognosen kan holde. */
function usikkerhedTekst(dage: DagsPrognose[]): string {
  const orden = ["lav", "middel", "hoej"] as const;
  const vaerst = dage.reduce((v, p) => (orden.indexOf(p.usikkerhed) > orden.indexOf(v) ? p.usikkerhed : v), "lav" as DagsPrognose["usikkerhed"]);
  return { lav: "lav", middel: "middel", hoej: "høj" }[vaerst];
}

function prognoseTidsrum(p: DagsPrognose): string {
  const slut = p.billigste.slutTime % 24 === 0 && p.billigste.slutTime > 0 ? 24 : p.billigste.slutTime;
  return `kl. ${p.billigste.startTime}–${slut}`;
}

/** Én linje, kun når prognosen sikkert peger på én dag som billigst. */
export function vurderingTekst(v: Vurdering, kendtDato: string): string | null {
  if (v.type !== "billigst") return null;
  return v.dato === kendtDato
    ? `Af de tre dage bliver ${ugedag(v.dato)} den billigste.`
    : `Af de tre dage ventes ${ugedag(v.dato)} at blive den billigste.`;
}

function typiskTekst(t: TypiskeTider, fed: (s: string) => string): string {
  const billig = t.billigste.map((b) => fed(tidsrumTekst(b))).join(" og ");
  return `De seneste ${t.dage} dage har strømmen i gennemsnit været billigst ${billig} og dyrest ${fed(tidsrumTekst(t.dyreste))}.`;
}

const INGEN_PROGNOSE = "Vi har ingen sikker prognose for de to dage i dag.";
const KORT_FORBEHOLD = "Kun spotprisen før moms. Nettarif, elafgift, moms, abonnement og elselskabets tillæg er ikke regnet med.";

const kort = (overskrift: string, linje1: string, linje2: string, farve: string) =>
  `<td width="50%" valign="top" style="padding:0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${FELT}" style="background-color:${FELT};border-top:4px solid ${farve};padding:10px 12px;${FONT}"><div style="font-size:11px;color:#5a6788;text-transform:uppercase;letter-spacing:1px">${overskrift}</div><div style="font-size:22px;line-height:28px;font-weight:bold;color:${BLAA};padding-top:2px">${linje1}</div><div style="font-size:14px;color:#33415f;padding-top:2px">${linje2}</div></td></tr></table></td>`;

const etiket = (tekst: string, farve: string) =>
  `<div style="${FONT};font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1px;color:${farve};text-transform:uppercase;padding:0 0 6px 0">${tekst}</div>`;

export function elprisMail(i: MailIndhold): Mail {
  const d = i.dag;
  const datoTekst = laesbarDato(d.dato);
  const omrKort = omraadeNavn(i.omraade).split(" (")[0];
  const dag2 = laegDage(d.dato, 1);
  const dag3 = laegDage(d.dato, 2);
  const weekendOverskrift = `${dagNavn(dag2)} og ${ugedag(dag3)}`;
  const raekker = [...i.seneste.filter((x) => x.dato < d.dato), d];

  const tabelHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${FONT};font-size:14px;line-height:20px;color:${BLAA}">
<tr><td style="font-size:12px;color:#5a6788"></td><td align="right" style="font-size:12px;color:#5a6788">Lavest</td><td align="right" style="font-size:12px;color:#5a6788">Højest</td><td align="right" style="font-size:12px;color:#5a6788;padding-right:6px">Gns.</td></tr>
${raekker
  .map((r) => {
    const morgen = r.dato === d.dato;
    const stil = morgen ? `font-weight:bold;background-color:#eef7f1` : "";
    return `<tr><td bgcolor="${morgen ? "#eef7f1" : "#ffffff"}" style="padding:5px 6px;${stil}">${esc(dagNavn(r.dato))}</td><td align="right" style="padding:5px 0;${stil}">${heleOere(r.laveste)}</td><td align="right" style="padding:5px 0;${stil}">${heleOere(r.hoeyeste)}</td><td align="right" style="padding:5px 6px;${stil}">${heleOere(r.gennemsnit)}</td></tr>`;
  })
  .join("\n")}
</table>
<div style="${FONT};font-size:12px;color:#6b7896;padding-top:4px">Øre pr. kWh, kun spotpris.</div>`;

  let weekendHtml: string;
  let weekendTekst: string;
  if (i.prognose) {
    const p = i.prognose;
    const vurdering = vurderingTekst(p.vurdering, d.dato);
    weekendHtml = `${etiket(`${esc(weekendOverskrift)} · prognose`, GUL)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${FONT};font-size:14px;line-height:20px;color:${BLAA}">
${p.dage.map((x) => `<tr><td style="padding:3px 0">${esc(dagNavn(x.dato))}</td><td style="padding:3px 0">billigst ca. <strong>${prognoseTidsrum(x)}</strong></td><td align="right" style="padding:3px 0">ca. ${heleOere(x.gennemsnit)} øre</td></tr>`).join("\n")}
</table>
${vurdering ? `<div style="padding-top:6px">${esc(vurdering)}</div>` : ""}
<div style="font-size:12px;line-height:17px;color:#6b7896;padding-top:6px">Et bud, ikke kendte priser. Beløbet er døgnets gennemsnit. Usikkerhed: ${usikkerhedTekst(p.dage)}.</div>`;
    weekendTekst = `${weekendOverskrift.toUpperCase()} - PROGNOSE (et bud, ikke kendte priser)
${p.dage.map((x) => `${dagOgDato(x.dato)}: billigst ca. ${prognoseTidsrum(x)}, gennemsnit ca. ${heleOere(x.gennemsnit)} øre`).join("\n")}
${vurdering ? `${vurdering}\n` : ""}Usikkerhed: ${usikkerhedTekst(p.dage)}.`;
  } else {
    weekendHtml = `${etiket(esc(weekendOverskrift), GUL)}
<div>${esc(INGEN_PROGNOSE)}</div>
${i.typisk ? `<div style="padding-top:6px">${typiskTekst(i.typisk, (s) => `<strong>${esc(s)}</strong>`)}</div>` : ""}`;
    weekendTekst = `${weekendOverskrift.toUpperCase()}
${INGEN_PROGNOSE}${i.typisk ? `\n${typiskTekst(i.typisk, (s) => s)}` : ""}`;
  }

  const budskabHtml = i.dfBudskab?.trim()
    ? `<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:0 24px 14px 24px;${FONT};font-size:14px;line-height:21px;color:#33415f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="4" bgcolor="${ROED}" style="background-color:${ROED};font-size:0;line-height:0">&nbsp;</td><td bgcolor="${FELT}" style="background-color:${FELT};padding:12px 14px">
<div style="font-size:12px;color:#5a6788;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px">Fra Dansk Folkeparti</div>
${esc(i.dfBudskab).replace(/\n/g, "<br>")}
</td></tr></table></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>DF-Elpriser</title>
<style>
@media only screen and (max-width:620px){ .fuld{width:100% !important} .pad{padding-left:16px !important;padding-right:16px !important} }
</style>
</head>
<body style="margin:0;padding:0;background-color:${FELT}" bgcolor="${FELT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FELT}" style="background-color:${FELT}"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" class="fuld" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">
<tr><td bgcolor="${LYSEBLAA}" class="pad" style="background-color:${LYSEBLAA};padding:16px 24px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding-right:12px"><img src="${esc(i.links.logo)}" width="48" height="48" alt="Dansk Folkeparti" border="0" style="display:block;width:48px;height:48px;border:0"></td>
<td valign="middle" style="${FONT};color:${MOERKEBLAA}"><div style="font-size:22px;line-height:26px;font-weight:bold;text-transform:uppercase">DF-Elpriser</div><div style="font-size:14px;line-height:18px">${esc(omrKort)} · ${esc(i.postnummer)}</div></td>
</tr></table></td></tr>
<tr><td bgcolor="${MOERKEBLAA}" height="4" style="background-color:${MOERKEBLAA};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:18px 24px 8px 24px;${FONT}">
${etiket(`I morgen · ${esc(datoTekst.replace(" den ", " "))}`, GROEN)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 -4px"><tr>
${kort("Billigst", esc(periodeTekst(d.billigste).replace("Kl. ", "")), `${heleOere(d.billigste.gennemsnit)} øre/kWh`, GROEN)}
${kort("Dyrest", esc(periodeTekst(d.dyreste).replace("Kl. ", "")), `${heleOere(d.dyreste.gennemsnit)} øre/kWh`, ROED)}
</tr></table>
</td></tr>
<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:6px 24px 14px 24px">${grafHtml(i.serie, d.billigste, d.dyreste, FONT)}</td></tr>
<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:4px 24px 14px 24px">
${etiket("Sammenlignet med de seneste dage", "#5a6788")}
${tabelHtml}
</td></tr>
<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:0 24px 14px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="4" bgcolor="${GUL}" style="background-color:${GUL};font-size:0;line-height:0">&nbsp;</td><td bgcolor="#fff8ec" style="background-color:#fff8ec;padding:12px 14px;${FONT};font-size:14px;line-height:21px;color:${BLAA}">
${weekendHtml}
</td></tr></table>
</td></tr>
${budskabHtml}
<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:0 24px 18px 24px;${FONT};font-size:12px;line-height:18px;color:#6b7896">
${esc(KORT_FORBEHOLD)} Kilde: Energinet.
</td></tr>
<tr><td bgcolor="${BLAA}" class="pad" style="background-color:${BLAA};padding:14px 24px 24px 24px;${FONT};font-size:12px;line-height:19px;color:#c9d2e3">
DF-Elpriser er en gratis service fra Dansk Folkeparti. Du får mailen, fordi du har tilmeldt dig og bekræftet det.<br>
<a href="${esc(i.links.hjemmeside)}" style="color:#ffffff;text-decoration:underline">Hjemmeside</a> ·
<a href="${esc(i.links.skiftPostnummer)}" style="color:#ffffff;text-decoration:underline">Skift postnummer</a> ·
<a href="${esc(i.links.privatliv)}" style="color:#ffffff;text-decoration:underline">Privatlivspolitik</a>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 14px 0"><tr><td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:4px"><a href="${esc(i.links.stop)}" style="display:inline-block;${FONT};font-size:14px;font-weight:bold;color:${BLAA};text-decoration:none;padding:12px 20px">STOP modtagelse af dette nyhedsbrev</a></td></tr></table>
<span style="font-size:11px;line-height:16px;color:#9fb0cc">Vil du have alle dine oplysninger hos os slettet, kan du <a href="${esc(i.links.slet)}" style="color:#9fb0cc;text-decoration:underline">gøre det her</a> eller skrive til ${KONTAKT_EMAIL}.</span>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `DF-ELPRISER
Elprisområde ${i.omraade} (${omrKort}), postnummer ${i.postnummer}

I MORGEN: ${datoTekst}
Billigst: ${periodeTekst(d.billigste)} (${heleOere(d.billigste.gennemsnit)} øre/kWh)
Dyrest: ${periodeTekst(d.dyreste)} (${heleOere(d.dyreste.gennemsnit)} øre/kWh)

SAMMENLIGNET MED DE SENESTE DAGE (øre pr. kWh, kun spotpris)
${raekker.map((r) => `${dagNavn(r.dato)}: lavest ${heleOere(r.laveste)}, højest ${heleOere(r.hoeyeste)}, gennemsnit ${heleOere(r.gennemsnit)}`).join("\n")}

${weekendTekst}
${i.dfBudskab?.trim() ? `\nFRA DANSK FOLKEPARTI\n${i.dfBudskab}\n` : ""}
${KORT_FORBEHOLD} Kilde: ${KILDE_TEKST}.

DF-Elpriser er en gratis service fra Dansk Folkeparti.
Hjemmeside: ${i.links.hjemmeside}
Skift postnummer: ${i.links.skiftPostnummer}
Privatlivspolitik: ${i.links.privatliv}

STOP modtagelse af dette nyhedsbrev: ${i.links.stop}

Vil du have alle dine oplysninger hos os slettet: ${i.links.slet} (eller skriv til ${KONTAKT_EMAIL}).
`;

  return {
    to: "",
    subject: `DF-Elpriser: billigst ${periodeTekst(d.billigste).toLowerCase()} ${datoTekst.split(" ")[0]}`,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${i.links.stopEtKlik}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

// ---------- Bekræftelsesmail (double opt-in) ----------

export function bekraeftelsesmail(p: { email: string; link: string; samtykker: string[]; appUrl: string }): Mail {
  const logoUrl = `${p.appUrl}/mail/logo-lys.png`;
  const privatUrl = `${p.appUrl}/privatlivspolitik`;
  const html = `<!doctype html>
<html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bekræft din tilmelding</title></head>
<body style="margin:0;padding:0;background-color:${FELT}" bgcolor="${FELT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FELT}"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td bgcolor="${LYSEBLAA}" style="background-color:${LYSEBLAA};padding:22px 28px"><img src="${esc(logoUrl)}" width="72" height="72" alt="Dansk Folkeparti" border="0" style="display:block;border:0"><div style="${FONT};font-size:26px;line-height:32px;font-weight:bold;color:${MOERKEBLAA};padding-top:14px;text-transform:uppercase">Bekræft din tilmelding</div></td></tr>
<tr><td bgcolor="${MOERKEBLAA}" height="4" style="background-color:${MOERKEBLAA};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 28px;${FONT};font-size:15px;line-height:22px;color:#33415f">
<p style="margin:0 0 18px 0">Tak for din tilmelding til <strong>DF-Elpriser</strong>. Bekræft, at det er dig:</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${ROED}" style="background-color:${ROED};border-radius:4px"><a href="${esc(p.link)}" style="display:inline-block;${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;padding:14px 26px">Bekræft tilmelding</a></td></tr></table>
<p style="margin:18px 0 0 0">Linket virker i 72 timer. Har du ikke tilmeldt dig, kan du se bort fra denne mail, så sletter vi oplysningerne automatisk.</p>
<p style="margin:22px 0 8px 0;font-size:13px;color:#5a6788">Du har givet dette samtykke:</p>
${p.samtykker.map((t) => `<div style="background-color:${FELT};border-left:4px solid ${ROED};padding:10px 14px;margin:0 0 8px 0;font-size:13px;line-height:19px">${esc(t)}</div>`).join("")}
</td></tr>
<tr><td bgcolor="${BLAA}" style="background-color:${BLAA};padding:14px 28px 24px 28px;${FONT};font-size:12px;line-height:18px;color:#c9d2e3">Dansk Folkeparti · <a href="${esc(privatUrl)}" style="color:#c9d2e3">Privatlivspolitik</a> · ${KONTAKT_EMAIL}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `Tak for din tilmelding til DF-Elpriser. Bekræft, at det er dig:
${p.link}

Linket virker i 72 timer. Har du ikke tilmeldt dig, kan du se bort fra denne mail, så sletter vi oplysningerne automatisk.

Du har givet dette samtykke:
${p.samtykker.map((t) => `- ${t}`).join("\n")}

Dansk Folkeparti, ${privatUrl}, ${KONTAKT_EMAIL}
`;
  return { to: p.email, subject: "Bekræft din tilmelding til DF-Elpriser", html, text };
}

// ---------- Besked til administrator ----------

export function driftsbesked(emne: string, linjer: string[], adresse: string): Mail {
  return {
    to: adresse,
    subject: `[DF-Elpriser] ${emne}`,
    html: `<p>${esc(emne)}</p><ul>${linjer.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`,
    text: `${emne}\n\n${linjer.map((l) => `- ${l}`).join("\n")}\n`,
  };
}
