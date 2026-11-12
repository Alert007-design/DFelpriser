-- Navn på tilmeldingen (godkendt af Morten 12/11-2026), så Dansk Folkeparti kan skrive "Kære <navn>" i Klaviyo.
--
--  * `fornavn` og `efternavn` på den tilmeldte. Tomme (null) for dem, der tilmeldte sig før ændringen.
--  * Samtykke version 3 nævner navnet. Version 1 og 2 bevares uændret som dokumentation.
--
-- Additiv. Kan køres i Supabase (SQL Editor), mens den nuværende kode kører: den bruger fortsat version 2,
-- indtil koden med navnefelterne er ude.

begin;

alter table tilmeldte
  add column if not exists fornavn   text check (fornavn is null or char_length(fornavn) between 1 and 60),
  add column if not exists efternavn text check (efternavn is null or char_length(efternavn) between 1 and 60);

insert into samtykketekster (type, version, tekst, privatlivspolitik_url)
select 'elpris', 3,
'Ja tak. Jeg vil hver dag kl. 16 modtage en e-mail fra Dansk Folkeparti med morgendagens elpriser og en prognose for de to følgende dage i mit elprisområde samt information om Dansk Folkepartis politik og politiske udspil. Jeg giver udtrykkeligt samtykke til, at Dansk Folkeparti behandler mit navn, min e-mailadresse og mit postnummer til disse formål. Min tilmelding kan være en oplysning om politisk interesse. Jeg kan til enhver tid trække mit samtykke tilbage via afmeldingslinket i e-mailen. Læs privatlivspolitikken.',
'/privatlivspolitik'
where not exists (select 1 from samtykketekster where type = 'elpris' and version = 3);

commit;
