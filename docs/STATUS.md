# Status 23. oktober 2026 (opdateret efter live-test mod Energi Data Service)

## Kort

Tjenesten er **bygget og testet med testdata**, og prisparseren er nu **prøvet live mod Energi Data Service** (`DayAheadPrices`): 387 døgn fra 1. oktober 2025 til 22. oktober 2026 er hentet og tolket uden fejl, og felter, opløsning og tidszone er bekræftet. Tjenesten er **ikke lanceret**, og der er endnu ikke hentet *næste døgns* priser via cron-ruten.

Den historiske analyse er kørt for hele perioden og for vintermånederne alene, se [ANALYSE.md](ANALYSE.md). Prognosemodellen `profil-v1` består de foreslåede krav (45 dage, 5 %) for DK1 og DK2, dag 2 og dag 3, både over hele perioden og i vinteren 2025/26 alene. Den er god til at udpege døgnets billigste tidsrum, men upræcis på selve prisniveauet, og der er kun målt på én vinter.

## Hvad er gjort (efter opgavens rækkefølge)

1. **DF-priser undersøgt:** se [DF-PRISER.md](DF-PRISER.md). Databasetilgang, double opt-in, samtykkebevis, afmelding, udsendelseslås, spærre og cron er genbrugt.
2. **Datakilder:** se [DATAKILDER.md](DATAKILDER.md). Energi Data Service er prøvet live og bekræftet; øvrige kilder (tariffer, afgifter, vejr) er ikke prøvet.
3. **Historisk analyse:** scriptet `npm run analyse` er kørt mod rigtige priser og producerer alle fem målinger fra punkt 8, for hele perioden og for en delperiode (fx vinteren). Resultaterne står i [ANALYSE.md](ANALYSE.md). De hentede priser ligger i `data/cache/`.
4. **Hjemmeside, tilmelding, skabeloner:** færdige. Hjemmesiden viser kendte priser pr. område uden tilmelding, tilmelding med to adskilte samtykker og double opt-in, afmelding, sletning, skift af postnummer, privatlivspolitik (udkast), metodeside og admin.
5. **Prisberegning, prognose, udsendelse:** færdige, se [PROGNOSE.md](PROGNOSE.md) og [DRIFT.md](DRIFT.md).
6. **Test:** 71 automatiske tests, inklusive DK1/DK2, sommertid (92/96/100 kvarterer), forsinkede og ufuldstændige priser, dobbeltudsendelse, testdata-spærre, spærre før jura og politisk indhold kun med samtykke.
7. **Dokumentation:** drift, omkostninger, fejlhåndtering og GDPR er skrevet.

## Hvad kræver din beslutning eller handling

1. **Kravene til prognosen** (45 dage, 5 %): mine forslag, skal godkendes. Analysen viser, at modellen består dem, men se forbeholdene i [ANALYSE.md](ANALYSE.md).
2. **Jurist:** [GDPR.md](GDPR.md) har listen. Intet er aktiveret.
3. **Politisk tekst:** feltet er tomt, indtil Dansk Folkeparti leverer teksten.
4. **Opsætning** af Supabase, Resend, Vercel og domæne: [DRIFT.md](DRIFT.md).

## Kendte begrænsninger

- Ingen nettariffer, afgifter, moms eller øvrige priselementer (kun spotpris, tydeligt mærket). Netselskab kan ikke afgøres ud fra postnummer.
- Postnummer til elprisområde er regelbaseret og skal kontrolleres.
- Prognosemodellen bruger ingen vejrdata.
- Nyhedsbrevets HTML er kontrolleret i en browser på mobilbredde, men ikke i rigtige mailprogrammer (Gmail, Outlook, Apple Mail).
- Danske helligdage i prognosemodellen dækker de faste fridage, ikke fx 24. og 31. december.
