-- DF-Elpriser: grundskema. Egen database, logisk og fysisk adskilt fra DF-priser (intet delt, ingen import
-- af abonnenter). Kun serveren tilgår databasen (direkte Postgres-forbindelse). RLS er slået til uden
-- policies, så Supabase' offentlige API (anon-nøglen) ikke kan læse noget.

create table samtykketekster (
  type                 text not null check (type in ('elpris', 'politik')),
  version              integer not null,
  tekst                text not null,
  privatlivspolitik_url text,
  gyldig_fra           timestamptz not null default now(),
  primary key (type, version)
);

create or replace function samtykketekster_laast() returns trigger
language plpgsql as $$
begin
  raise exception 'Samtykketekster kan ikke ændres eller slettes. Opret en ny version.';
end;
$$;
create trigger samtykketekster_laast
  before update or delete on samtykketekster
  for each row execute function samtykketekster_laast();

create table tilmeldte (
  id                    uuid primary key default gen_random_uuid(),
  email                 text not null unique,
  postnummer            text not null check (postnummer ~ '^[0-9]{4}$'),
  omraade               text not null check (omraade in ('DK1', 'DK2')),
  status                text not null default 'afventer' check (status in ('afventer', 'aktiv', 'afmeldt')),
  test                  boolean not null default false,
  oprettet              timestamptz not null default now(),
  bekraeftet_tidspunkt  timestamptz,
  afmeldt_tidspunkt     timestamptz,
  bekraeft_token_hash   text unique
);
create index tilmeldte_aktive on tilmeldte (omraade) where status = 'aktiv';

-- Ét samtykke pr. type pr. person. Beviset: hvilken version og ordlyd, hvornår givet, hvornår bekræftet
-- (double opt-in), og hvornår trukket tilbage.
create table samtykker (
  id            bigint generated always as identity primary key,
  tilmeldt_id   uuid not null references tilmeldte(id) on delete cascade,
  type          text not null,
  version       integer not null,
  ordlyd        text not null,
  givet         timestamptz not null,
  bekraeftet    timestamptz,
  status        text not null default 'afventer' check (status in ('afventer', 'aktiv', 'tilbagekaldt')),
  tilbagekaldt  timestamptz,
  foreign key (type, version) references samtykketekster(type, version),
  check ((status = 'tilbagekaldt') = (tilbagekaldt is not null)),
  check (status <> 'aktiv' or bekraeftet is not null)
);
create unique index samtykker_et_pr_type on samtykker (tilmeldt_id, type);

-- Spotpriser pr. interval. Kun det, der er hentet fra en kilde; aldrig beregnede eller opdigtede værdier.
create table spotpriser (
  omraade     text not null check (omraade in ('DK1', 'DK2')),
  start_utc   timestamptz not null,
  minutter    integer not null check (minutter in (15, 60)),
  oere_kwh    double precision not null,
  kilde       text not null,
  hentet      timestamptz not null default now(),
  primary key (omraade, start_utc)
);

-- Logføring af alle hentninger fra datakilder.
create table hentelog (
  id         bigint generated always as identity primary key,
  tidspunkt  timestamptz not null default now(),
  kilde      text not null,
  omraade    text,
  fra_dato   date,
  til_dato   date,
  status     text not null check (status in ('ok', 'fejl', 'ufuldstaendig')),
  antal      integer not null default 0,
  besked     text
);
create index hentelog_tid on hentelog (tidspunkt desc);

-- Gemte prognoser, så de kan sammenlignes med de faktiske priser bagefter.
create table prognoser (
  omraade       text not null check (omraade in ('DK1', 'DK2')),
  for_dato      date not null,
  kendt_til     date not null,
  model_version text not null,
  genereret     timestamptz not null default now(),
  data          jsonb not null,
  primary key (omraade, for_dato, kendt_til)
);

create table indstillinger (
  noegle  text primary key,
  vaerdi  text not null
);
-- Politisk tekst i mailen leveres og godkendes af Dansk Folkeparti. Tom = afsnittet udelades.
insert into indstillinger (noegle, vaerdi) values ('df_budskab_tekst', '');

-- Én række pr. dag pr. område; fungerer som lås og status.
create table udsendelser (
  dato        date not null,
  omraade     text not null check (omraade in ('DK1', 'DK2')),
  status      text not null default 'i_gang'
              check (status in ('i_gang', 'afventer_priser', 'faerdig', 'droppet', 'stoppet')),
  startet     timestamptz not null default now(),
  afsluttet   timestamptz,
  sendt       integer not null default 0,
  fejlet      integer not null default 0,
  prognose    boolean not null default false,
  note        text,
  primary key (dato, omraade)
);

create table udsendelseslog (
  tilmeldt_id  uuid not null references tilmeldte(id) on delete cascade,
  dato         date not null,
  status       text not null default 'reserveret' check (status in ('reserveret', 'sendt', 'fejlet')),
  resend_id    text,
  opdateret    timestamptz not null default now(),
  primary key (tilmeldt_id, dato)
);

-- Driftslog: fejl, forsinkelser og vigtige hændelser.
create table driftslog (
  id         bigint generated always as identity primary key,
  tidspunkt  timestamptz not null default now(),
  niveau     text not null check (niveau in ('info', 'advarsel', 'fejl')),
  kilde      text not null,
  besked     text not null
);
create index driftslog_tid on driftslog (tidspunkt desc);

create table ratebegraensning (
  noegle    text not null,
  tidspunkt timestamptz not null default now()
);
create index ratebegraensning_idx on ratebegraensning (noegle, tidspunkt);

alter table samtykketekster enable row level security;
alter table tilmeldte enable row level security;
alter table samtykker enable row level security;
alter table spotpriser enable row level security;
alter table hentelog enable row level security;
alter table prognoser enable row level security;
alter table indstillinger enable row level security;
alter table udsendelser enable row level security;
alter table udsendelseslog enable row level security;
alter table driftslog enable row level security;
alter table ratebegraensning enable row level security;

-- Samtykketekster version 1. UDKAST TIL JURIDISK GODKENDELSE (se docs/GDPR.md). Skal være ordret ens med
-- konstanterne i lib/samtykke.ts (en test kontrollerer det).
insert into samtykketekster (type, version, tekst, privatlivspolitik_url) values
('elpris', 1,
'Ja tak. Jeg vil hver dag kl. 16 modtage en e-mail fra Dansk Folkeparti med morgendagens elpriser og en prognose for de to følgende dage i mit elprisområde. Jeg giver udtrykkeligt samtykke til, at Dansk Folkeparti behandler min e-mailadresse og mit postnummer til dette formål. Min tilmelding kan være en oplysning om politisk interesse. Jeg kan til enhver tid trække mit samtykke tilbage via afmeldingslinket i e-mailen. Læs privatlivspolitikken.',
'/privatlivspolitik'),
('politik', 1,
'Ja tak. Jeg vil også gerne have information om Dansk Folkepartis politik og politiske udspil i den daglige e-mail. Jeg giver udtrykkeligt samtykke til, at Dansk Folkeparti behandler min e-mailadresse og mit postnummer til dette formål. Min tilmelding kan være en oplysning om politisk interesse. Jeg kan til enhver tid trække dette samtykke tilbage, uden at det afmelder elpriserne.',
'/privatlivspolitik');
