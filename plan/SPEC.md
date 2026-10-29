# Kortere mail med reference og weekendfelt

Godkendt af Morten 29/10-2026 ud fra udkastet (billede med fredagens priser).

## Hvad mailen skal kunne

1. Morgendagens billigste og dyreste tretimersperiode i to kasser, som nu, og grafen over døgnet.
2. En lille tabel »Sammenlignet med de seneste dage«: laveste, højeste og gennemsnit for i går, i dag og i
   morgen (øre/kWh, kun spotpris). En dag uden fuldstændige data udelades. Kendte priser, ingen gæt.
3. Et felt for de to følgende dage, som altid er med:
   - Har prognosemodellen bestået sin test: én linje pr. dag med forventet billigste tidsrum og forventet
     gennemsnit, mærket som et bud og ikke kendte priser, samt usikkerheden. Peger prognosen sikkert på én
     af de tre dage som billigst, står det i én linje.
   - Har modellen ikke bestået: »Vi har ingen sikker prognose for de to dage i dag.« plus, når der er mindst
     7 fuldstændige dage, hvornår strømmen i gennemsnit har været billigst og dyrest de seneste 14 dage
     (historiske tal, ikke en prognose).
4. Partiets tekst og STOP-knappen som nu. Forbeholdet om nettarif, elafgift, moms m.m. står stadig i hver
   mail, kortet ned til én linje.

## Det fjernes fra mailen

Indledningen om kendte priser og prognoser, »Dagens råd«, regneeksemplet med 10 kWh, linjen med døgnets
gennemsnit og forskel (står nu i tabellen) og bølgebilledet. Tekstudgaven følger samme indhold.

## Ikke omfattet

Hjemmesiden ændres ikke. Prognosemodellen og dens krav ændres ikke.

## Filer

- `lib/pris/reference.ts` (ny): typiske billige og dyre tidsrum ud fra de seneste 14 dage.
- `lib/mail/skabeloner.ts`: ny opbygning af dagsmailen.
- `lib/udsendelse.ts`: henter i går og i dag og de typiske tidsrum og giver dem til mailen.
- `scripts/rendermail.ts`: eksempeldata til det nye felt.
- `test/reference.test.ts` (ny) og `test/udsendelse.test.ts`.

## Risiko

Rører ved den mail, der sendes automatisk til rigtige modtagere. Ingen ændring af tilmelding, samtykke,
afmelding eller persondata. Flettes først efter Mortens ja til en prøve. Fejler beregningen af de nye
dele, sendes mailen uden dem (som prognosen i dag).
