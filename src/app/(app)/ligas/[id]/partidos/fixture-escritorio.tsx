import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import { MarcadorPartido, MarcadorResultado } from "@/components/ui/marcador";
import { Reveal } from "@/components/landing/reveal";
import {
  formatearDiaPartido,
  formatearFechaPartido,
  formatearHoraPartido,
} from "@/lib/fecha-partido";

type EquipoRef = { id: string; nombre: string; escudo_url: string | null };

export type PartidoFixture = {
  id: string;
  jornada: number;
  fecha_hora: string | null;
  goles_local: number | null;
  goles_visitante: number | null;
  estado: "pendiente" | "finalizado";
  equipo_local: EquipoRef;
  equipo_visitante: EquipoRef;
};

export type FechaFixture = {
  jornada: number;
  partidos: PartidoFixture[];
  jugados: number;
  estado: "jugada" | "en_curso" | "proxima";
};

// --- Riel de fechas: salta a cada fecha y muestra su estado de un vistazo ---

export function RielFechas({ fechas }: { fechas: FechaFixture[] }) {
  return (
    <nav
      aria-label="Fechas del fixture"
      className="sticky top-[88px] z-20 hidden items-center gap-4 rounded-2xl border border-line bg-chalk-0/90 py-2.5 pl-5 pr-2.5 shadow-[0_8px_24px_rgba(16,36,26,0.06)] backdrop-blur lg:flex"
    >
      <p className="shrink-0 font-mono text-[11px] font-semibold tracking-[0.3em] text-ink-400">
        IR A FECHA
      </p>
      <div
        className="flex flex-1 gap-2 overflow-x-auto py-0.5 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {fechas.map((fecha) => {
          const enCurso = fecha.estado === "en_curso";
          const jugada = fecha.estado === "jugada";
          return (
            <a
              key={fecha.jornada}
              href={`#fecha-${fecha.jornada}`}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium tabular-nums transition-all hover:-translate-y-0.5 ${
                enCurso
                  ? "border-pitch-700 bg-pitch-700 text-chalk-0 shadow-[0_8px_20px_rgba(20,83,45,0.3)]"
                  : "border-line-strong bg-chalk-0 text-ink-600 hover:border-pitch-500 hover:shadow-[0_8px_20px_rgba(16,36,26,0.08)]"
              }`}
            >
              {enCurso && (
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className="absolute inset-0 animate-pulse-ring rounded-full bg-lime-400"
                    aria-hidden="true"
                  />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-lime-400" aria-hidden="true" />
                </span>
              )}
              {jugada && <Check className="h-3.5 w-3.5 text-pitch-500" strokeWidth={3} aria-hidden="true" />}
              {fecha.jornada}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// --- Fecha en curso: tarjetas grandes, igual que las del Inicio ---

export function FechaDestacada({
  fecha,
  ligaId,
  suscripta,
}: {
  fecha: FechaFixture;
  ligaId: string;
  suscripta: boolean;
}) {
  return (
    <section id={`fecha-${fecha.jornada}`} className="hidden scroll-mt-40 flex-col gap-5 lg:flex">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            EN CURSO · FECHA {fecha.jornada}
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">
            La fecha que se juega ahora
          </h2>
        </div>
        <Link
          href={suscripta ? `/ligas/${ligaId}/pronosticos` : `/ligas/${ligaId}/planes`}
          className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-pitch-700 px-5 py-2.5 text-sm font-semibold text-chalk-0 transition-all hover:-translate-y-0.5 hover:bg-pitch-600 hover:shadow-[0_10px_24px_rgba(20,83,45,0.3)]"
        >
          {suscripta ? "Jugar prode" : "Elegir un plan"}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {fecha.partidos.map((partido, indice) => (
          <Reveal
            key={partido.id}
            variante="scale"
            retraso={(indice % 2) * 80 + Math.floor(indice / 2) * 60}
            className="h-full"
          >
            <div className="group flex h-full flex-col gap-5 rounded-2xl border border-line bg-chalk-0 p-6 shadow-[0_1px_2px_rgba(16,36,26,0.04)] transition-all hover:-translate-y-1 hover:border-pitch-500 hover:shadow-[0_16px_36px_rgba(16,36,26,0.10)]">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-400">
                  {partido.estado === "finalizado"
                    ? "Final"
                    : formatearFechaPartido(partido.fecha_hora)}
                </p>
                <MarcadorPartido estado={partido.estado} />
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div className="flex min-w-0 flex-col items-center gap-3">
                  <Escudo
                    url={partido.equipo_local.escudo_url}
                    nombre={partido.equipo_local.nombre}
                    className="h-16 w-16 text-2xl transition-transform duration-300 group-hover:scale-110"
                  />
                  <p className="line-clamp-2 w-full text-center text-base font-medium leading-tight text-ink-900">
                    {partido.equipo_local.nombre}
                  </p>
                </div>
                {partido.estado === "finalizado" ? (
                  <MarcadorResultado
                    golesLocal={partido.goles_local ?? 0}
                    golesVisitante={partido.goles_visitante ?? 0}
                  />
                ) : (
                  <span className="rounded-md bg-chalk-100 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-ink-400">
                    vs
                  </span>
                )}
                <div className="flex min-w-0 flex-col items-center gap-3">
                  <Escudo
                    url={partido.equipo_visitante.escudo_url}
                    nombre={partido.equipo_visitante.nombre}
                    className="h-16 w-16 text-2xl transition-transform duration-300 group-hover:scale-110"
                  />
                  <p className="line-clamp-2 w-full text-center text-base font-medium leading-tight text-ink-900">
                    {partido.equipo_visitante.nombre}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// --- Calendario: una tarjeta tipo ticket por fecha ---

const estadoFecha: Record<FechaFixture["estado"], { dot: string; etiqueta: string }> = {
  jugada: { dot: "bg-chalk-0/50", etiqueta: "JUGADA" },
  en_curso: { dot: "bg-lime-400", etiqueta: "EN CURSO" },
  proxima: { dot: "bg-amber-500", etiqueta: "PRÓXIMA" },
};

function FilaPartido({ partido }: { partido: PartidoFixture }) {
  return (
    <div className="grid grid-cols-[1fr_6rem_1fr] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-chalk-50">
      <div className="flex min-w-0 items-center justify-end gap-2.5">
        <p className="min-w-0 flex-1 truncate text-right text-[15px] font-medium text-ink-900">
          {partido.equipo_local.nombre}
        </p>
        <Escudo
          url={partido.equipo_local.escudo_url}
          nombre={partido.equipo_local.nombre}
          className="h-9 w-9 text-sm"
        />
      </div>

      <div className="flex justify-center">
        {partido.estado === "finalizado" ? (
          <MarcadorResultado
            golesLocal={partido.goles_local ?? 0}
            golesVisitante={partido.goles_visitante ?? 0}
          />
        ) : partido.fecha_hora ? (
          <span className="flex flex-col items-center font-mono text-[10px] font-semibold uppercase leading-tight tracking-widest text-ink-400">
            <span>{formatearDiaPartido(partido.fecha_hora)}</span>
            <span className="text-sm text-pitch-700">{formatearHoraPartido(partido.fecha_hora)}</span>
          </span>
        ) : (
          <span className="rounded-md bg-chalk-100 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400">
            A confirmar
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2.5">
        <Escudo
          url={partido.equipo_visitante.escudo_url}
          nombre={partido.equipo_visitante.nombre}
          className="h-9 w-9 text-sm"
        />
        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink-900">
          {partido.equipo_visitante.nombre}
        </p>
      </div>
    </div>
  );
}

export function CalendarioFechas({
  fechas,
  ligaId,
  suscripta,
}: {
  fechas: FechaFixture[];
  ligaId: string;
  suscripta: boolean;
}) {
  if (fechas.length === 0) return null;

  return (
    <section className="hidden flex-col gap-5 lg:flex">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          CALENDARIO
        </p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Todas las fechas
        </h2>
      </div>

      <div className="grid grid-cols-2 items-start gap-6">
        {fechas.map((fecha, indice) => {
          const config = estadoFecha[fecha.estado];
          return (
            <Reveal key={fecha.jornada} variante="scale" retraso={(indice % 2) * 80}>
              <Card
                id={`fecha-${fecha.jornada}`}
                className="scroll-mt-40 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-pitch-500 hover:shadow-[0_16px_36px_rgba(16,36,26,0.10)]"
              >
                <div className="flex items-center justify-between gap-3 bg-pitch-900 px-5 py-3.5">
                  <p className="font-mono text-[13px] font-bold uppercase tracking-[0.2em] text-lime-300">
                    Fecha {fecha.jornada}
                  </p>
                  <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest text-chalk-0/80">
                    <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
                    {config.etiqueta} · {fecha.jugados}/{fecha.partidos.length}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 p-3">
                  {fecha.partidos.map((partido) => (
                    <FilaPartido key={partido.id} partido={partido} />
                  ))}
                </div>

                {suscripta && (
                  <div className="flex items-center justify-end border-t border-line bg-chalk-50 px-5 py-3">
                    <Link
                      href={`/ligas/${ligaId}/pronosticos?jornada=${fecha.jornada}`}
                      className="group inline-flex items-center gap-1.5 text-sm font-semibold text-pitch-700 hover:underline"
                    >
                      {fecha.estado === "proxima" ? "Ver fecha" : "Ver mis prodes"}
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                )}
              </Card>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
