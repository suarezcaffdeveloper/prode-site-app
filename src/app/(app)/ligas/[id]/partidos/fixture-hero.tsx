import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ClipboardList, Ticket } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

export type StatsFixture = {
  jornadaActiva: number | null;
  totalFechas: number;
  fechasJugadas: number;
  partidosJugados: number;
  totalPartidos: number;
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

// Solo escritorio: en mobile el Fixture conserva su encabezado simple.
export function FixtureHero({
  ligaId,
  ligaNombre,
  stats,
  suscripta,
}: {
  ligaId: string;
  ligaNombre: string;
  stats: StatsFixture | null;
  suscripta: boolean;
}) {
  const activa = stats?.jornadaActiva ?? null;
  const completa =
    stats !== null && stats.totalFechas > 0 && stats.fechasJugadas === stats.totalFechas;
  const porcentaje =
    stats && stats.totalPartidos > 0
      ? Math.round((stats.partidosJugados / stats.totalPartidos) * 100)
      : 0;

  const etiquetaBadge = activa
    ? `FECHA ${activa} · EN CURSO`
    : completa
      ? "TEMPORADA COMPLETA"
      : "SIN FECHA ACTIVA";

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
              <span className="inline-flex w-fit items-center gap-2.5 rounded-full border border-chalk-0/20 bg-chalk-0/15 px-4 py-1.5 font-mono text-[11px] font-semibold tracking-widest text-chalk-0 backdrop-blur">
                <span className="relative flex h-2 w-2">
                  {activa && (
                    <span
                      className="absolute inset-0 animate-pulse-ring rounded-full bg-lime-400"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`relative h-2 w-2 rounded-full ${activa ? "bg-lime-400" : "bg-chalk-0/60"}`}
                    aria-hidden="true"
                  />
                </span>
                {etiquetaBadge}
              </span>
              <span className="font-mono text-xs font-semibold tracking-[0.3em] text-lime-300/80">
                {ligaNombre.toUpperCase()}
              </span>
            </div>
          </Reveal>

          <Reveal retraso={100}>
            <h1 className="font-display text-6xl font-bold leading-[1.05] tracking-tight text-chalk-0 xl:text-7xl">
              Fixture
            </h1>
          </Reveal>

          <Reveal retraso={200}>
            <p className="max-w-xl text-lg leading-relaxed text-chalk-100/75">
              Todas las fechas de la liga, con sus horarios y resultados. Elegí una fecha para
              ir directo a sus partidos.
            </p>
          </Reveal>
        </div>

        <Reveal retraso={300}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {activa ? (
              <Link
                href={suscripta ? `/ligas/${ligaId}/pronosticos` : `/ligas/${ligaId}/planes`}
                className={ctaPrimaria}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {suscripta ? (
                    <ClipboardList className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Ticket className="h-5 w-5" aria-hidden="true" />
                  )}
                  {suscripta ? `Jugar prode · Fecha ${activa}` : "Elegir un plan"}
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
            ) : (
              <Link href={`/ligas/${ligaId}/pronosticos`} className={ctaSecundaria}>
                <span className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                  Ir a Pronósticos
                </span>
                <ArrowRight
                  className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5"
                  aria-hidden="true"
                />
              </Link>
            )}
            <Link
              href={`/ligas/${ligaId}`}
              className="text-sm font-medium text-chalk-0/80 underline-offset-4 hover:text-chalk-0 hover:underline"
            >
              ← Volver a la liga
            </Link>
          </div>
        </Reveal>
      </div>

      {stats && (
        <Reveal variante="right" retraso={250} className="relative self-center">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div className="absolute inset-[10%] animate-spin-slow rounded-full border border-dashed border-chalk-0/25" />
            <div className="absolute inset-[24%] animate-spin-slow-reverse rounded-full border border-lime-400/25" />
          </div>

          <div className="relative grid animate-float-slow grid-cols-2 rounded-3xl border border-chalk-0/20 bg-pitch-900/50 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <Dato etiqueta="FECHA EN CURSO" className="col-span-2 border-b border-chalk-0/15">
              <span className="truncate font-display text-5xl font-bold leading-tight text-lime-300 xl:text-6xl">
                {activa ? `Fecha ${activa}` : "—"}
              </span>
              <span className="text-sm text-chalk-100/70">
                {activa
                  ? `De ${stats.totalFechas} ${stats.totalFechas === 1 ? "fecha" : "fechas"} en total.`
                  : completa
                    ? "Se jugaron todas las fechas del fixture."
                    : "Todavía no hay una fecha habilitada para jugar."}
              </span>
            </Dato>

            <Dato etiqueta="PARTIDOS JUGADOS" className="border-r border-chalk-0/15">
              <span className="font-display text-3xl font-bold leading-tight text-chalk-0">
                {stats.partidosJugados}
                <span className="text-sm font-medium text-chalk-0/70"> de {stats.totalPartidos}</span>
              </span>
              {stats.totalPartidos > 0 && (
                <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-chalk-0/15" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-lime-400 transition-[width] duration-700"
                    style={{ width: `${porcentaje}%` }}
                  />
                </span>
              )}
            </Dato>

            <Dato etiqueta="FECHAS JUGADAS">
              <span className="font-display text-3xl font-bold leading-tight text-chalk-0">
                {stats.fechasJugadas}
                <span className="text-sm font-medium text-chalk-0/70"> de {stats.totalFechas}</span>
              </span>
            </Dato>
          </div>
        </Reveal>
      )}
    </section>
  );
}
