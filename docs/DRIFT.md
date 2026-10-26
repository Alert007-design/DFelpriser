# Drift: opsætning, omkostninger og fejlhåndtering

## Dagligt forløb

| Job | Tid (UTC cron) | Hvad |
|---|---|---|
| `/api/cron/hent-priser` | hvert 10. min kl. 02 og 10–15 | Henter de seneste 7 døgn, i dag og i morgen. Idempotent. Logger i `hentelog` |
| `/api/cron/udsend` | hvert minut kl. 14–15 og hvert 5. min kl. 16–18 | Gør kun noget 16.00–18.59 dansk tid, sommer som vinter. Sender højst 100 mails pr. kald. Se nedenfor |
| `/api/cron/ryd-op` | hver time | Sletter ubekræftede (72 t), gamle ratebegrænsninger og logposter over 180 dage. Personer, der har stoppet mailen, slettes aldrig automatisk |

Cron kører altid i UTC. Handleren afgør selv dansk tid, så 16.00 er rigtigt både sommer og vinter.

## Udsendelsen

1. Pr. område (DK1, DK2) låses dagens række i `udsendelser`.
2. Er morgendagens døgn ikke fuldstændigt, hentes det igen. Mangler det stadig: status `afventer_priser`, besked i driftsloggen og til `ADMIN_EMAIL`, og et nyt forsøg om 5 minutter. **Der bruges aldrig gamle eller opdigtede priser.**
3. Kl. 19.00, hvis priserne stadig mangler: status `droppet`, log og besked. Intet sendes den dag.
4. Er alt klar, beregnes indhold én gang pr. område og sendes højst 100 mails pr. kald (på tværs af begge områder), så Gmail ikke bremser afsenderen; cron kalder hvert minut fra 16.00, så op til ca. 6.000 modtagere nås inden 16.59. Et område står som `i_gang`, indtil ingen modtagere er tilbage, og først da som `faerdig`. Hver modtager reserveres i `udsendelseslog` (primærnøgle: person, dato), så ingen får to mails, selv ved samtidige kørsler eller genstart. Fejlede portioner sendes ikke igen automatisk (hellere én manglende end én dobbelt); de logges, og admin får besked.
5. Testdata og manglende juridisk godkendelse begrænser modtagerne til testmodtagere.

## Fejl og hvad der sker

| Fejl | Håndtering |
|---|---|
| Kilden nede eller 5xx/429 | 3 forsøg med ventetid; logges; udsendelsen venter og prøver igen |
| Kilden svarer i et uventet format | Parseren kaster, intet gemmes, intet sendes, fejlen logges |
| Ufuldstændigt døgn | Betragtes som ikke offentliggjort |
| En gemt pris ændrer sig hos kilden | Overskrives, og en advarsel logges |
| Prognosen fejler eller er ikke dokumenteret | Mailen sendes uden prognose og siger det |
| Resend-fejl på en portion | Registreres som fejlet, admin får besked |
| Dobbelte cron-kald | Ufarligt (se punkt 4) |

## Admin: `/admin`

Adgangskode (`ADMIN_PASSWORD`). Viser abonnenttal (aktive samtykker, hvor mange der får den daglige mail, pr. område, hvor mange der har stoppet mailen, hvor manges samtykke dækker politisk information, afventende, test), om morgendagens priser er fuldstændige, om prognosen må vises, udsendelser og status, hentninger, driftslog og prognoser mod faktiske priser.

## Opsætning (det du selv skal gøre)

Disse trin kræver dine konti og er ikke udført:

1. **Supabase:** opret et NYT projekt (region eu-central-1). Kør `supabase/migrations/*.sql` i SQL Editor. Læg forbindelsesstrengen (Transaction pooler, port 6543) i `DATABASE_URL`.
2. **Resend:** opret afsenderdomæne til DF-Elpriser (og DNS-poster). Sæt `RESEND_API_KEY`, `MAIL_FROM`. Valgfrit: `MAIL_FROM_NYHEDSBREV` giver nyhedsbrevet en anden afsender end bekræftelsesmailen; er den tom, bruges `MAIL_FROM`.
3. **Vercel:** nyt projekt fra dette repo, region fra1, Pro-plan (cron hvert minut kræver Pro). Sæt variablerne fra `.env.example`: `TOKEN_HEMMELIGHED`, `CRON_SECRET`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `APP_URL`, `PRISKILDE=live`. **Lad `JURA_GODKENDT=nej` og `OFFENTLIG=nej`.**
4. **Netværk:** hvis jobbene kører et sted med begrænset udgående trafik, skal `api.energidataservice.dk` tillades.
5. **Fyld historik:** kald `/api/cron/hent-priser?fra=2026-06-01&til=2026-06-30` (med `Authorization: Bearer <CRON_SECRET>`) i blokke på højst 31 døgn tilbage til mindst 130 dage. Prognosen kræver historik.
6. **Analysen mod rigtige priser er gennemført** (se [ANALYSE.md](ANALYSE.md)); modellen består de godkendte krav. Gentag med `npm run analyse -- <fra> <til> [<delperiode-fra> <delperiode-til>]`, når der er nye data, fx efter næste vinter.
7. **Test:** tilføj dine egne adresser i `TESTMODTAGERE`, tilmeld dig, bekræft, og afvent kl. 16 (eller kald `/api/cron/udsend`).
8. **Lancering (først efter din godkendelse og juridisk godkendelse):** `JURA_GODKENDT=ja`, `OFFENTLIG=ja`, og peg domænet på projektet.

## Driftsomkostninger (anslag, ikke kontrolleret)

Priserne er fra min hukommelse af leverandørernes priser og skal kontrolleres på deres prissider, før du beslutter noget.

| Post | Anslag |
|---|---|
| Vercel Pro | ca. 20 USD pr. måned pr. bruger (kan deles med DF-priser, hvis samme team) |
| Supabase | Eget projekt: Pro ca. 25 USD pr. måned for organisationen plus beregningsressourcer til et ekstra projekt (ca. 10 USD). Databasen er lille |
| Resend | Gratisniveauet har en dagsgrænse, der ikke rækker til et dagligt brev til flere end ganske få abonnenter. Betalt niveau (ca. 20 USD pr. måned) dækker omkring 1.600 daglige abonnenter (50.000 mails pr. måned), større niveauer koster mere |
| Energi Data Service | Gratis |
| Domæne | Efter registrator |

Hovedposten bliver Resend, som vokser med antallet af abonnenter (30 mails pr. abonnent pr. måned). Resten er næsten faste omkostninger. Systemet kan vokse uden manuelt arbejde: beregningen sker én gang pr. område, ikke pr. person, og udsendelsen går i portioner med tidsgrænse og genoptagelse.
