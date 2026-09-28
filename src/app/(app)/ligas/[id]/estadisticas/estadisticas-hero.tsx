import Image from "next/image";
import { ArrowDown } from "lucide-react";
import { Escudo } from "@/components/ui/escudo";
import { Reveal } from "@/components/landing/reveal";
import type { FilaTabla } from "@/lib/estadisticas";
import { NumeroAnimado } from "@/components/numero-animado";

export type ResumenLiga = {
  lider: FilaTabla | null;
  partidosJugados: number;
  jornadasJugadas: number;
  goles: number;
};

const ctaClase =
  "group relative flex w-fit items-center justify-center gap-4 overflow-hidden rounded-full px-8 py-4 text-base font-semibold tracking-tight transition-all hover:-translate-y-0.5";
const ctaPrimaria = `${ctaClase} bg-lime-400 text-pitch-900 hover:bg-lime-300 hover:shadow-[0_14px_40px_rgba(163,230,53,0.45)]`;

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

// Solo escritorio: en mobile Estadísticas conserva su encabezado simple.
export function EstadisticasHero({
  ligaNombre,
  resumen,
}: {
  ligaNombre: string;
  resumen: ResumenLiga | null;
}) {
  const lider = resumen?.lider ?? null;
  const promedioGoles =
    resumen && resumen.partidosJugados > 0 ? resumen.goles / resumen.partidosJugados : 0;

  return (
    <section
      className={`relative isolate hidden min-h-[24rem] gap-x-12 overflow-hidden rounded-3xl px-14 py-12 lg:grid xl:px-16 ${
        resumen ? "grid-cols-[1.1fr_0.9fr]" : "grid-cols-1"
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
                  {resumen && (
                    <span
                      className="absolute inset-0 animate-pulse-ring rounded-full bg-lime-400"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`relative h-2 w-2 rounded-full ${resumen ? "bg-lime-400" : "bg-chalk-0/60"}`}
                    aria-hidden="true"
                  />
                </span>
                {resumen
                  ? `${resumen.jornadasJugadas} ${resumen.jornadasJugadas === 1 ? "FECHA JUGADA" : "FECHAS JUGADAS"}`
                  : "SIN RESULTADOS TODAVÍA"}
              </span>
              <span className="font-mono text-xs font-semibold tracking-[0.3em] text-lime-300/80">
                {ligaNombre.toUpperCase()}
              </span>
            </div>
          </Reveal>

          <Reveal retraso={100}>
            <h1 className="font-display text-6xl font-bold leading-[1.05] tracking-tight text-chalk-0 xl:text-7xl">
              Estadísticas
            </h1>
          </Reveal>

          <Reveal retraso={200}>
            <p className="max-w-xl text-lg leading-relaxed text-chalk-100/75">
              {resumen
                ? "Tabla de posiciones, rachas y tendencias de cada equipo para que armes mejores prodes."
                : "Se completan a medida que se cargan los resultados de cada jornada."}
            </p>
          </Reveal>
        </div>

        {resumen && (
          <Reveal retraso={300}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <a href="#tabla" className={ctaPrimaria}>
                <span className="relative z-10">Ver la tabla</span>
                <ArrowDown
                  className="relative z-10 h-5 w-5 transition-transform duration-300 group-hover:translate-y-1"
                  aria-hidden="true"
                />
                <span
                  className="absolute inset-y-0 left-0 w-1/3 animate-sheen bg-chalk-0/50 blur-md"
                  aria-hidden="true"
                />
              </a>
              <a
                href="#estadisticas"
                className="text-sm font-medium text-chalk-0/80 underline-offset-4 hover:text-chalk-0 hover:underline"
              >
                Ir a las estadísticas ↓
              </a>
            </div>
          </Reveal>
        )}
      </div>

      {resumen && (
        <Reveal variante="right" retraso={250} className="relative self-center">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div className="absolute inset-[10%] animate-spin-slow rounded-full border border-dashed border-chalk-0/25" />
            <div className="absolute inset-[24%] animate-spin-slow-reverse rounded-full border border-lime-400/25" />
          </div>

          <div className="relative grid animate-float-slow grid-cols-2 rounded-3xl border border-chalk-0/20 bg-pitch-900/50 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <Dato etiqueta="LÍDER DE LA TABLA" className="col-span-2 border-b border-chalk-0/15">
              {lider ? (
                <div className="flex items-center gap-4">
                  <Escudo
                    url={lider.equipo.escudoUrl}
                    nombre={lider.equipo.nombre}
                    className="h-14 w-14 shrink-0 border-chalk-0/30 text-xl"
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-display text-3xl font-bold leading-tight text-lime-300 xl:text-4xl">
                      {lider.equipo.nombre}
                    </span>
                    <span className="text-sm text-chalk-100/70">
                      <NumeroAnimado valor={lider.pts} className="font-semibold text-chalk-0" /> puntos
                      en {lider.pj} {lider.pj === 1 ? "partido" : "partidos"}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="font-display text-5xl font-bold leading-tight text-lime-300">—</span>
              )}
            </Dato>

            <Dato etiqueta="PARTIDOS JUGADOS" className="border-r border-chalk-0/15">
              <NumeroAnimado
                valor={resumen.partidosJugados}
                className="font-display text-3xl font-bold leading-tight text-chalk-0"
              />
            </Dato>

            <Dato etiqueta="GOLES POR PARTIDO">
              <NumeroAnimado
                valor={promedioGoles}
                decimales={1}
                className="font-display text-3xl font-bold leading-tight text-chalk-0"
              />
              <span className="text-xs text-chalk-100/60">{resumen.goles} goles en total</span>
            </Dato>
          </div>
        </Reveal>
      )}
    </section>
  );
}
