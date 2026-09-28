import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import { MarcadorPartido, MarcadorResultado } from "@/components/ui/marcador";
import { Reveal } from "@/components/landing/reveal";
import { formatearFechaPartido } from "@/lib/fecha-partido";

export type PartidoInicio = {
  id: string;
  fecha_hora: string | null;
  goles_local: number | null;
  goles_visitante: number | null;
  estado: "pendiente" | "finalizado";
  equipo_local: { nombre: string; escudo_url: string | null };
  equipo_visitante: { nombre: string; escudo_url: string | null };
};

export function InicioPartidos({
  ligaId,
  jornada,
  partidos,
}: {
  ligaId: string;
  jornada: number;
  partidos: PartidoInicio[];
}) {
  return (
    <section className="flex flex-col gap-3 lg:gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            FECHA {jornada}
          </p>
          <h2 className="font-display text-xl font-bold tracking-tight text-ink-900 lg:text-2xl">
            Partidos de la jornada
          </h2>
        </div>
        <Link
          href={`/ligas/${ligaId}/partidos`}
          className="shrink-0 text-sm font-medium text-pitch-700 hover:underline"
        >
          Fixture completo →
        </Link>
      </div>

      {/* Mobile: una sola tarjeta con filas. Escritorio: una tarjeta por partido. */}
      <Card className="divide-y divide-line lg:grid lg:grid-cols-2 lg:gap-4 lg:divide-y-0 lg:border-0 lg:bg-transparent lg:shadow-none">
        {partidos.map((partido, indice) => (
          <Reveal
            key={partido.id}
            soloEscritorio
            variante="scale"
            retraso={(indice % 2) * 80 + Math.floor(indice / 2) * 60}
            className="lg:h-full"
          >
            <div className="group flex flex-col gap-2 px-4 py-3.5 transition-all lg:h-full lg:gap-5 lg:rounded-2xl lg:border lg:border-line lg:bg-chalk-0 lg:p-6 lg:shadow-[0_1px_2px_rgba(16,36,26,0.04)] lg:hover:-translate-y-1 lg:hover:border-pitch-500 lg:hover:shadow-[0_16px_36px_rgba(16,36,26,0.10)]">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400 lg:text-[11px]">
                  {partido.estado === "finalizado" ? "Final" : formatearFechaPartido(partido.fecha_hora)}
                </p>
                <span className="hidden lg:inline-flex">
                  <MarcadorPartido estado={partido.estado} />
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 lg:gap-4">
                <div className="flex min-w-0 items-center justify-end gap-2 lg:flex-col-reverse lg:justify-center lg:gap-3">
                  <p className="min-w-0 flex-1 truncate text-right text-sm font-medium text-ink-900 lg:line-clamp-2 lg:w-full lg:flex-none lg:whitespace-normal lg:text-center lg:text-base lg:leading-tight">
                    {partido.equipo_local.nombre}
                  </p>
                  <Escudo
                    url={partido.equipo_local.escudo_url}
                    nombre={partido.equipo_local.nombre}
                    className="h-7 w-7 text-[11px] transition-transform duration-300 lg:h-16 lg:w-16 lg:text-2xl lg:group-hover:scale-110"
                  />
                </div>
                {partido.estado === "finalizado" ? (
                  <MarcadorResultado
                    golesLocal={partido.goles_local ?? 0}
                    golesVisitante={partido.goles_visitante ?? 0}
                  />
                ) : (
                  <span className="rounded-md bg-chalk-100 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-ink-400 lg:px-4 lg:py-2">
                    vs
                  </span>
                )}
                <div className="flex min-w-0 items-center gap-2 lg:flex-col lg:gap-3">
                  <Escudo
                    url={partido.equipo_visitante.escudo_url}
                    nombre={partido.equipo_visitante.nombre}
                    className="h-7 w-7 text-[11px] transition-transform duration-300 lg:h-16 lg:w-16 lg:text-2xl lg:group-hover:scale-110"
                  />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 lg:line-clamp-2 lg:w-full lg:flex-none lg:whitespace-normal lg:text-center lg:text-base lg:leading-tight">
                    {partido.equipo_visitante.nombre}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </Card>
    </section>
  );
}
