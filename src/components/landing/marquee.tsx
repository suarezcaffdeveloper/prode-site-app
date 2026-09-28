import { BarChart3, Bell, Layers, Repeat, Target, Timer, Trophy } from "lucide-react";

const ITEMS = [
  { icono: Target, texto: "Marcador exacto" },
  { icono: Trophy, texto: "Pozo por fecha" },
  { icono: Repeat, texto: "Pozo acumulable" },
  { icono: Layers, texto: "Subgrupos con tus amigos" },
  { icono: BarChart3, texto: "Estadísticas de cada equipo" },
  { icono: Timer, texto: "Cierre 30 minutos antes del primer partido" },
  { icono: Bell, texto: "Aviso por email a los ganadores" },
];

function Pista({ oculta = false }: { oculta?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={oculta || undefined}>
      {ITEMS.map(({ icono: Icono, texto }) => (
        <li
          key={texto}
          className="flex items-center gap-3 whitespace-nowrap px-8 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-chalk-100/80"
        >
          <Icono className="h-4 w-4 text-lime-400" aria-hidden="true" />
          {texto}
          <span className="ml-8 h-1.5 w-1.5 rotate-45 bg-lime-400/60" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}

export function Marquee() {
  return (
    <div className="group relative overflow-hidden border-y border-chalk-0/10 bg-pitch-900 py-5">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        <Pista />
        <Pista oculta />
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-pitch-900 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-pitch-900 to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}
