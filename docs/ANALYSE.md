# Analyse af spotpriser og prognose

Kørt 23. oktober 2026 mod den rigtige tjeneste (`api.energidataservice.dk`, datasættet `DayAheadPrices`, kvartersopløsning). Parseren (`lib/kilder/energidataservice.ts`) peger på `DayAheadPrices`, og felterne `TimeUTC`, `PriceArea` og `DayAheadPriceDKK` er bekræftet i det rigtige svar.

Datasættet dækker hele perioden **1. oktober 2025 til 22. oktober 2026**: 387 døgn, og alle er fuldstændige for både DK1 og DK2 (inklusive sommertidsskiftene, 26. oktober 2025 og 29. marts 2026). Vinteren er **1. december 2025 til 28. februar 2026** (90 døgn). Priserne er spotpriser i øre/kWh før moms, afgifter og tariffer; besparelserne er teoretiske og bygger kun på spotprisen.

Gentag med:

```
npm run analyse -- 2025-10-01 2026-10-22                         # hele perioden
npm run analyse -- 2025-10-01 2026-10-22 2025-12-01 2026-02-28   # vinteren alene
```

I vinterkørslen måles kun på dagene 1. december–28. februar, men modellen må bruge priserne fra oktober og november som historik, præcis som den ville i drift. De hentede priser ligger i `data/cache/`.

# Hele perioden (1. oktober 2025 – 22. oktober 2026)


## DK1

1. **Skift af billigste tretimersperiode fra dag til dag:** starttidspunktet er et andet i 90 % af dagene, og perioden ligger helt uden overlap med gårsdagens i 23 %.
2. **Forskel mellem dagens dyreste og billigste periode (øre/kWh):** gennemsnit 87,2, median 82,3, 10-90 %: 29,2 til 141,3, mindst 3,1, mest 451,5.
4. **Teoretisk besparelse pr. dag ved at flytte forbrug fra dyreste til billigste periode (kr):**

| Flyttet forbrug | Gennemsnit | Median | 10 % | 90 % |
|---|---|---|---|---|
| 5 kWh | 4,36 | 4,11 | 1,46 | 7,07 |
| 10 kWh | 8,72 | 8,23 | 2,92 | 14,13 |
| 20 kWh | 17,44 | 16,45 | 5,84 | 28,27 |

5. **Prognosens præcision** (tilbageskuende test, kun data kendt på det tidspunkt):

| Metode | Dage | Fejl dagsgns. (øre) | Fejl pr. time (øre) | Fortrydelse billigste vindue (øre) | Træf billigste vindue (≥2 af 3 timer) |
|---|---|---|---|---|---|
| Dag 2: model | 358 | 17,9 | 22,4 | 3,3 | 75 % |
| Dag 2: gentag sidste dag | 358 | 19,8 | 23,5 | 4,8 | 65 % |
| Dag 2: samme ugedag sidste uge | 358 | 27,1 | 30,1 | 4,8 | 64 % |
| Dag 3: model | 357 | 22,1 | 26,3 | 3,4 | 74 % |
| Dag 3: gentag sidste dag | 357 | 26,0 | 29,8 | 4,8 | 64 % |
| Dag 3: samme ugedag sidste uge | 357 | 27,1 | 30,2 | 4,8 | 64 % |

Prognosen må vises (dag 2): ja – modellen slår begge enkle metoder. Dag 3: ja – modellen slår begge enkle metoder.

## DK2

1. **Skift af billigste tretimersperiode fra dag til dag:** starttidspunktet er et andet i 89 % af dagene, og perioden ligger helt uden overlap med gårsdagens i 25 %.
2. **Forskel mellem dagens dyreste og billigste periode (øre/kWh):** gennemsnit 90,9, median 85,1, 10-90 %: 34,7 til 143,2, mindst 3,0, mest 443,5.
4. **Teoretisk besparelse pr. dag ved at flytte forbrug fra dyreste til billigste periode (kr):**

