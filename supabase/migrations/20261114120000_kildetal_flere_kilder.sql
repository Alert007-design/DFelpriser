-- Anonym optaelling ogsaa for boksen i benzinmailen (benzinmail) og »send til en ven« i elpris-mailen (del-el).
-- Kun antal pr. dag. Koer den i Supabase FOER den nye kode udrulles; mangler den, taelles de nye kilder bare ikke.

begin;

alter table kildetal drop constraint if exists kildetal_kilde_check;
alter table kildetal add constraint kildetal_kilde_check check (kilde in ('fb-el', 'benzinmail', 'del-el'));

commit;
