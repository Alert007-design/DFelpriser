import { danskKlokkeslaet } from "../tid";
import type { Periode } from "../pris/typer";

export interface Soejle {
  start: Date;
  oerePrKwh: number;
}

const GROEN = "#1f8a4c";
const ROED = "#c9303f";
const GRAA = "#8a9bc0";
const HOEJDE = 90;

/**
 * Søjlediagram som HTML-tabel (virker i alle mailprogrammer, som ikke kører scripts eller viser SVG).
 * Én søjle pr. time. Billigste periode er grøn, dyreste rød. Søjlerne starter ved dagens laveste pris
 * (eller nul, hvis alle priser er positive); selve tallene står under diagrammet.
 */
export function grafHtml(serie: Soejle[], billigste: Periode, dyreste: Periode, font: string): string {
  const v = serie.map((s) => s.oerePrKwh);
  const lo = Math.min(0, ...v);
  const hi = Math.max(...v);
  const spænd = hi - lo || 1;
  const i = (s: Soejle, p: Periode) => s.start >= p.start && s.start < p.slut;
  const celler = serie
    .map((s) => {
      const h = Math.max(2, Math.round(((s.oerePrKwh - lo) / spænd) * HOEJDE));
      const farve = i(s, billigste) ? GROEN : i(s, dyreste) ? ROED : GRAA;
      return `<td valign="bottom" align="center" style="padding:0 1px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="${h}" bgcolor="${farve}" style="background-color:${farve};height:${h}px;font-size:1px;line-height:1px">&nbsp;</td></tr></table></td>`;
    })
    .join("");
  const timer = serie
    .map((s) => {
      const { time } = danskKlokkeslaet(s.start);
      return `<td align="center" style="${font};font-size:10px;color:#5a6788;padding-top:3px">${time % 3 === 0 ? String(time).padStart(2, "0") : ""}</td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed"><tr height="${HOEJDE}">${celler}</tr><tr>${timer}</tr></table>
<div style="${font};font-size:12px;line-height:18px;color:#5a6788;padding-top:8px"><span style="color:${GROEN}">&#9632;</span> Billigst &nbsp; <span style="color:${ROED}">&#9632;</span> Dyrest</div>`;
}

/** Samme graf som søjler til hjemmesiden (SVG), ud fra de samme tal. */
export function grafPunkter(serie: Soejle[]): { x: number; h: number; y: number }[] {
  const v = serie.map((s) => s.oerePrKwh);
  const lo = Math.min(0, ...v);
  const spænd = Math.max(...v) - lo || 1;
  return serie.map((s, n) => {
    const h = Math.max(1, ((s.oerePrKwh - lo) / spænd) * 100);
    return { x: n, h, y: 100 - h };
  });
}
