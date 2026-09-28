import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import {
  BONUS_JORNADA_PERFECTA,
  type DetalleJornada,
  type FilaDetalle,
  type PuntosPartido,
} from "@/lib/puntos-grupo";

export type EquiposPartido = {
  local: { nombre: string; escudoUrl: string | null };
  visitante: { nombre: string; escudoUrl: string | null };
};

function ChipPuntos({ puntos }: { puntos: PuntosPartido | null }) {
  if (puntos === null) {
    return (
      <span className="rounded-md bg-chalk-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-400">
        —
      </span>
    );
  }
  const clase =
    puntos === 3
      ? "bg-lime-400/30 text-pitch-700"
      : puntos === 1
        ? "bg-chalk-100 text-ink-600"
        : "bg-coral-500/10 text-coral-700";
  return (
    <span
      className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums ${clase}`}
    >
      +{puntos}
    </span>
  );
}

function Marcador({ local, visitante }: { local: number; visitante: number }) {
  return (
    <span className="font-mono text-sm font-bold tabular-nums text-ink-900">
      {local} – {visitante}
    </span>
  );
}

function FilaMiembro({
  fila,
  equipos,
  esYo,
}: {
  fila: FilaDetalle;
  equipos: Record<string, EquiposPartido>;
  esYo: boolean;
}) {
  const puntuado = fila.estado === "puntuado";
  const resumen = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-ink-900 lg:text-base">
          {fila.nombre}
          {esYo && (
            <span className="ml-2 font-mono text-[10px] font-semibold tracking-widest text-pitch-600">
              VOS
            </span>
          )}
        </span>
        {!puntuado && (
          <span className="text-xs text-ink-400">
            {fila.estado === "previo_ingreso" ? "Todavía no era miembro" : "Sin cartón"}
          </span>
        )}
        {puntuado && fila.perfecta && (
          <span className="text-xs font-semibold text-pitch-600">
            Fecha perfecta (+{BONUS_JORNADA_PERFECTA})
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-display text-xl font-bold tabular-nums text-ink-900">
          {puntuado ? fila.pts : "—"}
        </span>
        {puntuado && (
          <ChevronDown
            className="h-4 w-4 text-ink-400 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );

  const claseFila = `border-b border-line px-4 py-3 last:border-b-0 lg:px-6 lg:py-4 ${
    fila.activo ? "" : "opacity-55"
  } ${esYo ? "bg-lime-400/10" : ""}`;

  if (!puntuado) return <div className={claseFila}>{resumen}</div>;

  return (
    <details className={`group ${claseFila}`}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {resumen}
      </summary>
      <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
        {fila.partidos.map((partido) => {
          const par = equipos[partido.partidoId];
          if (!par) return null;
          return (
            <div
              key={partido.partidoId}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm"
            >
              <div className="flex min-w-0 items-center justify-end gap-1.5">
                <span className="min-w-0 truncate text-right text-ink-900">
                  {par.local.nombre}
                </span>
                <Escudo
                  url={par.local.escudoUrl}
                  nombre={par.local.nombre}
                  className="h-5 w-5 shrink-0 text-[9px]"
                />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                {partido.prediccion ? (
                  <Marcador
                    local={partido.prediccion.golesLocal}
                    visitante={partido.prediccion.golesVisitante}
                  />
                ) : (
                  <span className="text-xs text-ink-400">sin pronóstico</span>
                )}
                <span className="font-mono text-[10px] tracking-widest text-ink-400">
                  {partido.real
                    ? `FINAL ${partido.real.golesLocal}–${partido.real.golesVisitante}`
                    : "POR JUGAR"}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                <Escudo
                  url={par.visitante.escudoUrl}
                  nombre={par.visitante.nombre}
                  className="h-5 w-5 shrink-0 text-[9px]"
                />
                <span className="min-w-0 flex-1 truncate text-ink-900">
                  {par.visitante.nombre}
                </span>
                <ChipPuntos puntos={partido.puntos} />
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

export function JornadasGrupo({
  grupoId,
  jornadas,
  detalle,
  equipos,
  usuarioActualId,
}: {
  grupoId: string;
  // Solo fechas ya cerradas: antes del cierre los cartones son privados.
  jornadas: number[];
  detalle: DetalleJornada | null;
  equipos: Record<string, EquiposPartido>;
  usuarioActualId: string;
}) {
  if (jornadas.length === 0 || !detalle) {
    return (
      <Card className="p-8 text-center text-sm text-ink-600">
        Los prodes de cada miembro aparecen acá cuando cierra la fecha. Hasta entonces son
        privados, para que nadie pueda copiarse.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="-mx-6 flex gap-2 overflow-x-auto px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {jornadas.map((jornada) => {
          const seleccionada = jornada === detalle.jornada;
          return (
            <Link
              key={jornada}
              href={`/grupos/${grupoId}?jornada=${jornada}#jornadas`}
              scroll={false}
              className={`flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-all lg:h-11 lg:px-5 ${
                seleccionada
                  ? "border-pitch-700 bg-pitch-700 text-chalk-0"
                  : "border-line-strong bg-chalk-0 text-ink-600 hover:border-pitch-500"
              }`}
            >
              Fecha {jornada}
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {detalle.filas.map((fila) => (
          <FilaMiembro
            key={fila.usuarioId}
            fila={fila}
            equipos={equipos}
            esYo={fila.usuarioId === usuarioActualId}
          />
        ))}
      </Card>

      <p className="text-[11px] leading-relaxed text-ink-400 lg:text-xs">
        {detalle.completa
          ? "Fecha completa: los puntos son definitivos."
          : "Hay partidos por jugar: los puntos se van sumando a medida que se cargan los resultados."}{" "}
        Tocá un miembro para ver su prode partido por partido.
      </p>
    </div>
  );
}
