# Status 24. oktober 2026

## Siden 23. oktober

- **Samtykke og afmelding følger nu DF-priser-modellen** (besluttet af ejeren 24/10): ét obligatorisk samtykke (version 2), der dækker både elpriser og politisk information. »STOP« i mailen stopper kun den daglige mail og bevarer samtykket; sletning sker kun på personens egen anmodning via `/slet` eller df@df.dk. Ingen automatisk sletning efter stop. Se [GDPR.md](GDPR.md).
- **Ejeren har godkendt** dataansvarlig enhed, retsgrundlag, databehandlere og privatlivspolitik. Markeringerne »[skal bekræftes]« er fjernet.
- **Domæne:** dfelpriser.dk peger på Vercel (A-post og www-CNAME hos Dandomain) og er verificeret som afsenderdomæne i Resend (DKIM, SPF via CNAME, DMARC). `MAIL_FROM=DF-Elpriser <nyhedsbrev@dfelpriser.dk>` og `APP_URL=https://dfelpriser.dk` er sat i Vercel.
- **Første rigtige testudsendelse** gik ud 23/10 kl. 16.00 til testmodtageren med rigtige priser, prognose og forbehold.

## Lanceret 24. oktober 2026 kl. 14.45

Ejeren har åbnet tjenesten: `JURA_GODKENDT=ja` (alle kan tilmelde sig og modtage mails) og `OFFENTLIG=ja` (søgemaskiner må indeksere) er sat i Vercel.

## Mangler efter lancering

1. Politisk tekst i feltet `df_budskab_tekst` (leveres af Dansk Folkeparti).
2. Beslutning om prognosen om vinteren (60–70 % træfsikkerhed mod 89–91 % ellers): vis med tydelig usikkerhed, eller skjul i vintermånederne.
3. En måde at sende politisk information til dem, der har stoppet den daglige mail (ikke bygget; i dag kun i den daglige mail).

---

# Status 23. oktober 2026 (opdateret efter live-test mod Energi Data Service)

## Kort

Tjenesten er **bygget og testet med testdata**, og prisparseren er nu **prøvet live mod Energi Data Service** (`DayAheadPrices`): 387 døgn fra 1. oktober 2025 til 22. oktober 2026 er hentet og tolket uden fejl, og felter, opløsning og tidszone er bekræftet. Tjenesten er **ikke lanceret**, og der er endnu ikke hentet *næste døgns* priser via cron-ruten.

Den historiske analyse er kørt for hele perioden og for vintermånederne alene, se [ANALYSE.md](ANALYSE.md). Prognosemodellen `profil-v1` består de godkendte krav (45 dage, 5 %) for DK1 og DK2, dag 2 og dag 3, både over hele perioden og i vinteren 2025/26 alene. Den er god til at udpege døgnets billigste tidsrum, men upræcis på selve prisniveauet, og der er kun målt på én vinter.

## Hvad er gjort (efter opgavens rækkefølge)

1. **DF-priser undersøgt:** se [DF-PRISER.md](DF-PRISER.md). Databasetilgang, double opt-in, samtykkebevis, afmelding, udsendelseslås, spærre og cron er genbrugt.
2. **Datakilder:** se [DATAKILDER.md](DATAKILDER.md). Energi Data Service er prøvet live og bekræftet; øvrige kilder (tariffer, afgifter, vejr) er ikke prøvet.
3. **Historisk analyse:** scriptet `npm run analyse` er kørt mod rigtige priser og producerer alle fem målinger fra punkt 8, for hele perioden og for en delperiode (fx vinteren). Resultaterne står i [ANALYSE.md](ANALYSE.md). De hentede priser ligger i `data/cache/`.
4. **Hjemmeside, tilmelding, skabeloner:** færdige. Hjemmesiden viser kendte priser pr. område uden tilmelding, tilmelding med ét samtykke og double opt-in, stop af den daglige mail, sletning, skift af postnummer, privatlivspolitik, metodeside og admin.
5. **Prisberegning, prognose, udsendelse:** færdige, se [PROGNOSE.md](PROGNOSE.md) og [DRIFT.md](DRIFT.md).
6. **Test:** 72 automatiske tests, inklusive DK1/DK2, sommertid (92/96/100 kvarterer), forsinkede og ufuldstændige priser, dobbeltudsendelse, testdata-spærre, spærre før jura, stop uden sletning og politisk indhold kun med dækkende samtykke.
7. **Dokumentation:** drift, omkostninger, fejlhåndtering og GDPR er skrevet.

## Hvad kræver din beslutning eller handling

1. **Jurist:** [GDPR.md](GDPR.md) har listen. Intet er aktiveret.
2. **Politisk tekst:** feltet er tomt, indtil Dansk Folkeparti leverer teksten.
3. **Opsætning** af Supabase, Resend, Vercel og domæne: [DRIFT.md](DRIFT.md).

## Kendte begrænsninger

- Ingen nettariffer, afgifter, moms eller øvrige priselementer (kun spotpris, tydeligt mærket). Netselskab kan ikke afgøres ud fra postnummer.
- Postnummer til elprisområde er regelbaseret og skal kontrolleres.
- Prognosemodellen bruger ingen vejrdata.
- Nyhedsbrevets HTML er kontrolleret i en browser på mobilbredde, men ikke i rigtige mailprogrammer (Gmail, Outlook, Apple Mail).
- Danske helligdage i prognosemodellen dækker de faste fridage, ikke fx 24. og 31. december.
