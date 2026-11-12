# Navn på elpris-tilmeldingen

Godkendt af Morten 12/11-2026. Baggrund: DF's kommunikationsafdeling (Leah) får ikke navne med fra elpriserne
i Klaviyo og kan derfor ikke skrive "Kære <navn>". Benzinpriserne sender allerede fornavn og efternavn.

## Hvad funktionen skal kunne

1. Formularen på dfpriser.dk/el får felterne "Fornavn" og "Efternavn" før e-mail, som på benzinsiden. Begge
   skal udfyldes. Mellemrum i enderne fjernes, flere mellemrum i træk bliver til ét, højst 60 tegn pr. felt.
2. Elpris-databasen gemmer fornavn og efternavn på den tilmeldte.
3. Samtykketeksten nævner navnet: ny version 3, hvor "min e-mailadresse og mit postnummer" bliver til
   "mit navn, min e-mailadresse og mit postnummer". Resten af teksten er uændret. Version 1 og 2 bevares.
4. Overførslen til Klaviyo sender fornavn (first_name) og efternavn (last_name), når de findes. Mangler navnet
   (tilmeldt før ændringen), sendes navnefelterne slet ikke, så et navn fra fx benzinpriserne ikke overskrives.
5. Sletning: Når "Pris emne" bliver tom, og Zipcode og listen fjernes, fjernes også fornavn og efternavn.
   Står der stadig "Benzin priser", røres navnet ikke.
6. Privatlivspolitikken for elpriser rettes, så den siger, at vi indsamler navn og sender det til Klaviyo, og
   at navnet slettes sammen med resten. "Vi beder ikke om dit navn" udgår.
7. Allerede tilmeldte får ikke navn. De står fortsat uden navn i Klaviyo, medmindre navnet findes fra en
   anden DF-tjeneste.

## Udrulning uden nedetid (to trin)

Formularen viser samtykketeksten fra koden, men serveren sammenligner med den nyeste tekst i databasen. Kører
man databaseændringen før eller efter den nye kode, afvises alle tilmeldinger i de minutter, der går imellem.
Derfor:

- Trin A (PR 1): Serveren tjekker den version, formularen viste: den skal findes i databasen med samme tekst
  og være den version, koden selv viser. Ingen synlig ændring.
- Morten kører migrationen i Supabase (nye kolonner og samtykke version 3). Trin A-koden viser stadig
  version 2 og virker videre.
- Trin B (PR 2): navnefelter, version 3, Klaviyo, privatlivspolitik.

## Berører

Tilmelding, samtykke, persondata, privatlivspolitik og overførsel til Klaviyo. Intet flettes uden Mortens ja.
