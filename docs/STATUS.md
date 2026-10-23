# Status 23. oktober 2026

## Kort

Tjenesten er **bygget og testet med testdata**, men **ikke kørt mod rigtige priser** og **ikke lanceret**. Det vigtigste, jeg ikke har kunnet gøre, var at nå Energi Data Service fra udviklingsmiljøet: værten `api.energidataservice.dk` er blokeret af miljøets netværksregler. Derfor findes der **ingen historisk analyse og ingen dokumenteret træfsikkerhed for prognosen**. Jeg har ikke opfundet nogen af delene.

## Hvad er gjort (efter opgavens rækkefølge)

1. **DF-priser undersøgt:** se [DF-PRISER.md](DF-PRISER.md). Databasetilgang, double opt-in, samtykkebevis, afmelding, udsendelseslås, spærre og cron er genbrugt.
2. **Datakilder:** undersøgt via åbne kilder, se [DATAKILDER.md](DATAKILDER.md). Ikke prøvet live.
3. **Historisk analyse:** scriptet `npm run analyse` er bygget og testet på testdata og producerer alle fem målinger fra punkt 8. **Rapporten er ikke produceret**, fordi der ikke er adgang til priser.
4. **Hjemmeside, tilmelding, skabeloner:** færdige. Hjemmesiden viser kendte priser pr. område uden tilmelding, tilmelding med to adskilte samtykker og double opt-in, afmelding, sletning, skift af postnummer, privatlivspolitik (udkast), metodeside og admin.
5. **Prisberegning, prognose, udsendelse:** færdige, se [PROGNOSE.md](PROGNOSE.md) og [DRIFT.md](DRIFT.md).
6. **Test:** 71 automatiske tests, inklusive DK1/DK2, sommertid (92/96/100 kvarterer), forsinkede og ufuldstændige priser, dobbeltudsendelse, testdata-spærre, spærre før jura og politisk indhold kun med samtykke.
7. **Dokumentation:** drift, omkostninger, fejlhåndtering og GDPR er skrevet.

## Hvad kræver din beslutning eller handling

1. **Netadgang:** tillad `api.energidataservice.dk` i miljøets netværksindstillinger (cloud-miljøet, Edit, Network access), så jeg kan køre analysen og afprøve kilden. Uden den kan jeg ikke afgøre, om prognosen kan offentliggøres.
2. **Jurist:** [GDPR.md](GDPR.md) har listen. Intet er aktiveret.
3. **Politisk tekst:** feltet er tomt, indtil Dansk Folkeparti leverer teksten.
4. **Kravene til prognosen** (45 dage, 5 %): mine forslag, skal godkendes.
5. **Opsætning** af Supabase, Resend, Vercel og domæne: [DRIFT.md](DRIFT.md).

## Kendte begrænsninger

- Ingen nettariffer, afgifter, moms eller øvrige priselementer (kun spotpris, tydeligt mærket). Netselskab kan ikke afgøres ud fra postnummer.
- Postnummer til elprisområde er regelbaseret og skal kontrolleres.
- Prognosemodellen bruger ingen vejrdata.
- Nyhedsbrevets HTML er kontrolleret i en browser på mobilbredde, men ikke i rigtige mailprogrammer (Gmail, Outlook, Apple Mail).
- Danske helligdage i prognosemodellen dækker de faste fridage, ikke fx 24. og 31. december.
