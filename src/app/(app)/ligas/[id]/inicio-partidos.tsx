import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import { MarcadorResultado } from "@/components/ui/marcador";

export type PartidoInicio = {
  id: string;
  fecha_hora: string | null;
  goles_local: number | null;
  goles_visitante: number | null;
  estado: "pendiente" | "finalizado";
  equipo_local: { nombre: string; escudo_url: string | null };
  equipo_visitante: { nombre: string; escudo_url: string | null };
};

function formatearFechaPartido(iso: string | null): string {
  if (!iso) return "A confirmar";
  return new Date(iso)
    .toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

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
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            FECHA {jornada}
          </p>
          <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">
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

      <Card className="divide-y divide-line">
        {partidos.map((partido) => (
          <div key={partido.id} className="flex flex-col gap-2 px-4 py-3.5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400">
              {partido.estado === "finalizado" ? "Final" : formatearFechaPartido(partido.fecha_hora)}
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex min-w-0 items-center justify-end gap-2">
                <p className="min-w-0 flex-1 truncate text-right text-sm font-medium text-ink-900">
                  {partido.equipo_local.nombre}
                </p>
                <Escudo
                  url={partido.equipo_local.escudo_url}
                  nombre={partido.equipo_local.nombre}
                  className="h-7 w-7 text-[11px]"
                />
              </div>
              {partido.estado === "finalizado" ? (
                <MarcadorResultado
                  golesLocal={partido.goles_local ?? 0}
                  golesVisitante={partido.goles_visitante ?? 0}
                />
              ) : (
                <span className="rounded-md bg-chalk-100 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-ink-400">
                  vs
                </span>
              )}
              <div className="flex min-w-0 items-center gap-2">
                <Escudo
                  url={partido.equipo_visitante.escudo_url}
                  nombre={partido.equipo_visitante.nombre}
                  className="h-7 w-7 text-[11px]"
                />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                  {partido.equipo_visitante.nombre}
                </p>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}
