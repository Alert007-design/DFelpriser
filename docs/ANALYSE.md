# Analyse af spotpriser og prognose

Kørt 23. oktober 2026 med `npm run analyse -- 120` mod den rigtige tjeneste (`api.energidataservice.dk`, datasættet `DayAheadPrices`, kvartersopløsning). Perioden er 25. juni til 22. oktober 2026: 120 fuldstændige døgn for både DK1 og DK2. Parseren (`lib/kilder/energidataservice.ts`) pegede allerede på `DayAheadPrices`, og felterne `TimeUTC`, `PriceArea` og `DayAheadPriceDKK` er bekræftet i det rigtige svar. Der er ikke ændret i parseren.

Priserne er spotpriser i øre/kWh før moms, afgifter og tariffer. Besparelserne er teoretiske og bygger kun på spotprisen. Nedenfor følger rapportens tal uændret (de fem målinger fra kvalitetssikringen), derefter min vurdering.


## DK1

1. **Skift af billigste tretimersperiode fra dag til dag:** starttidspunktet er et andet i 88 % af dagene, og perioden ligger helt uden overlap med gårsdagens i 6 %.
2. **Forskel mellem dagens dyreste og billigste periode (øre/kWh):** gennemsnit 119,3, median 118,1, 10-90 %: 58,3 til 160,1, mindst 30,8, mest 309,2.
4. **Teoretisk besparelse pr. dag ved at flytte forbrug fra dyreste til billigste periode (kr):**

| Flyttet forbrug | Gennemsnit | Median | 10 % | 90 % |
|---|---|---|---|---|
| 5 kWh | 5,97 | 5,90 | 2,91 | 8,01 |
| 10 kWh | 11,93 | 11,81 | 5,83 | 16,01 |
| 20 kWh | 23,86 | 23,62 | 11,65 | 32,02 |

5. **Prognosens præcision** (tilbageskuende test, kun data kendt på det tidspunkt):

| Metode | Dage | Fejl dagsgns. (øre) | Fejl pr. time (øre) | Fortrydelse billigste vindue (øre) | Træf billigste vindue (≥2 af 3 timer) |
|---|---|---|---|---|---|
| Dag 2: model | 91 | 23,0 | 27,9 | 1,3 | 90 % |
| Dag 2: gentag sidste dag | 91 | 25,5 | 29,9 | 3,1 | 82 % |
| Dag 2: samme ugedag sidste uge | 91 | 34,5 | 38,1 | 3,3 | 85 % |
| Dag 3: model | 90 | 27,4 | 32,7 | 1,4 | 91 % |
| Dag 3: gentag sidste dag | 90 | 33,1 | 38,2 | 3,6 | 80 % |
| Dag 3: samme ugedag sidste uge | 90 | 34,8 | 38,3 | 3,3 | 84 % |

Prognosen må vises (dag 2): ja – modellen slår begge enkle metoder. Dag 3: ja – modellen slår begge enkle metoder.

## DK2

1. **Skift af billigste tretimersperiode fra dag til dag:** starttidspunktet er et andet i 91 % af dagene, og perioden ligger helt uden overlap med gårsdagens i 11 %.
2. **Forskel mellem dagens dyreste og billigste periode (øre/kWh):** gennemsnit 118,8, median 115,7, 10-90 %: 60,2 til 166,2, mindst 41,0, mest 298,5.
4. **Teoretisk besparelse pr. dag ved at flytte forbrug fra dyreste til billigste periode (kr):**

| Flyttet forbrug | Gennemsnit | Median | 10 % | 90 % |
|---|---|---|---|---|
| 5 kWh | 5,94 | 5,79 | 3,01 | 8,31 |
| 10 kWh | 11,88 | 11,57 | 6,02 | 16,62 |
| 20 kWh | 23,77 | 23,15 | 12,03 | 33,24 |

5. **Prognosens præcision** (tilbageskuende test, kun data kendt på det tidspunkt):

