-- Overførsel til Dansk Folkepartis Klaviyo (godkendt af Morten 9/11-2026).
--
--  * `klaviyo_overfoert` er tidspunktet, personen blev overført. Null = ikke overført.
--  * `klaviyo_fejlet` er tidspunktet for seneste mislykkede forsøg. Oprydningen prøver igen hver time.
--
-- Additiv. Påvirker hverken tilmelding, udsendelse eller sletning. Kør den i Supabase (SQL Editor), før
-- KLAVIYO_API_KEY og KLAVIYO_LIST_ID sættes i Vercel.

begin;

alter table tilmeldte
  add column if not exists klaviyo_overfoert timestamptz,
  add column if not exists klaviyo_fejlet    timestamptz;

commit;
