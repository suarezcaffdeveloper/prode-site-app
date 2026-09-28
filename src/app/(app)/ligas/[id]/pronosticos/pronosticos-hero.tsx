import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Calendar, Ticket } from "lucide-react";
import { formatearPesos, type PozoJornada } from "@/lib/pozo";
import { Reveal } from "@/components/landing/reveal";
import { CuentaRegresivaCierre } from "./cuenta-regresiva";
import { PozoAnimado } from "@/components/pozo-animado";

export type EstadoVista = "abierta" | "bloqueada" | "cerrada" | "jugada" | "proxima";

export type StatsPronosticos = {
  pozo: PozoJornada | null;
  horaCierre: string | null;
  cargados: number;
  total: number;
  // Solo en la fecha activa abierta tiene sentido el "x de y" y la barra.
  mostrarTotal: boolean;
};

const badgeConfig: Record<EstadoVista, { dot: string; label: string }> = {
  abierta: { dot: "bg-lime-400", label: "ABIERTA" },
  bloqueada: { dot: "bg-coral-500", label: "BLOQUEADA" },
  cerrada: { dot: "bg-chalk-0/60", label: "CERRADA" },
  jugada: { dot: "bg-chalk-0/60", label: "JUGADA" },
  proxima: { dot: "bg-amber-500", label: "PRÓXIMA" },
};

const subtitulos: Record<EstadoVista, string> = {
  abierta: "Cargá un resultado para cada partido. Si los acertás todos, te llevás el pozo.",
  bloqueada:
    "Todavía falta cargar el horario de algún partido. Podés revisar el fixture mientras tanto.",
  cerrada: "La fecha cerró. Estamos esperando los resultados para habilitar la próxima.",
  jugada: "Así les fue a tus prodes en esta fecha.",
  proxima: "Esta fecha todavía no se juega.",
};

const ctaClase =
  "group relative flex w-fit items-center justify-center gap-4 overflow-hidden rounded-full px-8 py-4 text-base font-semibold tracking-tight transition-all hover:-translate-y-0.5";
const ctaPrimaria = `${ctaClase} bg-lime-400 text-pitch-900 hover:bg-lime-300 hover:shadow-[0_14px_40px_rgba(163,230,53,0.45)]`;
const ctaSecundaria = `${ctaClase} border border-chalk-0/25 bg-chalk-0/15 text-chalk-0 backdrop-blur hover:bg-chalk-0/25`;

