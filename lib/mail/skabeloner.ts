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

// Samme klassiske udtryk som benzinmailen (Mike Kaltoft, 30/10-2026): partiets lyseblå
// baggrund, mørkeblå serif-overskrifter, tynde linjer og messing, ingen kort og bokse.
const PRIMAER = BLAA;
const ANTRACIT = "#252525";
const MESSING = "#A58A58";
const GRAA = "#4E5A6B";
const LINJE = "#B3CDE2";
const BUNDTEKST = "#E4DFD3";
const SERIF = "font-family:Georgia,'Times New Roman',Times,serif";

/** Emnet afslører ikke tallene, så modtageren åbner mailen (Mike Kaltoft, 30/10-2026). */
export const EMNE = "Dagens elpriser: Her bliver det billigst";
export const TITEL = "Dagens elpriser";

const hairline = (farve: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="${farve}" style="background-color:${farve};height:1px;font-size:0;line-height:0">&nbsp;</td></tr></table>`;

const etiket = (tekst: string, farve = GRAA) =>
  `<div style="${FONT};font-size:11px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:${farve};padding:0 0 6px 0">${tekst}</div>`;

const underoverskrift = (tekst: string) =>
  `<div style="${SERIF};font-size:17px;line-height:23px;font-style:italic;color:${PRIMAER};padding:0 0 8px 0">${tekst}</div>`;

const kolonne = (overskrift: string, tid: string, pris: string, farve: string) =>
  `${etiket(overskrift, farve)}<div style="${SERIF};font-size:34px;line-height:40px;color:${PRIMAER}">${tid}</div><div style="width:40px;height:1px;line-height:1px;font-size:0;background-color:${MESSING};margin:10px 0 0 0">&nbsp;</div><div style="${FONT};font-size:13px;line-height:20px;color:${ANTRACIT};padding-top:10px">${pris}</div>`;

export function elprisMail(i: MailIndhold): Mail {
  const d = i.dag;
  const datoTekst = laesbarDato(d.dato);
  const omrKort = omraadeNavn(i.omraade).split(" (")[0];
  const dag2 = laegDage(d.dato, 1);
  const dag3 = laegDage(d.dato, 2);
  const weekendOverskrift = `${dagNavn(dag2)} og ${ugedag(dag3)}`;
  const raekker = [...i.seneste.filter((x) => x.dato < d.dato), d];

  const celle = (indhold: string, opts: { right?: boolean; fed?: boolean; foerste?: boolean } = {}) =>
    `<td${opts.right ? ' align="right"' : ""} style="padding:8px ${opts.right ? "0" : "8px"} 8px 0;border-top:1px solid ${LINJE};${FONT};font-size:13px;line-height:18px;color:${opts.fed ? ANTRACIT : GRAA};${opts.fed ? "font-weight:bold;" : ""}">${indhold}</td>`;
  const tabelHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
<tr><td style="${FONT};font-size:11px;color:${GRAA};padding-bottom:4px"></td><td align="right" style="${FONT};font-size:11px;color:${GRAA};padding-bottom:4px">Lavest</td><td align="right" style="${FONT};font-size:11px;color:${GRAA};padding-bottom:4px">Højest</td><td align="right" style="${FONT};font-size:11px;color:${GRAA};padding-bottom:4px">Gns.</td></tr>
${raekker
  .map((r) => {
    const fed = r.dato === d.dato;
    return `<tr>${celle(esc(dagNavn(r.dato)), { fed })}${celle(heleOere(r.laveste), { right: true, fed })}${celle(heleOere(r.hoeyeste), { right: true, fed })}${celle(heleOere(r.gennemsnit), { right: true, fed })}</tr>`;
  })
  .join("\n")}
</table>
<div style="${FONT};font-size:11px;color:${GRAA};padding-top:6px">Øre pr. kWh, kun spotpris.</div>`;

  let weekendHtml: string;
  let weekendTekst: string;
  if (i.prognose) {
    const p = i.prognose;
    const vurdering = vurderingTekst(p.vurdering, d.dato);
    weekendHtml = `${underoverskrift(`${esc(weekendOverskrift)} · prognose`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
${p.dage.map((x) => `<tr>${celle(esc(dagNavn(x.dato)))}${celle(`billigst ca. <strong style="color:${ANTRACIT}">${prognoseTidsrum(x)}</strong>`)}${celle(`ca. ${heleOere(x.gennemsnit)} øre`, { right: true })}</tr>`).join("\n")}
</table>
${vurdering ? `<div style="${FONT};font-size:13px;line-height:20px;color:${ANTRACIT};padding-top:8px">${esc(vurdering)}</div>` : ""}
<div style="${FONT};font-size:11px;line-height:16px;color:${GRAA};padding-top:6px">Et bud, ikke kendte priser. Beløbet er døgnets gennemsnit. Usikkerhed: ${usikkerhedTekst(p.dage)}.</div>`;
    weekendTekst = `${weekendOverskrift.toUpperCase()} - PROGNOSE (et bud, ikke kendte priser)
${p.dage.map((x) => `${dagOgDato(x.dato)}: billigst ca. ${prognoseTidsrum(x)}, gennemsnit ca. ${heleOere(x.gennemsnit)} øre`).join("\n")}
${vurdering ? `${vurdering}\n` : ""}Usikkerhed: ${usikkerhedTekst(p.dage)}.`;
  } else {
    weekendHtml = `${underoverskrift(esc(weekendOverskrift))}
<div style="${FONT};font-size:13px;line-height:20px;color:${ANTRACIT}">${esc(INGEN_PROGNOSE)}</div>
${i.typisk ? `<div style="${FONT};font-size:13px;line-height:20px;color:${ANTRACIT};padding-top:6px">${typiskTekst(i.typisk, (s) => `<strong>${esc(s)}</strong>`)}</div>` : ""}`;
    weekendTekst = `${weekendOverskrift.toUpperCase()}
${INGEN_PROGNOSE}${i.typisk ? `\n${typiskTekst(i.typisk, (s) => s)}` : ""}`;
  }

  const budskabHtml = i.dfBudskab?.trim()
    ? `<tr><td class="pad" style="padding:6px 40px 0 40px">${hairline(MESSING)}</td></tr>
<tr><td class="pad" style="padding:22px 40px 8px 40px;${SERIF};font-size:20px;line-height:26px;color:${PRIMAER}">Fra Dansk Folkeparti</td></tr>
<tr><td class="pad" style="padding:0 40px 18px 40px;${FONT};font-size:14px;line-height:22px;color:${ANTRACIT}">${esc(i.dfBudskab.trim()).replace(/\n/g, "<br>")}</td></tr>`
    : "";

  const link = (href: string, tekst: string) => `<a href="${esc(href)}" style="color:${BUNDTEKST};text-decoration:underline">${esc(tekst)}</a>`;
  const forhaand = `I morgen er strømmen billigst ${periodeTekst(d.billigste).toLowerCase()} i ${omrKort}`;

  const html = `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${TITEL}</title>
<style>
@media only screen and (max-width:620px){ .fuld{width:100% !important} .pad{padding-left:22px !important;padding-right:22px !important} .kol{display:block !important;width:100% !important} .gap{display:block !important;width:100% !important;height:28px !important} }
</style>
</head>
<body style="margin:0;padding:0;background-color:${LYSEBLAA}" bgcolor="${LYSEBLAA}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${LYSEBLAA}">${esc(forhaand)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${LYSEBLAA}" style="background-color:${LYSEBLAA}"><tr><td align="center" style="padding:0">
<table role="presentation" class="fuld" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${LYSEBLAA}" style="width:600px;max-width:600px;background-color:${LYSEBLAA}">
<tr><td align="center" class="pad" style="padding:36px 40px 0 40px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding-right:14px"><img src="${esc(i.links.logo)}" width="56" height="56" alt="Dansk Folkeparti" border="0" style="display:block;width:56px;height:56px;border:0"></td>
<td valign="middle" style="${SERIF};font-size:34px;line-height:40px;color:${PRIMAER}">${TITEL}</td>
</tr></table></td></tr>
<tr><td align="center" class="pad" style="padding:14px 40px 0 40px;${FONT};font-size:12px;line-height:18px;letter-spacing:1px;color:${GRAA}">${esc(omrKort)} · postnummer ${esc(i.postnummer)}</td></tr>
<tr><td class="pad" style="padding:22px 40px 0 40px">${hairline(PRIMAER)}</td></tr>
<tr><td class="pad" style="padding:3px 40px 26px 40px">${hairline(PRIMAER)}</td></tr>
<tr><td class="pad" style="padding:0 40px 8px 40px;${SERIF};font-size:19px;line-height:26px;font-style:italic;color:${PRIMAER}">I morgen, ${esc(datoTekst.replace(" den ", " "))}</td></tr>
<tr><td class="pad" style="padding:10px 40px 24px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="kol" width="47%" valign="top">${kolonne("Billigst", esc(periodeTekst(d.billigste).replace("Kl. ", "kl. ")), `${heleOere(d.billigste.gennemsnit)} øre/kWh i gennemsnit`, GROEN)}</td>
<td class="gap" width="6%" style="font-size:0;line-height:0">&nbsp;</td>
<td class="kol" width="47%" valign="top">${kolonne("Dyrest", esc(periodeTekst(d.dyreste).replace("Kl. ", "kl. ")), `${heleOere(d.dyreste.gennemsnit)} øre/kWh i gennemsnit`, ROED)}</td>
</tr></table></td></tr>
<tr><td class="pad" style="padding:0 40px 26px 40px">${grafHtml(i.serie, d.billigste, d.dyreste, FONT)}</td></tr>
<tr><td class="pad" style="padding:0 40px 26px 40px">${underoverskrift("Sammenlignet med de seneste dage")}${tabelHtml}</td></tr>
<tr><td class="pad" style="padding:0 40px 26px 40px">${weekendHtml}</td></tr>
${budskabHtml}
<tr><td class="pad" style="padding:0 40px 30px 40px;${FONT};font-size:11px;line-height:17px;color:${GRAA}">${esc(KORT_FORBEHOLD)} Kilde: Energinet.</td></tr>
<tr><td bgcolor="${PRIMAER}" class="pad" style="background-color:${PRIMAER};padding:30px 40px 34px 40px;${FONT};font-size:12px;line-height:19px;color:${BUNDTEKST}">
DF-Elpriser er en gratis service fra Dansk Folkeparti. Du får mailen, fordi du har tilmeldt dig og bekræftet det.<br>
${link(i.links.hjemmeside, "Hjemmeside")} · ${link(i.links.skiftPostnummer, "Skift postnummer")} · ${link(i.links.privatliv, "Privatlivspolitik")}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 14px 0"><tr><td style="border:1px solid ${BUNDTEKST}"><a href="${esc(i.links.stop)}" style="display:inline-block;${FONT};font-size:13px;letter-spacing:1px;color:${LYSEBLAA};text-decoration:none;padding:11px 20px">STOP modtagelse af dette nyhedsbrev</a></td></tr></table>
<span style="font-size:11px;line-height:16px;color:#9fb0cc">Vil du have alle dine oplysninger hos os slettet, kan du <a href="${esc(i.links.slet)}" style="color:#9fb0cc;text-decoration:underline">gøre det her</a> eller skrive til ${KONTAKT_EMAIL}.</span>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `DANSK FOLKEPARTI - ${TITEL.toUpperCase()}
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
    subject: EMNE,
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
  const logoUrl = `${p.appUrl}/mail/df-logo.png`;
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