| Metode | Dage | Fejl dagsgns. (øre) | Fejl pr. time (øre) | Fortrydelse billigste vindue (øre) | Træf billigste vindue (≥2 af 3 timer) |
|---|---|---|---|---|---|
| Dag 2: model | 91 | 22,4 | 27,4 | 1,5 | 89 % |
| Dag 2: gentag sidste dag | 91 | 24,5 | 29,2 | 4,9 | 79 % |
| Dag 2: samme ugedag sidste uge | 91 | 33,6 | 37,0 | 3,9 | 79 % |
| Dag 3: model | 90 | 27,3 | 32,5 | 1,6 | 89 % |
| Dag 3: gentag sidste dag | 90 | 33,2 | 38,1 | 5,5 | 82 % |
| Dag 3: samme ugedag sidste uge | 90 | 33,9 | 37,2 | 3,8 | 79 % |

Prognosen må vises (dag 2): ja – modellen slår begge enkle metoder. Dag 3: ja – modellen slår begge enkle metoder.

## DK1 mod DK2

3. På 120 fælles døgn har DK1 og DK2 et forskelligt starttidspunkt for billigste tretimersperiode i 36 % af dagene, og perioderne har slet ingen overlap i 3 %.

## Vurdering af prognosen

**Resultat:** På disse 120 dage består modellen `profil-v1` kravene i `docs/PROGNOSE.md` for både DK1 og DK2 og begge horisonter (dag 2 og dag 3). Den har over 45 målte dage (90-91), mindst 5 % lavere fejl på dagens gennemsnitspris end begge enkle metoder og mindst 5 % lavere fortrydelse. Den mindste margen på gennemsnitsfejlen er DK2 dag 2: 22,4 mod 24,5 øre, altså ca. 9 % lavere.

**Hvad det betyder i praksis:**

- Modellen rammer billigste tretimersperiode nogenlunde: 89-91 % af dagene er mindst 2 af 3 timer rigtige. Fortrydelsen er kun 1,3-1,6 øre/kWh mod 3-5 øre for de enkle metoder.
- Niveauet er derimod usikkert: fejlen på dagens gennemsnit er 22-27 øre/kWh, og fejlen pr. time er 27-33 øre. Det er stort i forhold til en typisk daglig forskel mellem dyreste og billigste periode på ca. 119 øre. Prognosen duer til at pege på *hvornår* på døgnet det er billigst, men ikke til at love en bestemt pris eller en bestemt billigste dag.
- Dag 3 er dårligere end dag 2 (fejl 27 mod 22-23 øre), som man må forvente.

**Forbehold, så tallene ikke læses for pænt:**

1. Kun 4 måneder (sommer til efterår 2026). Der er ingen vinter, ingen jul, ingen ekstreme kuldeperioder. Resultatet kan ikke uden videre overføres til resten af året.
2. 90-91 dage er målt, ikke 120, fordi modellen skal bruge de første ca. 28 dage som historik. Dagene overlapper i modellens historik, så de er ikke uafhængige prøver.
3. Forskellen til de enkle metoder er moderat (ca. 9-17 % på gennemsnitsfejlen), og kravene (45 dage, 5 %) er stadig mine forslag, ikke godkendt. Der er ingen konfidensberegning på forskellen.
4. Billigste-vindue-målingerne sammenligner med faktiske priser samme dag, men siger intet om, hvad der kan lade sig gøre i en husholdning (fx hvornår vaskemaskinen kan køre).
5. Modellen bruger ingen vejr- eller vinddata, og besparelserne er kun spotpris, ikke hvad en kunde faktisk sparer på regningen.

**Konklusion:** Prognosen kan med rimelig ret vises som en vejledende forventning om døgnets form (billigste tidsrum), forudsat at mailen tydeligt skriver, at niveauet er usikkert, og at intervallerne vises som i `PROGNOSE.md`. Den bør ikke markedsføres som en træfsikker pris, og den automatiske spærre (kravet køres ved hver udsendelse) bør blive stående, så prognosen udelades, hvis modellen engang ikke slår de enkle metoder. Kravene skal stadig godkendes af Dansk Folkeparti, og analysen bør køres igen, når der er data fra vinteren.
