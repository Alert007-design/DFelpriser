# GDPR, samtykke og elektronisk markedsføring

**Status 24. oktober 2026:** Ejeren (selv jurist) har godkendt samtykkemodel, dataansvarlig enhed, retsgrundlag og databehandlere og besluttet, at DF-Elpriser følger samme model som DF-priser. Teksterne i `lib/samtykke.ts` og `app/privatlivspolitik` er de gældende. Tilmelding og udsendelse til rigtige modtagere åbnes med `JURA_GODKENDT=ja`.

## Hvad systemet gør

| Krav | Løsning |
|---|---|
| Frivilligt, klart samtykke | Ét afkrydsningsfelt, ikke forhåndsafkrydset. Samtykketeksten står ved feltet og nævner afsender, begge formål (elpriser og politisk information), hvilke oplysninger, at tilmeldingen kan vise politisk interesse, og tilbagetrækning |
| Dokumentation | Pr. person: version, ordlyd, tidspunkt givet, tidspunkt bekræftet (double opt-in) og tidspunkt for stop af den daglige mail. Teksterne er uforanderlige i databasen. Formularen sender version og SHA-256 af den viste tekst, og tilmeldingen afvises, hvis den ikke passer |
| Double opt-in | Mail med engangslink (72 timer, kun hash gemmes). Ubekræftede slettes automatisk |
| Stop af den daglige mail | Dominerende knap i hver mail (»STOP modtagelse af dette nyhedsbrev«) og one-click-header. Stopper kun den daglige mail; person og samtykke bevares, så politisk information fortsat må sendes. Tidspunktet registreres |
| Sletning | Kun på personens egen anmodning: mindre link i mailen til `/slet` med bekræftelsesknap, eller mail til df@df.dk. Fjerner alt (tilmelding, samtykke, udsendelseslog, ratebegrænsning) |
| Skift af postnummer | Link i hver mail |
| Dataminimering | Kun e-mail og postnummer (+ afledt elprisområde). Intet navn, ingen telefon, ingen sporingscookies |
| Adgangskontrol | Databasen nås kun fra serveren (RLS uden policies). Admin bag adgangskode og signeret cookie. Rate limit på tilmelding og login |
| Adskillelse | Eget Supabase-projekt. Ingen overførsel fra DF-priser, og ingen kode læser DF-priser (testet) |

## Samtykkemodellen

- **Elprissamtykke version 2** (gældende fra 24. oktober 2026) dækker både den daglige elprismail og information om Dansk Folkepartis politik og politiske udspil. Man kan ikke tilmelde sig det ene uden det andet.
- **Version 1 og det tidligere separate politiske samtykke** findes stadig i databasen som dokumentation for dem, der tilmeldte sig før omlægningen. De får kun politisk tekst, hvis de dengang satte kryds i det frivillige felt. Tilmelder de sig igen, får de version 2.
- **Den politiske tekst** leveres af Dansk Folkeparti (feltet `df_budskab_tekst` i tabellen `indstillinger`). Er feltet tomt, udelades afsnittet for alle.
- **Stop og sletning er to forskellige handlinger.** Stop (`elpris_aktiv = false`) bevarer samtykket. Sletning trækker samtykket tilbage og fjerner alt. Ingen slettes automatisk efter stop.

## Åbne punkter

1. Markedsføringsloven § 10 og det politiske udsendelsesformål (DF-priser' notat: loven gælder ikke nødvendigvis for et politisk parti, men samme standard bruges alligevel).
2. Art. 7, stk. 3: tilbagetrækning skal være lige så let som at give samtykket. Modellen gør stop let og sletning til et ekstra klik på en bekræftelsesside. Ejeren har vurderet og godkendt det.
3. Behandlingsfortegnelse (art. 30) og risikovurdering. Modellen findes i DF-priser (`docs/E-behandlingsfortegnelse.md`) og kan tilpasses.
4. Om der kræves konsekvensanalyse (DPIA) for behandling af oplysninger, der kan afsløre politisk holdning.
5. Hvordan politisk information sendes til dem, der har stoppet den daglige mail. I dag sendes politisk tekst kun i den daglige mail; en separat udsendelse eller eksport er ikke bygget.

## DF-priser-abonnenter

De må ikke overføres automatisk. Der findes ingen import, ingen delt database og ingen delte tokens. En DF-priser-abonnent skal aktivt tilmelde sig her og bekræfte via mail. Skal der sendes en invitation til dem, kræver det et eget retsgrundlag, som juristen skal vurdere. Det er ikke bygget.
