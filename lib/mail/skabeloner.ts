import { besparelseKr } from "../pris/dag";
import { kroner, oere, periodeTekst } from "../pris/format";
import type { Dagsopsummering, Omraade } from "../pris/typer";
import { omraadeNavn } from "../omraade";
import type { DagsPrognose, Vurdering } from "../prognose/prognose";
import { laesbarDato, stortFoerst } from "../tid";
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
  bolge: string;
  privatliv: string;
  stop: string;
  stopEtKlik: string;
  skiftPostnummer: string;
  politikFra?: string;
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
  /** Politisk tekst fra Dansk Folkeparti. Kun med, hvis modtageren har givet det politiske samtykke. */
  dfBudskab?: string;
  links: MailLinks;
}

/** Hele timer uden minutter: "kl. 12 og 15". Bruges i rådet. */
function klRaad(p: { start: Date; slut: Date }): string {
  const t = periodeTekst(p).replace("Kl. ", "").split("–");
  return `mellem kl. ${t[0]} og ${t[1]}`;
}

export const MINDSTE_FORSKEL_OERE = 5;

export function dagensRaad(dag: Dagsopsummering, ugedagTekst: string): string {
  if (dag.forskel < MINDSTE_FORSKEL_OERE) {
    return `Prisen er næsten den samme hele dagen ${ugedagTekst}. Det betaler sig kun lidt at flytte dit forbrug.`;
  }
  return `Hvis du skal oplade elbilen eller vaske tøj, kan det betale sig at gøre det ${ugedagTekst} ${klRaad(dag.billigste)}. Undgå om muligt ${klRaad(dag.dyreste)}.`;
}

function prognoseLinjer(p: DagsPrognose) {
  const bil = `Kl. ${String(p.billigste.startTime).padStart(2, "0")}–${String(p.billigste.slutTime % 24 === 0 && p.billigste.slutTime > 0 ? 24 : p.billigste.slutTime).padStart(2, "0")}`;
  const usikkerhed = { lav: "lav", middel: "middel", hoej: "høj" }[p.usikkerhed];
  const forklaring = `I 8 ud af 10 af modellens seneste prognoser lå døgnets gennemsnitspris mellem ${oere(p.gennemsnitInterval.lav)} og ${oere(p.gennemsnitInterval.hoej)} øre/kWh. Enkelte timer kan afvige med op til ca. ${oere(p.timeAfvigelse)} øre.`;
  return {
    overskrift: `${laesbarDato(p.dato)}`,
    billigste: bil,
    gennemsnit: `${oere(p.gennemsnit)} øre/kWh`,
    laveste: `${oere(p.laveste)} øre/kWh`,
    hoeyeste: `${oere(p.hoeyeste)} øre/kWh`,
    usikkerhed,
    forklaring,
  };
}

export function vurderingTekst(v: Vurdering, kendtDato: string): string {
  if (v.type === "billigst") {
    return v.dato === kendtDato
      ? `Af de tre dage er ${laesbarDato(v.dato)} den billigste, og forskellen er større end prognosens usikkerhed.`
      : `Prognosen peger på ${laesbarDato(v.dato)} som den billigste af de tre dage, og forskellen er større end prognosens usikkerhed. Det er en forventning, ikke en kendt pris.`;
  }
  return "Det er for tæt til at udpege en billigste dag: forskellene mellem dagene er mindre end prognosens usikkerhed.";
}

const kort = (overskrift: string, linje1: string, linje2: string, farve: string) =>
  `<td width="50%" valign="top" style="padding:0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${FELT}" style="background-color:${FELT};border-top:4px solid ${farve};padding:12px 14px;${FONT}"><div style="font-size:12px;color:#5a6788;text-transform:uppercase;letter-spacing:1px">${overskrift}</div><div style="font-size:22px;line-height:28px;font-weight:bold;color:${BLAA};padding-top:4px">${linje1}</div><div style="font-size:13px;color:#33415f;padding-top:2px">${linje2}</div></td></tr></table></td>`;

const maerke = (tekst: string, farve: string) =>
  `<span style="${FONT};font-size:11px;font-weight:bold;letter-spacing:1px;color:#ffffff;background-color:${farve};padding:3px 8px;text-transform:uppercase">${tekst}</span>`;

