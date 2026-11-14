import { periodeTekst } from "../pris/format";
import type { TypiskeTider } from "../pris/reference";
import type { Dagsopsummering, Omraade } from "../pris/typer";
import { omraadeNavn } from "../omraade";
import type { DagsPrognose, Vurdering } from "../prognose/prognose";
import { laesbarDato, stortFoerst, ugedag } from "../tid";
import type { Mail } from "./afsender";
import { grafHtml, type Soejle } from "./graf";
import { DEL_MAIL_TEKST } from "../deling";

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
  /** Siden /del, hvor modtageren kan sende tjenesten videre til en ven. Uden link vises linjen ikke. */
  del?: string;
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

/** Hele øre uden decimaler: "165", "−3". */
export function heleOere(v: number): string {
  return String(Math.round(v)).replace("-", "−");
}

/** Øre pr. kWh vist som kroner med to decimaler, som medierne skriver elpriser: 276 → "2,76" (Morten, 4/11-2026). */
export function kronerPrKwh(oere: number): string {
  return (Math.round(oere) / 100).toFixed(2).replace(".", ",").replace("-", "−");
}

/** "Lørdag" */
const dagNavn = (dato: string) => stortFoerst(ugedag(dato));
/** Én linje, kun når prognosen sikkert peger på én dag som billigst. */
export function vurderingTekst(v: Vurdering, kendtDato: string): string | null {
  if (v.type !== "billigst") return null;
  return v.dato === kendtDato
    ? `Af de tre dage bliver ${ugedag(v.dato)} den billigste.`
    : `Af de tre dage ventes ${ugedag(v.dato)} at blive den billigste.`;
}

const KORT_FORBEHOLD = "Kun spotprisen før moms. Nettarif, elafgift, moms, abonnement og elselskabets tillæg er ikke regnet med.";

// Samme enkle udtryk som benzinmailen (Mike Kaltoft, 2/11-2026): grå baggrund, hvid blok og lyseblå header
// med DF-logoet. Mailen går direkte til billigst, dyrest og grafen over dagen. Prognosen for de to følgende
// dage er taget ud (Morten, 3/11-2026), fordi den for ofte ikke kunne give et bud.

/** Emnet afslører ikke tallene, så modtageren åbner mailen (Mike Kaltoft, 30/10-2026). */
export const EMNE = "Dagens elpriser: Her bliver det billigst";
export const TITEL = "Dagens elpriser";

const TEKST = "#33415f";
const DAEMPET = "#5a6788";

