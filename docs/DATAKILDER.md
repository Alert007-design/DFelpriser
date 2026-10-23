# Datakilder, adgang og licens

**Vigtigt forbehold:** udviklingsmiljøet havde ingen netadgang til `api.energidataservice.dk` (blokeret af miljøets netværksregler), Open-Meteo eller andre kilder. Intet nedenfor er prøvet mod de rigtige tjenester. Oplysningerne bygger på søgninger i åbne kilder og skal bekræftes ved første kørsel, se punktet "Sådan verificeres".

## Spotpriser: Energi Data Service (Energinet), datasættet `DayAheadPrices`

| Emne | Hvad er fundet |
|---|---|
| Adgang | Åbent REST-API: `https://api.energidataservice.dk/dataset/DayAheadPrices`, ingen nøgle |
| Indhold | Day-ahead-priser pr. prisområde (`DK1`, `DK2`) i DKK og EUR pr. MWh. Det ældre datasæt `Elspotprices` opdateres ikke længere efter 30. september 2025 |
| Opløsning | Kvarterspriser (15 minutter) siden 1. oktober 2025. Én kilde (et forum) nævner det; ikke bekræftet i officiel dokumentation. Koden aflæser opløsningen af data (15 eller 60 minutter) og afviser alt andet |
| Felter i koden | `TimeUTC`, `PriceArea`, `DayAheadPriceDKK` (fra åbne klientbiblioteker, ikke bekræftet mod live-svar) |
| Licens | CC BY 4.0 efter Energi Data Services egen side. Fri brug, også kommerciel; kildeangivelse anbefales. Mailen og siden angiver kilden |
| Rate limits | Findes og varierer pr. datasæt (HTTP 429 ved overskridelse). Tallene er ikke fundet. Koden henter få og samlede kald (højst hvert 10. minut i hentevinduet) og prøver igen med ventetid |
| Tilgængelighed | Energi Data Service skriver, at oppetid forventes over 90 %. Derfor venter systemet, genprøver og dropper hellere end at sende forkert |
| Offentliggørelse | Day-ahead-priserne for næste døgn offentliggøres normalt omkring kl. 13 (ikke bekræftet her). Systemet er bygget uafhængigt af det præcise tidspunkt: det tjekker fuldstændighed fra kl. 16 og genprøver hvert 5. minut til kl. 19 |

### Fuldstændighedskontrol

Før noget sendes, kontrolleres for hvert område, at morgendagens døgn består af intervaller, der følger lige efter hinanden fra dansk midnat til dansk midnat, uden huller og dobbeltrækker, og at alle priser er tal. Antallet bliver 92 (sidste søndag i marts), 96 eller 100 kvarterer (sidste søndag i oktober), eller 23/24/25 timer ved timeopløsning. Alt andet tæller som ufuldstændigt og sender ingenting.

### Nord Pool

Prisen i Energi Data Service er markedets day-ahead-pris. Et direkte Nord Pool-API kræver aftale og er ikke undersøgt; det er ikke nødvendigt, så længe Energi Data Service dækker behovet. Mailen skriver derfor kun "Energinet, Energi Data Service" som kilde.

## Ikke indbygget (undersøgt, men ikke bygget)

| Behov | Status |
|---|---|
| **Netselskab og nettariffer** | Ikke indregnet. Et postnummer kan dække flere netselskabers områder, så netselskabet kan ikke afgøres ud fra postnummer alene; det kræver en adresse. Tariffer findes som åbne data hos Energi Data Service (`DatahubPricelist`, tariffer pr. netselskab og tidspunkt), og Energinets Eloverblik/DataHub har netområdeopslag pr. adresse eller målepunkt. Ikke prøvet, ingen adgang fra miljøet |
| **Elafgift og moms** | Ikke indregnet. Satserne ændres ved lov og skal verificeres hos Skatteforvaltningen og Skatteministeriet, før de bruges. Moms er 25 %, men er ikke ganget på de viste priser |
| **Øvrige priselementer** | Energinets tariffer, abonnement og elhandlerens tillæg afhænger af brugerens aftale. Kan ikke beregnes uden den |
| **Vejr** | Vind-, sol- og temperaturprognoser (fx DMI's åbne data eller Open-Meteo) ville sandsynligvis forbedre prognosen for dag 2 og 3, især vind. Ikke bygget, fordi det ikke kan testes uden netadgang |
| **Produktion, forbrug, import/eksport** | Findes hos Energi Data Service (fx `ElectricityBalanceNonv`, `Forecasts_Hour` for vind og sol, `PowerSystemRightNow`). Ikke bygget; samme grund |

**Konsekvens:** mails og site viser kun spotprisen og siger, hvad der ikke er med. Der opfindes ingen individuelle priser eller besparelser, og besparelseseksemplet er mærket som kun-spotpris.

## Postnummer til elprisområde

`lib/omraade.ts`: 1000–4999 er DK2, 5000–9999 er DK1, 0800–0999 og 3800–3999 (Færøerne, Grønland) afvises. Reglen følger geografien (Jylland og Fyn er DK1; Sjælland, Lolland-Falster, Møn og Bornholm er DK2). Den er **ikke kontrolleret** mod Energinets områdeinddeling eller den officielle postnummerliste. Før lancering bør den kontrolleres for øer og grænsetilfælde (fx Samsø, Læsø, Anholt, Sejerø) og erstattes af en opslagstabel fra DAGI, hvis der findes afvigelser.

## Sådan verificeres (første kørsel med netadgang)

1. Tillad værten `api.energidataservice.dk` i miljøets netværksindstillinger.
2. Kør `npm run analyse`. Går den igennem, er feltnavne, opløsning og tidszone bekræftet (parseren kaster ellers en tydelig fejl).
3. Kør en hentning (`/api/cron/hent-priser` med `CRON_SECRET`) og sammenhold nogle priser med Energinets egen side.
4. Kontrollér, at morgendagens døgn kommer med 96 kvarterer, og at skiftedøgn (29. marts og 25. oktober) giver 92 og 100.
