# Elpriser til Dansk Folkepartis Klaviyo

Skrevet 9/11-2026 efter ønske fra DF's kommunikationsafdeling (Leah) og godkendt i princippet af Morten samme dag.
Afventer Mortens godkendelse af denne specifikation, før der skrives kode.

## Hvad funktionen skal kunne

Når en person har bekræftet sin tilmelding til elpriserne, sendes personen til Dansk Folkepartis Klaviyo, ligesom
dfpriser.dk/benzin allerede gør. Kun disse oplysninger sendes:

- e-mailadressen,
- postnummeret, både i Klaviyos felt Location og i feltet "Zipcode",
- "EL priser" i feltet "Pris emne".

"Pris emne" er en liste. Har personen også tilmeldt sig benzinpriserne, skal der stå både "Benzin priser" og
"EL priser". Ingen af de to tjenester må fjerne den andens værdi. Derfor skal også dfpriser.dk/benzin rettes, så den
lægger sin værdi til i stedet for at overskrive (lille ændring i det andet projekt).

## Hvem der overføres

Kun personer, der har bekræftet deres tilmelding, har et aktivt samtykke (version 2 eller nyere) og har tilmeldt sig
på eller efter den dag, hvor den nye privatlivspolitik kommer på siden. Dem, der tilmeldte sig før, overføres ikke,
fordi den gamle politik lovede, at intet blev overført. Testtilmeldinger overføres aldrig.

## Hvad der sker ved

- **Bekræftelse:** personen overføres med det samme. Fejler Klaviyo, gennemføres bekræftelsen alligevel, og
  overførslen prøves igen hver time af den eksisterende oprydning.
- **Stop af den daglige mail:** intet i Klaviyo. Samtykket til politisk information gælder fortsat (samme model som
  benzinpriserne).
- **Skift af postnummer:** det nye postnummer sendes til Klaviyo.
- **Sletning (siden /slet):** "EL priser" fjernes fra "Pris emne", og personen fjernes fra listen, medmindre der
  også står "Benzin priser". Selve Klaviyo-profilen slettes ikke af koden, fordi den kan stamme fra andre DF-tjenester.
  Sletningen i elpris-systemet gennemføres altid, også hvis Klaviyo fejler. Fejlen logges uden e-mailadresse.

## Opsætning, som Morten skal lave (med klik-for-klik-vejledning)

1. Køre én ny databaseændring (migration) i elprisernes Supabase: to nye kolonner, der husker, hvornår personen er
   overført, og om det fejlede.
2. Sætte KLAVIYO_API_KEY og KLAVIYO_LIST_ID i elprisernes Vercel-projekt (samme værdier som i dfpriser-projektet).
   Uden dem er overførslen slået fra, og alt virker som i dag.

## Hvad der kan gå galt

- Klaviyo er nede eller afviser: tilmelding, stop, skift og sletning virker stadig. Overførslen prøves igen hver time.
- To tjenester skriver "Pris emne" samtidig: den ene kan i sjældne tilfælde overskrive den anden. Begge læser feltet
  lige før de skriver, så vinduet er under et sekund.
- Forkert nøgle: alle kald fejler og logges; ingen data går tabt hos os.

## Persondata og automatik

Ja, funktionen sender persondata (e-mail og postnummer) til DF's Klaviyo. Den sender ingen mails selv, men gør det
muligt for DF at sende politisk information, som samtykket dækker. Privatlivspolitikken (pull request #19) flettes
samtidig med koden, og datoen i den sættes til udrulningsdagen.

## Åbent spørgsmål

Skal elfolkene på samme Klaviyo-liste som benzinfolkene? Anbefaling: ja, og så skelner Leah med "Pris emne".