const kort = (overskrift: string, tid: string, pris: string, farve: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FELT}" style="background-color:${FELT}"><tr><td class="kort" style="padding:16px 20px;${FONT}">
<div style="font-size:12px;font-weight:bold;letter-spacing:1px;color:${farve};text-transform:uppercase">${overskrift}</div>
<div style="font-size:28px;line-height:34px;font-weight:bold;color:${MOERKEBLAA};padding-top:4px">${tid}</div>
<div style="font-size:14px;line-height:20px;color:${TEKST};padding-top:4px">${pris}</div>
</td></tr></table>`;

export function elprisMail(i: MailIndhold): Mail {
  const d = i.dag;
  const datoTekst = laesbarDato(d.dato);
  const omrKort = omraadeNavn(i.omraade).split(" (")[0];
  const raekker = [...i.seneste.filter((x) => x.dato < d.dato), d];

  const celle = (indhold: string, opts: { right?: boolean; fed?: boolean } = {}) =>
    `<td${opts.right ? ' align="right"' : ""} style="padding:8px ${opts.right ? "0" : "8px"} 8px 0;border-top:1px solid #e3e8f1;${FONT};font-size:13px;line-height:18px;color:${opts.fed ? MOERKEBLAA : TEKST};${opts.fed ? "font-weight:bold;" : ""}">${indhold}</td>`;
  const tabelHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
<tr><td style="${FONT};font-size:11px;color:${DAEMPET};padding-bottom:4px"></td><td align="right" style="${FONT};font-size:11px;color:${DAEMPET};padding-bottom:4px">Lavest</td><td align="right" style="${FONT};font-size:11px;color:${DAEMPET};padding-bottom:4px">Højest</td><td align="right" style="${FONT};font-size:11px;color:${DAEMPET};padding-bottom:4px">Gns.</td></tr>
${raekker
  .map((r) => {
    const fed = r.dato === d.dato;
    return `<tr>${celle(esc(dagNavn(r.dato)), { fed })}${celle(kronerPrKwh(r.laveste), { right: true, fed })}${celle(kronerPrKwh(r.hoeyeste), { right: true, fed })}${celle(kronerPrKwh(r.gennemsnit), { right: true, fed })}</tr>`;
  })
  .join("\n")}
</table>
<div style="${FONT};font-size:11px;color:${DAEMPET};padding-top:6px">Kr. pr. kWh, kun spotpris.</div>`;

  const overskrift = (tekst: string) =>
    `<div style="${FONT};font-size:16px;line-height:22px;font-weight:bold;color:${MOERKEBLAA};padding:0 0 8px 0">${tekst}</div>`;

  const budskabHtml = i.dfBudskab?.trim()
    ? `<tr><td style="padding:22px 0 0 0">${overskrift("Fra Dansk Folkeparti")}<div style="${FONT};font-size:14px;line-height:21px;color:${TEKST}">${esc(i.dfBudskab.trim()).replace(/\n/g, "<br>")}</div></td></tr>`
    : "";

  const delHtml = i.links.del
    ? `<tr><td style="padding:22px 0 0 0;${FONT};font-size:14px;line-height:21px;color:${TEKST}">${esc(DEL_MAIL_TEKST.foer)}<a href="${esc(i.links.del)}" style="color:${MOERKEBLAA};text-decoration:underline">${esc(DEL_MAIL_TEKST.link)}</a>${esc(DEL_MAIL_TEKST.efter)}</td></tr>`
    : "";

  const link = (href: string, tekst: string) => `<a href="${esc(href)}" style="color:#c9d2e3;text-decoration:underline">${esc(tekst)}</a>`;
  const forhaand = `I morgen er strømmen billigst ${periodeTekst(d.billigste).toLowerCase()} i ${omrKort}`;
  const tid = (p: typeof d.billigste) => esc(periodeTekst(p).replace("Kl. ", "kl. "));

  const html = `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${TITEL}</title>
<style>
@media only screen and (max-width:620px){ .fuld{width:100% !important} .pad{padding-left:16px !important;padding-right:16px !important} .kol{display:block !important;width:100% !important} .gap{display:block !important;width:100% !important;height:12px !important} .kort{padding-left:14px !important;padding-right:14px !important} }
</style>
</head>
<body style="margin:0;padding:0;background-color:${FELT}" bgcolor="${FELT}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${FELT}">${esc(forhaand)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FELT}" style="background-color:${FELT}"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" class="fuld" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">
<tr><td bgcolor="${LYSEBLAA}" class="pad" style="background-color:${LYSEBLAA};padding:22px 28px 6px 28px"><img src="${esc(i.links.logo)}" width="64" height="64" alt="Dansk Folkeparti" border="0" style="display:block;width:64px;height:64px;border:0"></td></tr>
<tr><td bgcolor="${LYSEBLAA}" class="pad" style="background-color:${LYSEBLAA};padding:14px 28px 24px 28px">
<div style="${FONT};font-size:30px;line-height:36px;font-weight:bold;color:${MOERKEBLAA};text-transform:uppercase">${TITEL}</div>
<div style="${FONT};font-size:14px;color:${TEKST};padding-top:8px">${esc(omrKort)} · postnummer ${esc(i.postnummer)}</div>
</td></tr>
<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:24px 28px 26px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 0 14px 0;${FONT};font-size:15px;color:${TEKST}">I morgen, ${esc(datoTekst.replace(" den ", " "))}</td></tr>
<tr><td style="padding:0 0 18px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="kol" width="49%" valign="top">${kort("Billigst", tid(d.billigste), `${kronerPrKwh(d.billigste.gennemsnit)} kr. pr. kWh i gennemsnit`, GROEN)}</td>
<td class="gap" width="2%" style="font-size:0;line-height:0">&nbsp;</td>
<td class="kol" width="49%" valign="top">${kort("Dyrest", tid(d.dyreste), `${kronerPrKwh(d.dyreste.gennemsnit)} kr. pr. kWh i gennemsnit`, ROED)}</td>
</tr></table></td></tr>
<tr><td style="padding:0 0 22px 0">${overskrift("Priserne time for time")}${grafHtml(i.serie, d.billigste, d.dyreste, FONT)}</td></tr>
<tr><td style="padding:0">${overskrift("Sammenlignet med de seneste dage")}${tabelHtml}</td></tr>
${budskabHtml}
${delHtml}
<tr><td style="padding:22px 0 0 0;${FONT};font-size:11px;line-height:17px;color:${DAEMPET}">${esc(KORT_FORBEHOLD)} Kilde: Energinet.</td></tr>
</table></td></tr>
<tr><td bgcolor="${BLAA}" class="pad" style="background-color:${BLAA};padding:22px 28px 28px 28px;${FONT};font-size:12px;line-height:18px;color:#c9d2e3">
Du får denne mail, fordi du har tilmeldt dig Dagens elpriser fra Dansk Folkeparti.<br>
${link(i.links.hjemmeside, "Hjemmeside")} · ${link(i.links.skiftPostnummer, "Skift postnummer")} · ${link(i.links.privatliv, "Privatlivspolitik")}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 14px 0"><tr><td style="border:1px solid #c9d2e3"><a href="${esc(i.links.stop)}" style="display:inline-block;${FONT};font-size:13px;letter-spacing:1px;color:#ffffff;text-decoration:none;padding:11px 20px">STOP modtagelse af dette nyhedsbrev</a></td></tr></table>
<span style="font-size:11px;line-height:16px;color:#9fb0cc">Vil du have alle dine oplysninger hos os slettet, kan du <a href="${esc(i.links.slet)}" style="color:#9fb0cc;text-decoration:underline">gøre det her</a> eller skrive til ${KONTAKT_EMAIL}.</span>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `DANSK FOLKEPARTI - ${TITEL.toUpperCase()}
Elprisområde ${i.omraade} (${omrKort}), postnummer ${i.postnummer}

I MORGEN: ${datoTekst}
Billigst: ${periodeTekst(d.billigste)} (${kronerPrKwh(d.billigste.gennemsnit)} kr. pr. kWh)
Dyrest: ${periodeTekst(d.dyreste)} (${kronerPrKwh(d.dyreste.gennemsnit)} kr. pr. kWh)

SAMMENLIGNET MED DE SENESTE DAGE (kr. pr. kWh, kun spotpris)
${raekker.map((r) => `${dagNavn(r.dato)}: lavest ${kronerPrKwh(r.laveste)}, højest ${kronerPrKwh(r.hoeyeste)}, gennemsnit ${kronerPrKwh(r.gennemsnit)}`).join("\n")}
${i.dfBudskab?.trim() ? `\nFRA DANSK FOLKEPARTI\n${i.dfBudskab.trim()}\n` : ""}${i.links.del ? `\n${DEL_MAIL_TEKST.foer}${DEL_MAIL_TEKST.link}${DEL_MAIL_TEKST.efter.replace(/\.$/, "")}: ${i.links.del}\n` : ""}
${KORT_FORBEHOLD} Kilde: ${KILDE_TEKST}.

Du får denne mail, fordi du har tilmeldt dig Dagens elpriser fra Dansk Folkeparti.
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