| Flyttet forbrug | Gennemsnit | Median | 10 % | 90 % |
|---|---|---|---|---|
| 5 kWh | 4,55 | 4,25 | 1,74 | 7,16 |
| 10 kWh | 9,09 | 8,51 | 3,47 | 14,32 |
| 20 kWh | 18,18 | 17,02 | 6,95 | 28,64 |

5. **Prognosens præcision** (tilbageskuende test, kun data kendt på det tidspunkt):

| Metode | Dage | Fejl dagsgns. (øre) | Fejl pr. time (øre) | Fortrydelse billigste vindue (øre) | Træf billigste vindue (≥2 af 3 timer) |
|---|---|---|---|---|---|
| Dag 2: model | 358 | 18,9 | 23,8 | 4,3 | 74 % |
| Dag 2: gentag sidste dag | 358 | 20,4 | 25,0 | 6,1 | 62 % |
| Dag 2: samme ugedag sidste uge | 358 | 28,1 | 31,6 | 5,6 | 63 % |
| Dag 3: model | 357 | 23,4 | 27,9 | 4,3 | 74 % |
| Dag 3: gentag sidste dag | 357 | 27,6 | 31,9 | 5,9 | 63 % |
| Dag 3: samme ugedag sidste uge | 357 | 28,1 | 31,6 | 5,6 | 63 % |

Prognosen må vises (dag 2): ja – modellen slår begge enkle metoder. Dag 3: ja – modellen slår begge enkle metoder.

## DK1 mod DK2

3. På 387 fælles døgn har DK1 og DK2 et forskelligt starttidspunkt for billigste tretimersperiode i 38 % af dagene, og perioderne har slet ingen overlap i 5 %.

# Vintermånederne alene (1. december 2025 – 28. februar 2026)


## DK1

1. **Skift af billigste tretimersperiode fra dag til dag:** starttidspunktet er et andet i 98 % af dagene, og perioden ligger helt uden overlap med gårsdagens i 45 %.
2. **Forskel mellem dagens dyreste og billigste periode (øre/kWh):** gennemsnit 41,2, median 34,5, 10-90 %: 23,5 til 66,0, mindst 10,5, mest 135,9.
4. **Teoretisk besparelse pr. dag ved at flytte forbrug fra dyreste til billigste periode (kr):**

| Flyttet forbrug | Gennemsnit | Median | 10 % | 90 % |
|---|---|---|---|---|
| 5 kWh | 2,06 | 1,72 | 1,17 | 3,30 |
| 10 kWh | 4,12 | 3,45 | 2,35 | 6,60 |
| 20 kWh | 8,23 | 6,89 | 4,70 | 13,20 |

5. **Prognosens præcision** (tilbageskuende test, kun data kendt på det tidspunkt):

| Metode | Dage | Fejl dagsgns. (øre) | Fejl pr. time (øre) | Fortrydelse billigste vindue (øre) | Træf billigste vindue (≥2 af 3 timer) |
|---|---|---|---|---|---|
| Dag 2: model | 89 | 12,4 | 14,9 | 2,7 | 61 % |
| Dag 2: gentag sidste dag | 89 | 14,2 | 17,1 | 6,1 | 36 % |
| Dag 2: samme ugedag sidste uge | 89 | 20,0 | 21,8 | 5,7 | 35 % |
| Dag 3: model | 88 | 16,1 | 17,6 | 2,7 | 60 % |
| Dag 3: gentag sidste dag | 88 | 19,2 | 21,1 | 7,0 | 35 % |
| Dag 3: samme ugedag sidste uge | 88 | 19,1 | 21,0 | 5,8 | 34 % |

Prognosen må vises (dag 2): ja – modellen slår begge enkle metoder. Dag 3: ja – modellen slår begge enkle metoder.

## DK2

