import { grafPunkter, type Soejle } from "@/lib/mail/graf";
import { oere } from "@/lib/pris/format";
import type { Periode } from "@/lib/pris/typer";

/** Søjlediagram (SVG) over prisen pr. time. Billigste tre timer er grønne, dyreste røde. */
export function Prisgraf({ serie, billigste, dyreste, titel }: { serie: Soejle[]; billigste: Periode; dyreste: Periode; titel: string }) {
  const p = grafPunkter(serie);
  const n = serie.length;
  const i = (s: Soejle, per: Periode) => s.start >= per.start && s.start < per.slut;
  return (
    <figure style={{ margin: "12px 0" }}>
      <svg className="graf" viewBox={`0 0 ${n * 10} 100`} preserveAspectRatio="none" role="img" aria-label={titel}>
        {p.map((b, k) => (
          <rect
            key={k}
            x={k * 10 + 1}
            y={b.y}
            width={8}
            height={b.h}
            fill={i(serie[k], billigste) ? "#1f8a4c" : i(serie[k], dyreste) ? "#c9303f" : "#8a9bc0"}
          >
            <title>{`kl. ${new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", hour: "2-digit", hourCycle: "h23" }).format(serie[k].start)}: ${oere(serie[k].oerePrKwh)} øre/kWh`}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="forklaring">
        Pris pr. time i øre/kWh (spotpris før moms). Grøn: billigste tre timer. Rød: dyreste tre timer. Højeste time:{" "}
        {oere(Math.max(...serie.map((s) => s.oerePrKwh)))}, laveste time: {oere(Math.min(...serie.map((s) => s.oerePrKwh)))}.
      </figcaption>
    </figure>
  );
}
