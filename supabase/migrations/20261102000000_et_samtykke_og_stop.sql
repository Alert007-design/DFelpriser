-- Ét samtykke og stop uden sletning (besluttet af ejeren 24. oktober 2026, samme model som DF's
-- brændstofpris-tjeneste).
--
--  * Elprissamtykket version 2 dækker både den daglige mail og politisk information. Version 1 og
--    det separate politiske samtykke bevares uændret som dokumentation for eksisterende tilmeldte.
--  * `elpris_aktiv = false` betyder, at den daglige mail er stoppet. Personen og samtykket bevares,
--    så politisk information fortsat må sendes. `elpris_stoppet` er tidspunktet for stoppet.
--  * Sletning af alt sker kun på personens udtrykkelige anmodning (siden /slet eller df@df.dk).
--
-- Migrationen er additiv: alle eksisterende rækker får elpris_aktiv = true.

insert into samtykketekster (type, version, tekst, privatlivspolitik_url) values
('elpris', 2,
'Ja tak. Jeg vil hver dag kl. 16 modtage en e-mail fra Dansk Folkeparti med morgendagens elpriser og en prognose for de to følgende dage i mit elprisområde samt information om Dansk Folkepartis politik og politiske udspil. Jeg giver udtrykkeligt samtykke til, at Dansk Folkeparti behandler min e-mailadresse og mit postnummer til disse formål. Min tilmelding kan være en oplysning om politisk interesse. Jeg kan til enhver tid trække mit samtykke tilbage via afmeldingslinket i e-mailen. Læs privatlivspolitikken.',
'/privatlivspolitik');

alter table tilmeldte
  add column elpris_aktiv   boolean not null default true,
  add column elpris_stoppet timestamptz,
  add constraint tilmeldte_elpris_stoppet_tjek check (elpris_aktiv = (elpris_stoppet is null));

drop index if exists tilmeldte_aktive;
create index tilmeldte_aktive on tilmeldte (omraade) where status = 'aktiv' and elpris_aktiv;
