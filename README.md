# DF-Elpriser

Dansk, fuldautomatisk hjemmeside og dagligt nyhedsbrev, der viser, hvornår strømmen er billigst i morgen, og giver en prognose for de to følgende dage. En gratis service fra Dansk Folkeparti, bygget efter samme grundprincip som DF-priser.

**Status: bygget og testet med testdata, men ikke lanceret.** Intet er offentliggjort, tilmelding er spærret (`JURA_GODKENDT=nej`), og der er ikke sendt mails til rigtige modtagere. Se [docs/STATUS.md](docs/STATUS.md) for, hvad der er gjort, og hvad der mangler før lancering.

## Dokumentation

| Fil | Indhold |
|---|---|
| [docs/STATUS.md](docs/STATUS.md) | Hvad der er færdigt, hvad der ikke er verificeret, og hvad der kræver din beslutning |
| [docs/DF-PRISER.md](docs/DF-PRISER.md) | Gennemgang af DF-priser og hvad der er genbrugt |
| [docs/DATAKILDER.md](docs/DATAKILDER.md) | Datakilder, API'er, licens, netselskaber og tariffer |
| [docs/PROGNOSE.md](docs/PROGNOSE.md) | Prognosemodel, test og krav til offentliggørelse |
| [docs/GDPR.md](docs/GDPR.md) | Samtykke, politisk indhold, privatliv og juridiske spørgsmål |
| [docs/DRIFT.md](docs/DRIFT.md) | Opsætning, driftsomkostninger, fejlhåndtering og drift |

## Teknik

Next.js 16 på Vercel (fra1), Supabase Postgres, Resend, Vitest. Samme teknologier som DF-priser, men eget Supabase-projekt og egen database: ingen delte abonnentlister.

```
lib/pris/        enheder, døgnets fuldstændighed (92/96/100 kvarterer), billigste/dyreste tre timer
lib/kilder/      Energi Data Service-adapter (streng), testkilde (opdigtet, mærket TESTDATA)
lib/prognose/    prognosemodel, tilbageskuende test, usikkerhed, krav før visning
lib/udsendelse.ts  udsendelse kl. 16, forsinkelse, ingen dobbeltsendinger, logning
lib/tilmelding.ts  double opt-in, afmelding, sletning, skift af postnummer, adskilte samtykker
app/             hjemmeside, tilmelding, afmelding, admin
scripts/analyse.ts historisk analyse (kræver netadgang til Energi Data Service)
supabase/migrations/  databaseskema
```

## Kommandoer

```
npm test            tests (PGlite, ingen netværk)
npm run typecheck
npm run lint
npm run build
npm run analyse     historisk analyse af 120 dages priser -> docs/analyse-<dato>.md (kræver adgang til api.energidataservice.dk)
```

Lokalt: kopiér `.env.example` til `.env.local`. Uden `DATABASE_URL` og med `PRISKILDE=test` viser hjemmesiden opdigtede testpriser, tydeligt mærket "Testdata".
