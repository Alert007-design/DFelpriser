// Viser nyhedsbrevet med TESTDATA som HTML-fil (kun til visuel kontrol). Brug: node --experimental-strip-types scripts/rendermail.ts ud.html
import { writeFileSync } from "node:fs";
import { elprisMail } from "../lib/mail/skabeloner";
import { testDag } from "../lib/kilder/test";
import { opsummer, timeserie } from "../lib/pris/dag";

const slots = await testDag("DK2", "2026-10-24");
const dag = opsummer("2026-10-24", slots);
const prog = (dato: string, h: 1 | 2, g: number) => ({
  dato, horisont: h, profil: [], gennemsnit: g, gennemsnitInterval: { lav: g - 18, hoej: g + 18 }, laveste: g - 40, hoeyeste: g + 60,
  billigste: { startTime: 11, slutTime: 14, gennemsnit: g - 30 }, timeAfvigelse: 31, usikkerhed: "middel" as const,
});
const mail = elprisMail({
  omraade: "DK2", postnummer: "2100", dag, serie: timeserie(slots),
  seneste: [],
  typisk: { dage: 14, billigste: [{ startTime: 2, slutTime: 5 }, { startTime: 12, slutTime: 15 }], dyreste: { startTime: 17, slutTime: 20 } },
  prognose: { dage: [prog("2026-10-25", 1, 90), prog("2026-10-26", 2, 105)], vurdering: { type: "taet_loeb", datoer: ["2026-10-24", "2026-10-25"] } },
  dfBudskab: "EKSEMPELTEKST fra Dansk Folkeparti (leveres af partiet).",
  links: { hjemmeside: "http://localhost:3111", logo: "http://localhost:3111/mail/df-logo.png", privatliv: "#", stop: "#", stopEtKlik: "#", skiftPostnummer: "#", slet: "#" },
});
writeFileSync(process.argv[2] ?? "mail.html", mail.html);
console.log(mail.subject);