function Dato({
  etiqueta,
  className = "",
  children,
}: {
  etiqueta: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 px-7 py-6 ${className}`}>
      <span className="font-mono text-[11px] font-semibold tracking-widest text-chalk-0/70">
        {etiqueta}
      </span>
      {children}
    </div>
  );
}

// Solo escritorio: en mobile Pronósticos conserva su encabezado y tarjeta de estado.
export function PronosticosHero({
  ligaId,
  ligaNombre,
  jornada,
  estado,
  stats,
  saldo,
}: {
  ligaId: string;
  ligaNombre: string;
  jornada: number | null;
  estado: EstadoVista | null;
  stats: StatsPronosticos | null;
  saldo: number;
}) {
  const badge = estado ? badgeConfig[estado] : null;
  const abierta = estado === "abierta";
  const pozo = stats?.pozo ?? null;
  const porcentaje =
    stats && stats.total > 0 ? Math.round((stats.cargados / stats.total) * 100) : 0;

  let cta: React.ReactNode = null;
  if (abierta && saldo > 0) {
    cta = (
      <a href="#cargar" className={ctaPrimaria}>
        <span className="relative z-10">Cargar un prode</span>
        <ArrowDown
          className="relative z-10 h-5 w-5 transition-transform duration-300 group-hover:translate-y-1"
          aria-hidden="true"
        />
        <span
          className="absolute inset-y-0 left-0 w-1/3 animate-sheen bg-chalk-0/50 blur-md"
          aria-hidden="true"
        />
      </a>
    );
  } else if (abierta) {
    cta = (
      <Link href={`/ligas/${ligaId}/planes`} className={ctaPrimaria}>
        <span className="relative z-10 flex items-center gap-2">
          <Ticket className="h-5 w-5" aria-hidden="true" />
          Comprar más prodes
        </span>
        <ArrowRight
          className="relative z-10 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5"
          aria-hidden="true"
        />
        <span
          className="absolute inset-y-0 left-0 w-1/3 animate-sheen bg-chalk-0/50 blur-md"
          aria-hidden="true"
        />
      </Link>
    );
  } else {
    cta = (
      <Link href={`/ligas/${ligaId}/partidos`} className={ctaSecundaria}>
        <span className="flex items-center gap-2">
          <Calendar className="h-5 w-5" aria-hidden="true" />
          Ver fixture completo
        </span>
        <ArrowRight
          className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5"
          aria-hidden="true"
        />
      </Link>
    );
  }

  return (
    <section
      className={`relative isolate hidden min-h-[24rem] gap-x-12 overflow-hidden rounded-3xl px-14 py-12 lg:grid xl:px-16 ${
        stats ? "grid-cols-[1.1fr_0.9fr]" : "grid-cols-1"
      }`}
    >
      <Image
        src="/images/liga-hero-stadium.png"
        alt=""
        fill
        priority
        sizes="(min-width: 1280px) 1280px, 100vw"
        className="-z-30 animate-kenburns object-cover"
      />
      <div className="absolute inset-0 -z-20 bg-gradient-to-r from-pitch-900 via-pitch-900/80 to-pitch-900/30" />

      {/* Textura de cancha, luces que se mueven y círculo central. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(245,247,242,0.05) 0, rgba(245,247,242,0.05) 1px, transparent 1px, transparent 72px)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 top-6 -z-10 h-96 w-96 animate-drift rounded-full bg-lime-400/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 right-0 -z-10 h-[28rem] w-[28rem] animate-drift rounded-full bg-pitch-500/40 blur-3xl [animation-delay:-8s]"
        aria-hidden="true"
      />

      <div className="flex flex-col justify-between gap-8">
        <div className="flex flex-col gap-5">
          <Reveal>
            <div className="flex flex-wrap items-center gap-3">
              {badge && (
                <span className="inline-flex w-fit items-center gap-2.5 rounded-full border border-chalk-0/20 bg-chalk-0/15 px-4 py-1.5 font-mono text-[11px] font-semibold tracking-widest text-chalk-0 backdrop-blur">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inset-0 rounded-full ${badge.dot} ${abierta ? "animate-pulse-ring" : ""}`}
                      aria-hidden="true"
                    />
                    <span className={`relative h-2 w-2 rounded-full ${badge.dot}`} aria-hidden="true" />
                  </span>
                  FECHA {jornada} · {badge.label}
                </span>
              )}
              <span className="font-mono text-xs font-semibold tracking-[0.3em] text-lime-300/80">
                {ligaNombre.toUpperCase()}
              </span>
            </div>
          </Reveal>

          <Reveal retraso={100}>
            <h1 className="font-display text-6xl font-bold leading-[1.05] tracking-tight text-chalk-0 xl:text-7xl">
              Tus prodes
            </h1>
          </Reveal>

          <Reveal retraso={200}>
            <p className="max-w-xl text-lg leading-relaxed text-chalk-100/75">
              {estado
                ? subtitulos[estado]
                : "Cargá tus pronósticos y competí por el pozo de cada fecha."}
            </p>
          </Reveal>
        </div>

        <Reveal retraso={300}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {cta}
            {abierta && (
              <Link
                href={`/ligas/${ligaId}/partidos`}
                className="text-sm font-medium text-chalk-0/80 underline-offset-4 hover:text-chalk-0 hover:underline"
              >
                Ver fixture completo →
              </Link>
            )}
          </div>
        </Reveal>
      </div>

      {stats && (
        <Reveal variante="right" retraso={250} className="relative self-center">
          {/* Círculo central de la cancha girando detrás del tablero. */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div className="absolute inset-[10%] animate-spin-slow rounded-full border border-dashed border-chalk-0/25" />
            <div className="absolute inset-[24%] animate-spin-slow-reverse rounded-full border border-lime-400/25" />
          </div>

          <div className="relative grid animate-float-slow grid-cols-2 rounded-3xl border border-chalk-0/20 bg-pitch-900/50 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <Dato etiqueta={pozo?.liquidada ? "POZO REPARTIDO" : "POZO"} className="col-span-2 border-b border-chalk-0/15">
              {pozo ? (
                <PozoAnimado
                  monto={pozo.pozo_total}
                  className="truncate font-display text-5xl font-bold leading-tight text-lime-300 xl:text-6xl"
                />
              ) : (
                <span className="font-display text-5xl font-bold leading-tight text-lime-300">—</span>
              )}
              <span className="text-sm text-chalk-100/70">
                {pozo?.liquidada
                  ? pozo.cantidad_ganadores === 0
                    ? "Sin ganadores: el pozo pasa a la próxima jornada."
                    : `${pozo.cantidad_ganadores} ${
                        pozo.cantidad_ganadores === 1 ? "prode ganador" : "prodes ganadores"
                      }.`
                  : pozo && pozo.pozo_acumulado_entrante > 0
                    ? `Incluye ${formatearPesos(pozo.pozo_acumulado_entrante)} acumulados de la jornada anterior.`
                    : "Se lo lleva quien acierte todos los marcadores de la fecha."}
              </span>
            </Dato>

            <Dato etiqueta="CIERRE" className="border-r border-chalk-0/15">
              {abierta && stats.horaCierre ? (
                <CuentaRegresivaCierre horaCierre={stats.horaCierre} variante="hero" />
              ) : (
                <span className="font-display text-3xl font-bold leading-tight text-chalk-0">
                  {estado === "bloqueada"
                    ? "Pendiente"
                    : estado === "proxima"
                      ? "Próxima"
                      : estado === "cerrada"
                        ? "Cerrada"
                        : "Jugada"}
                </span>
              )}
            </Dato>

            <Dato etiqueta="TUS PRODES">
              <span className="font-display text-3xl font-bold leading-tight text-chalk-0">
                {stats.cargados}
                {stats.mostrarTotal && (
                  <span className="text-sm font-medium text-chalk-0/70"> de {stats.total}</span>
                )}
              </span>
              {stats.mostrarTotal && stats.total > 0 && (
                <span
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-chalk-0/15"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-lime-400 transition-[width] duration-700"
                    style={{ width: `${porcentaje}%` }}
                  />
                </span>
              )}
            </Dato>
          </div>
        </Reveal>
      )}
    </section>
  );
}