1. **Skift af billigste tretimersperiode fra dag til dag:** starttidspunktet er et andet i 92 % af dagene, og perioden ligger helt uden overlap med gårsdagens i 40 %.
2. **Forskel mellem dagens dyreste og billigste periode (øre/kWh):** gennemsnit 56,2, median 42,2, 10-90 %: 26,7 til 92,7, mindst 15,6, mest 259,7.
4. **Teoretisk besparelse pr. dag ved at flytte forbrug fra dyreste til billigste periode (kr):**

| Flyttet forbrug | Gennemsnit | Median | 10 % | 90 % |
|---|---|---|---|---|
| 5 kWh | 2,81 | 2,11 | 1,33 | 4,64 |
| 10 kWh | 5,62 | 4,22 | 2,67 | 9,27 |
| 20 kWh | 11,24 | 8,44 | 5,33 | 18,54 |

5. **Prognosens præcision** (tilbageskuende test, kun data kendt på det tidspunkt):

| Metode | Dage | Fejl dagsgns. (øre) | Fejl pr. time (øre) | Fortrydelse billigste vindue (øre) | Træf billigste vindue (≥2 af 3 timer) |
|---|---|---|---|---|---|
| Dag 2: model | 89 | 15,4 | 18,5 | 2,6 | 70 % |
| Dag 2: gentag sidste dag | 89 | 16,9 | 20,8 | 6,1 | 42 % |
| Dag 2: samme ugedag sidste uge | 89 | 23,1 | 25,9 | 5,7 | 45 % |
| Dag 3: model | 88 | 19,1 | 21,6 | 2,7 | 69 % |
| Dag 3: gentag sidste dag | 88 | 23,1 | 26,3 | 7,8 | 33 % |
| Dag 3: samme ugedag sidste uge | 88 | 22,1 | 25,0 | 5,7 | 44 % |

Prognosen må vises (dag 2): ja – modellen slår begge enkle metoder. Dag 3: ja – modellen slår begge enkle metoder.

## DK1 mod DK2

3. På 90 fælles døgn har DK1 og DK2 et forskelligt starttidspunkt for billigste tretimersperiode i 43 % af dagene, og perioderne har slet ingen overlap i 9 %.

# Vurdering af prognosen

## Består modellen kravene (mindst 45 dage, mindst 5 % bedre end begge enkle metoder)?

**Ja, i alle otte kombinationer** (to områder × to horisonter × hele perioden og vinteren alene). Antal målte dage er 357-358 for hele perioden og 88-89 for vinteren, langt over 45. Forbedringen i forhold til den bedste af de to enkle metoder, målt som mindre fejl på dagens gennemsnitspris og mindre fortrydelse ved billigste vindue:

| | Fejl på dagsgennemsnit | Fortrydelse billigste vindue |
|---|---|---|
| **Hele perioden** | | |
| DK1 dag 2 | 17,9 mod 19,8 øre (−10 %) | 3,3 mod 4,8 øre (−31 %) |
| DK1 dag 3 | 22,1 mod 26,0 øre (−15 %) | 3,4 mod 4,8 øre (−29 %) |
| DK2 dag 2 | 18,9 mod 20,4 øre (−7 %) | 4,3 mod 5,6 øre (−23 %) |
| DK2 dag 3 | 23,4 mod 27,6 øre (−15 %) | 4,3 mod 5,6 øre (−23 %) |
| **Vinteren alene** | | |
| DK1 dag 2 | 12,4 mod 14,2 øre (−13 %) | 2,7 mod 5,7 øre (−53 %) |
| DK1 dag 3 | 16,1 mod 19,1 øre (−16 %) | 2,7 mod 5,8 øre (−53 %) |
| DK2 dag 2 | 15,4 mod 16,9 øre (−9 %) | 2,6 mod 5,7 øre (−54 %) |
| DK2 dag 3 | 19,1 mod 22,1 øre (−14 %) | 2,7 mod 5,7 øre (−53 %) |