export function elprisMail(i: MailIndhold): Mail {
  const d = i.dag;
  const datoTekst = laesbarDato(d.dato);
  const raad = dagensRaad(d, "i morgen");
  const spar10 = besparelseKr(d, 10);
  const omr = `${i.omraade} – ${omraadeNavn(i.omraade)}`;

  const prognoseHtml = i.prognose
    ? `<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:8px 28px 4px 28px;${FONT}">
<div style="padding:0 0 8px 0">${maerke("Prognose", GUL)}</div>
<div style="font-size:18px;line-height:24px;font-weight:bold;color:${BLAA}">De to følgende dage: forventede priser</div>
<div style="font-size:13px;line-height:19px;color:${GUL};padding:6px 0 10px 0;font-weight:bold">Disse tal er en prognose, ikke offentliggjorte priser.</div>
${i.prognose.dage
  .map((p) => {
    const l = prognoseLinjer(p);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0"><tr><td width="4" bgcolor="${GUL}" style="background-color:${GUL};font-size:0;line-height:0">&nbsp;</td><td bgcolor="${FELT}" style="background-color:${FELT};padding:10px 14px;font-size:14px;line-height:21px;color:#33415f">
<strong style="color:${BLAA}">${esc(stortFoerst(l.overskrift))} · prognose</strong><br>
Forventet billigste periode: <strong>${l.billigste}</strong><br>
Forventet gennemsnitspris: <strong>${l.gennemsnit}</strong><br>
Forventet laveste og højeste timepris: <strong>${l.laveste}</strong> og <strong>${l.hoeyeste}</strong><br>
Usikkerhed: <strong>${l.usikkerhed}</strong>. ${esc(l.forklaring)}
</td></tr></table>`;
  })
  .join("")}
<p style="margin:4px 0 12px 0;font-size:14px;line-height:21px;color:#33415f"><strong>Billigste dag:</strong> ${esc(vurderingTekst(i.prognose.vurdering, d.dato))}</p>
</td></tr>`
    : `<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:8px 28px 4px 28px;${FONT};font-size:14px;line-height:21px;color:#33415f">
<div style="padding:0 0 8px 0">${maerke("Prognose", GUL)}</div>
<p style="margin:0 0 12px 0">Vi viser ikke en prognose for de to følgende dage i dag. Datagrundlaget eller prognosemodellens træfsikkerhed er ikke god nok til, at vi vil give et bud.</p>
</td></tr>`;

  const budskabHtml = i.dfBudskab?.trim()
    ? `<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:8px 28px 12px 28px;${FONT};font-size:14px;line-height:21px;color:#33415f">
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
@media only screen and (max-width:620px){ .fuld{width:100% !important} .pad{padding-left:16px !important;padding-right:16px !important} .kort td{display:block !important;width:100% !important;padding:0 0 8px 0 !important} }
</style>
</head>
<body style="margin:0;padding:0;background-color:${FELT}" bgcolor="${FELT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FELT}" style="background-color:${FELT}"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" class="fuld" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">
<tr><td bgcolor="${LYSEBLAA}" class="pad" style="background-color:${LYSEBLAA};padding:22px 28px 6px 28px"><img src="${esc(i.links.logo)}" width="72" height="72" alt="Dansk Folkeparti" border="0" style="display:block;width:72px;height:72px;border:0"></td></tr>
<tr><td bgcolor="${LYSEBLAA}" class="pad" style="background-color:${LYSEBLAA};padding:14px 28px 24px 28px">
<div style="${FONT};font-size:28px;line-height:34px;font-weight:bold;color:${MOERKEBLAA};text-transform:uppercase">DF-Elpriser</div>
<div style="${FONT};font-size:16px;line-height:22px;color:${MOERKEBLAA};padding-top:4px">Din strøm de næste tre dage</div>
</td></tr>
<tr><td bgcolor="${MOERKEBLAA}" height="4" style="background-color:${MOERKEBLAA};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:18px 28px 6px 28px;${FONT};font-size:14px;line-height:21px;color:#33415f">
<p style="margin:0 0 12px 0;font-weight:bold;color:${BLAA}">${esc(PRAEMISSE_PROGNOSE)}</p>
<div style="padding:0 0 8px 0">${maerke("Kendte priser", GROEN)}</div>
<div style="font-size:20px;line-height:26px;font-weight:bold;color:${BLAA};">${esc(stortFoerst(datoTekst))}</div>
<div style="font-size:13px;color:#5a6788;padding:2px 0 12px 0">Elprisområde ${esc(omr)} · postnummer ${esc(i.postnummer)}</div>
<table role="presentation" class="kort" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${kort("Billigste periode", esc(periodeTekst(d.billigste)), `${oere(d.billigste.gennemsnit)} øre/kWh i gennemsnit`, GROEN)}
${kort("Dyreste periode", esc(periodeTekst(d.dyreste)), `${oere(d.dyreste.gennemsnit)} øre/kWh i gennemsnit`, ROED)}
</tr></table>
<p style="margin:14px 0 4px 0">Gennemsnitspris for døgnet: <strong>${oere(d.gennemsnit)} øre/kWh</strong>.<br>
Forskel mellem dyreste og billigste periode: <strong>${oere(d.forskel)} øre/kWh</strong>.</p>
<p style="margin:10px 0 14px 0">Flytter du 10 kWh forbrug fra den dyreste til den billigste periode, er prisforskellen <strong>${kroner(spar10)} kr.</strong> Her er kun spotprisen regnet med, så det er et regneeksempel og ikke en garanti for, hvad din elregning bliver mindre.</p>
</td></tr>
<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:0 28px 14px 28px">${grafHtml(i.serie, d.billigste, d.dyreste, FONT)}</td></tr>
<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:0 28px 12px 28px;${FONT};font-size:15px;line-height:22px;color:${BLAA}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${LYSEBLAA}" style="background-color:${LYSEBLAA};padding:12px 14px"><strong>Dagens råd</strong><br>»${esc(raad)}«</td></tr></table>
</td></tr>
${prognoseHtml}
${budskabHtml}
<tr><td bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:4px 28px 18px 28px;${FONT};font-size:12px;line-height:18px;color:#5a6788">
<strong>Det er ikke regnet med.</strong> ${esc(IKKE_MEDREGNET)}<br><br>
Kilde: ${esc(KILDE_TEKST)}. Alle priser er øre pr. kWh. Priserne følger markedets 15-minutters-intervaller.
</td></tr>
<tr><td style="font-size:0;line-height:0" bgcolor="#ffffff"><img src="${esc(i.links.bolge)}" width="600" height="60" alt="" border="0" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>
<tr><td bgcolor="${BLAA}" class="pad" style="background-color:${BLAA};padding:14px 28px 28px 28px;${FONT};font-size:12px;line-height:19px;color:#c9d2e3">
DF-Elpriser er en gratis service fra Dansk Folkeparti. Du får mailen, fordi du har tilmeldt dig og bekræftet det.<br>
<a href="${esc(i.links.hjemmeside)}" style="color:#ffffff;text-decoration:underline">Se priser og prognoser på hjemmesiden</a> ·
<a href="${esc(i.links.skiftPostnummer)}" style="color:#ffffff;text-decoration:underline">Skift postnummer</a> ·
<a href="${esc(i.links.privatliv)}" style="color:#ffffff;text-decoration:underline">Privatlivspolitik</a><br>
${i.links.politikFra ? `<a href="${esc(i.links.politikFra)}" style="color:#ffffff;text-decoration:underline">Stop politisk information, men behold elpriserne</a><br>` : ""}
<a href="${esc(i.links.stop)}" style="color:#ffffff;text-decoration:underline"><strong>Afmeld nyhedsbrevet</strong></a><br>
Spørgsmål: ${KONTAKT_EMAIL}
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const tekstTimer = i.serie
    .filter((_, n) => n % 3 === 0)
    .map((s) => `${new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(s.start)}: ${oere(s.oerePrKwh)}`)
    .join("\n");
  const prognoseTekst = i.prognose
    ? `PROGNOSE FOR DE TO FØLGENDE DAGE (ikke offentliggjorte priser)
${i.prognose.dage
  .map((p) => {
    const l = prognoseLinjer(p);
    return `${l.overskrift} - prognose
