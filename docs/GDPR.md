# GDPR, samtykke og elektronisk markedsføring

**Dette er et teknisk og fagligt udkast, ikke juridisk rådgivning.** Tilmelding og udsendelse er spærret (`JURA_GODKENDT=nej`), til en jurist har godkendt punkterne nedenfor. Teksterne i `lib/samtykke.ts` og `app/privatlivspolitik` er udkast.

## Hvad systemet gør

| Krav | Løsning |
|---|---|
| Frivilligt, klart samtykke | Ingen forhåndsafkrydsede felter. Samtykketeksten står ved afkrydsningsfeltet og nævner afsender, formål, hvilke oplysninger, at tilmeldingen kan vise politisk interesse, og tilbagetrækning |
| Dokumentation | Pr. person og samtykke: version, ordlyd, tidspunkt givet, tidspunkt bekræftet (double opt-in) og tidspunkt trukket tilbage. Teksterne er uforanderlige i databasen. Formularen sender version og SHA-256 af den viste tekst, og tilmeldingen afvises, hvis den ikke passer |
| Double opt-in | Mail med engangslink (72 timer, kun hash gemmes). Ubekræftede slettes automatisk |
| Afmelding | Link i hver mail og one-click-header. Trækker samtykkerne tilbage med tidspunkt. Separat link til kun at stoppe politisk information |
| Sletning | `Slet mine oplysninger` på afmeldingssiden fjerner alt (tilmelding, samtykker, udsendelseslog) |
| Skift af postnummer | Link i hver mail |
| Dataminimering | Kun e-mail og postnummer (+ afledt elprisområde). Intet navn, ingen telefon, ingen sporingscookies |
| Adgangskontrol | Databasen nås kun fra serveren (RLS uden policies). Admin bag adgangskode og signeret cookie. Rate limit på tilmelding og login |
| Adskillelse | Eget Supabase-projekt. Ingen overførsel fra DF-priser, og ingen kode læser DF-priser (testet) |

## Politisk indhold og samtykke: designvalg

Spørgsmålet "må nyhedsbrevet indeholde politiske budskaber under det samme samtykke?" kan ikke afgøres af mig. Jeg har derfor bygget den mest forsigtige løsning, som også virker, hvis juristen kommer til en mildere konklusion:

- **To adskilte, ikke forhåndsafkrydsede samtykker:** (1) elprisnyhedsbrevet (påkrævet), (2) politisk information i samme mail (frivilligt).
- **Politisk tekst sendes kun til dem, der har givet samtykke 2.** Teksten leveres af Dansk Folkeparti (feltet `df_budskab_tekst` i tabellen `indstillinger`); jeg har ikke skrevet noget politisk indhold. Er feltet tomt, udelades afsnittet for alle.
- Samtykke 2 kan trækkes tilbage alene via et link i mailen.
- Begge samtykketekster nævner, at tilmeldingen kan være en oplysning om politisk interesse. Begge nævner det, fordi en mail fra et politisk parti kan afsløre politisk tilhørsforhold, også uden politisk indhold (art. 9). Juristen skal tage stilling til, om det er nødvendigt og tilstrækkeligt.

Hvis juristen vurderer, at ét samtykke er nok, kan formularen forenkles. Hvis juristen vurderer, at selv elpriserne kræver mere, kan teksterne skærpes. Begge dele er en ny migration og en ny version, ikke en ombygning.

## Spørgsmål til jurist før lancering

1. Rigtig dataansvarlig enhed (jeg har overtaget "Dansk Folkeparti Landsorganisationen, CVR 20857390" fra DF-priser' dokumenter; ikke kontrolleret her).
2. Retsgrundlag og samtykketekster, herunder art. 9 og om to samtykker er den rigtige konstruktion.
3. Markedsføringsloven § 10 og det politiske udsendelsesformål (DF-priser' notat mener, at loven ikke nødvendigvis gælder for et politisk parti, men at samme standard bruges alligevel).
4. Hvor længe oplysninger om afmeldte må og bør gemmes som dokumentation. Standard i koden er 365 dage (`AFMELDT_OPBEVARING_DAGE`); det er et gæt, ikke en anbefaling.
5. Databehandleraftaler med Supabase, Resend og Vercel, placering af data i EU og tredjelandsoverførsler. Teksten i privatlivspolitikken har pladsholdere.
6. Behandlingsfortegnelse (art. 30) og risikovurdering. Modellen findes i DF-priser (`docs/E-behandlingsfortegnelse.md`) og kan tilpasses.
7. Om der kræves konsekvensanalyse (DPIA) for behandling af oplysninger, der kan afsløre politisk holdning.

## DF-priser-abonnenter

De må ikke overføres automatisk. Der findes ingen import, ingen delt database og ingen delte tokens. En DF-priser-abonnent skal aktivt tilmelde sig her og bekræfte via mail. Skal der sendes en invitation til dem, kræver det et eget retsgrundlag, som juristen skal vurdere. Det er ikke bygget.
