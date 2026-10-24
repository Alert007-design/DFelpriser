# Gennemgang af DF-priser og genbrug

DF-priser (repoet `dfpriser`, læst 23. oktober 2026) er en Next.js 16-app på Vercel med Supabase Postgres (direkte forbindelse via `postgres`, ikke supabase-js), Resend til mail, zod til validering og Vitest med PGlite til databasetests. Dets egen plan står i `docs/PLAN.md` dér.

## Genbrugt (kopieret og tilpasset)

| Komponent | Hvad |
|---|---|
| Databaseadgang | `lib/db`: tyndt `query`-interface, så alt testes mod PGlite med de rigtige migrationer |
| Double opt-in | token gemmes kun som hash, 72 timers frist, bekræftelse med knap (POST), så linkscannere ikke bekræfter |
| Samtykkebevis | versionerede, uforanderlige samtykketekster (trigger), formularen sender version og SHA-256 af den viste tekst, API'et afviser alt andet |
| Afmelding | signerede HMAC-links uden gemt token, `List-Unsubscribe` og one-click (RFC 8058), kun POST ændrer noget |
| Ingen dobbeltudsendelse | `udsendelseslog` med primærnøgle (person, dato) og `INSERT ... ON CONFLICT DO NOTHING`; kun rækker, kørslen selv fik, sendes; Resend-idempotensnøgle pr. portion |
| Spærre | `JURA_GODKENDT` og `TESTMODTAGERE`, håndhævet både ved tilmelding og udsendelse; testdata sendes aldrig til rigtige modtagere |
| Rate limit | pr. IP og pr. e-mail, gemt som HMAC |
| Cron | Vercel Cron med `CRON_SECRET`; handleren tjekker selv dansk tid |
| Visuel identitet | farver og logo, så mails og site ligner DF-priser |

## Bevidst anderledes

- **Eget Supabase-projekt og egen database.** Ingen delte tabeller, ingen import af DF-priser-abonnenter. En test sikrer, at ingen kode i dette repo refererer til DF-priser.
- **Intet navn og ingen telefon.** Dataminimering: kun e-mail og postnummer.
- ~~To adskilte samtykker~~ **Siden 24. oktober 2026 samme model som DF-priser:** ét obligatorisk samtykke, der dækker både elpriserne og politisk information. "STOP" stopper kun den daglige mail og bevarer samtykket; sletning sker kun på personens egen anmodning (siden `/slet` eller df@df.dk).
- **Udsendelse kl. 16 med ventetid.** DF-priser sender kl. 06.01 af data, der allerede ligger i databasen. Her afhænger udsendelsen af, at morgendagens priser er offentliggjort, og den venter, genprøver og dropper efter kl. 19.
- **Ingen Klaviyo-overførsel, ingen sms.**

## Ikke set

Vercel- og Supabase-projekternes faktiske indstillinger, planer, regioner og kontoejerskab er ikke kontrolleret; kun koden og dokumenterne i repoet er læst.