Forventet billigste periode: ${l.billigste}
Forventet gennemsnitspris: ${l.gennemsnit}
Forventet laveste og højeste timepris: ${l.laveste} og ${l.hoeyeste}
Usikkerhed: ${l.usikkerhed}. ${l.forklaring}`;
  })
  .join("\n\n")}

Billigste dag: ${vurderingTekst(i.prognose.vurdering, d.dato)}`
    : "Vi viser ikke en prognose for de to følgende dage i dag, fordi datagrundlaget eller modellens træfsikkerhed ikke er god nok.";

  const text = `DF-ELPRISER - DIN STRØM DE NÆSTE TRE DAGE
${PRAEMISSE_PROGNOSE}

KENDTE PRISER: ${datoTekst}
Elprisområde ${omr}, postnummer ${i.postnummer}
Billigste periode: ${periodeTekst(d.billigste)} (${oere(d.billigste.gennemsnit)} øre/kWh)
Dyreste periode: ${periodeTekst(d.dyreste)} (${oere(d.dyreste.gennemsnit)} øre/kWh)
Gennemsnitspris: ${oere(d.gennemsnit)} øre/kWh
Forskel mellem dyreste og billigste: ${oere(d.forskel)} øre/kWh
Flytter du 10 kWh fra den dyreste til den billigste periode, er prisforskellen ${kroner(spar10)} kr. (kun spotpris, regneeksempel).

Pris pr. 3. time (øre/kWh):
${tekstTimer}

DAGENS RÅD
»${raad}«

${prognoseTekst}
${i.dfBudskab?.trim() ? `\nFRA DANSK FOLKEPARTI\n${i.dfBudskab}\n` : ""}
DET ER IKKE REGNET MED
${IKKE_MEDREGNET}
Kilde: ${KILDE_TEKST}.

DF-Elpriser er en gratis service fra Dansk Folkeparti.
Hjemmeside: ${i.links.hjemmeside}
Skift postnummer: ${i.links.skiftPostnummer}
Privatlivspolitik: ${i.links.privatliv}
${i.links.politikFra ? `Stop politisk information (elpriserne fortsætter): ${i.links.politikFra}\n` : ""}Afmeld nyhedsbrevet: ${i.links.stop}
Spørgsmål: ${KONTAKT_EMAIL}
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
