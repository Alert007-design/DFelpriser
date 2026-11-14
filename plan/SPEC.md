# »Send til en ven« i elpris-mailen og måling af nye kilder

Godkendt af Morten 14/11-2026 (punkt 1 og 4).

- Elpris-mailen får en linje nederst i den hvide blok: »Kender du nogen, der også gerne vil vide,
  hvornår strømmen er billigst? Så tryk her og send dem et link.« Linket går til /el/del.
- /el/del viser beskeden, vennen får, og knapper til Facebook, mail, kopiering og telefonens egen delingsmenu.
- Vennen får linket dfpriser.dk/el?fra=del-el.
- Den anonyme optælling (kildetal) kender tre kilder: fb-el (Facebook), benzinmail (boksen i benzinmailen)
  og del-el (send til en ven). Kun antal pr. dag; intet om personen.
- Migration: udvider tabellen kildetal til de nye kilder. Skal køres i Supabase før udrulning;
  mangler den, tælles de nye kilder bare ikke.
