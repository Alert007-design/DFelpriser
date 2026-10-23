# Prognosemodel for dag 2 og dag 3

## Model `profil-v1` (kun prishistorik)

Ved udsendelsen kl. 16 kender vi priserne til og med i morgen (K). Prognosen gælder K+1 (dag 2) og K+2 (dag 3). Modellen arbejder på 24 lokale timer pr. dag (kvarterer samles; sommer- og vintertid jævnes ud).

- **Niveau:** halvdelen af seneste kendte dags gennemsnit plus halvdelen af de seneste 7 dages gennemsnit.
- **Døgnets form:** gennemsnit over de seneste 28 dage af samme type (hverdag, eller fridag = weekend og danske helligdage) af timeprisens afvigelse fra dagens gennemsnit.
- **Prognose** = niveau + form. Modellen bruger kun data, der var kendt på tidspunktet (en test beviser, at ændringer i "fremtiden" ikke påvirker prognosen).
- Uden mindst 21 dages historik, 7 sammenhængende seneste dage og 3 dage af samme type returneres ingenting.

Metoden er bevidst enkel, fordi den kan testes ærligt uden vejrdata. Den kender ikke vind og sol, som er den vigtigste driver af prisudsving fra dag til dag, så den forventes at have begrænset præcision. Det er derfor, der er et adgangskrav (nedenfor).

## Usikkerhed

For hver visning beregnes modellens fejl de seneste 60 dage ved at køre den, som den ville have kørt dengang. Heraf:

- 80 %-interval for dagens gennemsnitspris (10. og 90. percentil af fejlen), og
- den afvigelse pr. time, som 90 % af de seneste timer holdt sig inden for.

Mailen siger det i klart sprog ("I 8 ud af 10 af modellens seneste prognoser lå ..."), plus et ordmærke: *lav*, *middel* eller *høj*, afgjort af forholdet mellem timeafvigelsen og den forventede forskel mellem døgnets dyreste og billigste tre timer (under 0,5: lav, under 1: middel, ellers høj).

**Billigste dag af de tre:** udpeges kun, hvis den billigste dags øvre grænse ligger under alle andres nedre grænse. Ellers står der, at det er for tæt til at sige. Kendt pris har ingen usikkerhed.

## Krav før en prognose vises (forslag til godkendelse)

Ved hver udsendelse køres en tilbageskuende test på de seneste 90 dage for begge horisonter. Prognosen vises kun, hvis modellen **for begge** horisonter:

1. har mindst 45 målte dage,
2. har mindst 5 % lavere fejl på dagens gennemsnitspris end begge enkle metoder ("gentag seneste kendte dag" og "samme ugedag sidste uge"), og
3. har mindst 5 % lavere "fortrydelse" (hvor meget dyrere det faktisk blev at bruge strøm i det forudsagte billigste vindue end i det faktisk billigste) end begge.

Ellers udelades prognosen, og mailen siger det. Alt logges i driftsloggen, og de udsendte prognoser gemmes i tabellen `prognoser`, så admin kan sammenligne dem med de faktiske priser.

Tallene 45 dage og 5 % er mine forslag, ikke et dokumenteret standardkrav. De skal godkendes eller ændres (`KRAV` i `lib/prognose/evaluering.ts`).

## Hvad der er testet, og hvad der ikke er

- **Testet:** mekanikken (ingen kig ind i fremtiden, ingen prognose ved for lidt data, kravet slår til og fra korrekt, usikkerhedsintervaller, vurdering af billigste dag) med opdigtede data i `test/prognose.test.ts` og `test/udsendelse.test.ts`.
- **Ikke gjort:** test mod rigtige priser. Der var ingen adgang til dem. **Der findes derfor ingen dokumenteret træfsikkerhed for modellen.** Det er ikke gætværk, men et åbent punkt: kør `npm run analyse` (lister punkt 5 i opgaven) med netadgang. Hvis modellen ikke består kravet, vises ingen prognose, og tjenesten er stadig nyttig med de kendte priser.
- **Næste skridt med netadgang:** tilføj vindprognose (`Forecasts_Hour`) som forklarende variabel, test igen, og lad kun den bedste model komme igennem kravet.
