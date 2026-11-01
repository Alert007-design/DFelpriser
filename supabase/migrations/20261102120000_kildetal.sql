-- Anonym optaelling af besoeg og tilmeldinger fra Facebook-linket /el?fra=fb-el (planen står i PLAN-facebook.md i benzinprisprojektets pull request 53).
--
-- Kun antal pr. dag (dansk dato), kilde og type. Ingen oplysninger om personer. Migrationen er additiv og roerer
-- ikke `tilmeldte`. Koer den i Supabase FOER den nye kode udrulles; mangler tabellen, taelles der bare ikke.

begin;

create table if not exists kildetal (
  dato   date not null,
  kilde  text not null check (kilde in ('fb-el')),
  type   text not null check (type in ('besoeg', 'tilmelding')),
  antal  integer not null default 0 check (antal >= 0),
  primary key (dato, kilde, type)
);

-- Som de oevrige tabeller: kun serveren (direkte databaseforbindelse) maa laese og skrive.
alter table kildetal enable row level security;

commit;
