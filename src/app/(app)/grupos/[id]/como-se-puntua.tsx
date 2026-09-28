import { Card } from "@/components/ui/card";
import { BONUS_JORNADA_PERFECTA, PUNTOS_EXACTO, PUNTOS_SIGNO } from "@/lib/puntos-grupo";

const reglas = [
  {
    puntos: `+${PUNTOS_EXACTO}`,
    titulo: "Marcador exacto",
    detalle: "Acertás los goles de los dos equipos.",
  },
  {
    puntos: `+${PUNTOS_SIGNO}`,
    titulo: "Ganador o empate",
    detalle: "Acertás quién gana (o el empate), pero no el marcador.",
  },
  {
    puntos: `+${BONUS_JORNADA_PERFECTA}`,
    titulo: "Fecha perfecta",
    detalle: "Bonus si acertás el marcador exacto de todos los partidos de la fecha.",
  },
];

export function ComoSePuntua() {
  return (
    <Card className="flex flex-col gap-5 p-5 lg:p-7">
      <ul className="grid gap-4 sm:grid-cols-3">
        {reglas.map((regla) => (
          <li key={regla.titulo} className="flex items-start gap-3">
            <span className="flex h-10 min-w-10 items-center justify-center rounded-lg bg-pitch-900 px-2 font-mono text-sm font-bold tabular-nums text-lime-300">
              {regla.puntos}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">{regla.titulo}</p>
              <p className="text-xs leading-relaxed text-ink-600">{regla.detalle}</p>
            </div>
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-1.5 border-t border-line pt-4 text-xs leading-relaxed text-ink-600 lg:text-sm">
        <li>
          En el subgrupo compite <strong className="text-ink-900">un solo prode por fecha</strong>:
          el primero que cargás, o el que elijas en Pronósticos hasta el cierre. Así todos tienen
          la misma cantidad de chances.
        </li>
        <li>
          Tus otros prodes siguen jugando por el pozo de la liga. El subgrupo no reparte plata.
        </li>
        <li>
          Solo cuentan las fechas que cierran después de que te uniste, y los miembros con la
          suscripción inactiva quedan fuera del ranking.
        </li>
      </ul>
    </Card>
  );
}