Den knappeste margen er DK2 dag 2 på hele perioden (−7 % på dagsgennemsnittet), som stadig er over de 5 %. Det er den kombination, der først vil falde igennem, hvis forholdene ændrer sig.

## Hvad tallene siger

- **Billigste tidsrum:** Det er her, modellen er klart bedst. Fortrydelsen er 2,6-4,3 øre/kWh mod 4,8-7,8 for de enkle metoder. Om vinteren rammer modellen billigste tretimersperiode (mindst 2 af 3 timer) på 60-70 % af dagene, mod 33-45 % for de enkle metoder; på hele perioden er det 74-75 %, mod 62-65 %. Hitraten er altså lavere om vinteren, fordi billigste periode skifter mere (starttidspunktet ændrer sig 92-98 % af vinterdagene), men modellen står relativt bedre sammenlignet med alternativerne.
- **Niveauet:** Fejlen på dagens gennemsnitspris er 12-23 øre/kWh. Forbedringen i forhold til "gentag sidste dag" er moderat (7-16 %). Prognosen er god til at pege på *hvornår* på døgnet, mindre god til *hvor dyrt* det bliver.
- **Størrelsen af fejlen i forhold til gevinsten:** Om vinteren er den typiske forskel mellem dyreste og billigste periode mindre (41 øre i DK1 og 56 øre i DK2 i gennemsnit, 34 og 42 i median) end i resten af året (87-91 øre på hele perioden). Fejlen pr. time (15-22 øre) er derfor stor i forhold til gevinsten: ca. 0,36 i DK1 og 0,33 i DK2 (dag 2), og dermed stadig inden for ordmærket "lav" (under 0,5), men tættere på grænsen end på hele perioden. Den teoretiske besparelse ved at flytte 10 kWh er ca. 4-6 kr/dag om vinteren mod ca. 9 kr/dag over hele perioden.
- **Dag 3 er dårligere end dag 2** (fejl 16-23 mod 12-19 øre), som man må forvente.
- **Udsving:** Enkelte dage har meget store prisforskelle (op til ca. 450 øre/kWh mellem dyreste og billigste periode på hele perioden, ca. 136-260 om vinteren). Dem forudsiger modellen ikke, og et gennemsnit skjuler dem.

## Forbehold

1. **Kun én vinter** (2025/26). At modellen består på denne ene vinter, viser ikke, at den gør det i en anden, fx en usædvanlig kold og vindstille vinter. Der er ingen test af netop de perioder, hvor priserne er mest ekstreme, ud over det der tilfældigt indgik.
2. **Dagene er ikke uafhængige.** Modellen bruger de seneste dage som grundlag, så nabodage ligner hinanden. De 90 vinterdage er derfor færre rigtige prøver, end tallet antyder, og der er ikke beregnet usikkerhed på forskellene mellem metoderne.
3. **Kravene er stadig mine forslag** (45 dage, 5 %), ikke godkendt af Dansk Folkeparti. De siger intet om, hvor præcis prognosen er i forhold til hvad en kunde har brug for, kun at den slår to enkle metoder.
4. **Kun spotpris.** Der er ingen nettariffer (som ofte er højere i spidsbelastning), afgifter eller moms. Den faktiske besparelse for en husholdning er ikke målt, og forbrug kan ikke altid flyttes.
5. **Ingen vejr- eller vinddata** i modellen.

## Konklusion

Modellen `profil-v1` opfylder de foreslåede krav for DK1 og DK2, for dag 2 og dag 3, både over hele perioden og i vintermånederne alene. Prognosen kan derfor vises som en *vejledende forventning om hvornår på døgnet strømmen er billigst*, med de usikkerhedsangivelser, der er beskrevet i `docs/PROGNOSE.md`. Den må ikke fremstilles som en sikker pris eller en garanteret billigste dag. Den automatiske spærre, der kører kravet ved hver udsendelse, bør blive stående. Kravene bør godkendes, og analysen køres igen, når der er en ny vinter at måle på.
