/** »Send til en ven« i elpris-mailen (Morten 14/11-2026). `link` er de ord, der er klikbare. */
export const DEL_MAIL_TEKST = {
  foer: "Kender du nogen, der også gerne vil vide, hvornår strømmen er billigst? Så ",
  link: "tryk her",
  efter: " og send dem et link.",
} as const;

/** Emnet, når beskeden sendes som mail. */
export const DEL_EMNE = "Hvornår er strømmen billigst?";

/** Beskeden uden link (delingsmenuen sætter linket på selv). */
export const DEL_BESKED_TEKST =
  "Jeg får hver eftermiddag en mail om, hvornår strømmen er billigst i morgen. Det er en gratis service fra Dansk Folkeparti. Du kan tilmelde dig her:";

const ren = (base: string) => base.replace(/\/+$/, "");

/** Linket, vennen får. ?fra=del-el bruges kun til den anonyme optælling. */
export const delLink = (base: string) => `${ren(base)}?fra=del-el`;

/** Siden med knapperne. */
export const delSide = (base: string) => `${ren(base)}/del`;

export const delBesked = (base: string) => `${DEL_BESKED_TEKST} ${delLink(base)}`;
