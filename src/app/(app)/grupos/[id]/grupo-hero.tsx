import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowLeft } from "lucide-react";
import { MarcadorCodigo } from "@/components/ui/marcador";
import { Reveal } from "@/components/landing/reveal";
import { NumeroAnimado } from "@/components/numero-animado";
import { CompartirCodigo } from "./compartir-codigo";

export type ResumenGrupo = {
  totalMiembros: number;
  // Mi lugar en el ranking; null si todavía no hay resultados o estoy inactivo.
  miPosicion: number | null;
  miPuntos: number;
  lider: { nombre: string; pts: number } | null;
  jornadasJugadas: number;
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

export function GrupoHero({
  ligaId,
  ligaNombre,
  nombre,
  codigo,
  resumen,
}: {
  ligaId: string;
  ligaNombre: string;
  nombre: string;
  codigo: string;
  resumen: ResumenGrupo;
}) {
  const hayResultados = resumen.jornadasJugadas > 0;

  return (
    <>
      {/* Mobile: encabezado simple. */}
      <div className="flex flex-col gap-4 lg:hidden">
        <Link
          href={`/ligas/${ligaId}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-pitch-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {ligaNombre}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
              SUBGRUPO
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
              {nombre}
            </h1>
          </div>
          <MarcadorCodigo codigo={codigo} />
        </div>
        <CompartirCodigo codigo={codigo} nombreGrupo={nombre} ligaNombre={ligaNombre} />
        <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-chalk-0 py-3 text-center">
          <div className="flex flex-col gap-0.5 px-2">
            <span className="font-display text-xl font-bold text-ink-900">
              {resumen.totalMiembros}
            </span>
            <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
              MIEMBROS
            </span>
          </div>
          <div className="flex flex-col gap-0.5 px-2">
            <span className="font-display text-xl font-bold text-ink-900">
              {resumen.miPosicion ? `${resumen.miPosicion}°` : "—"}
            </span>
            <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
              MI LUGAR
            </span>
          </div>
          <div className="flex flex-col gap-0.5 px-2">
            <span className="font-display text-xl font-bold text-pitch-700">
              {resumen.miPuntos}
            </span>
            <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
              MIS PUNTOS
            </span>
          </div>
        </div>
      </div>

      {/* Escritorio: hero con el estadio, igual que Estadísticas. */}
      <section className="relative isolate hidden min-h-[24rem] grid-cols-[1.1fr_0.9fr] gap-x-12 overflow-hidden rounded-3xl px-14 py-12 lg:grid xl:px-16">
        <Image
          src="/images/liga-hero-stadium.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1280px) 1280px, 100vw"
          className="-z-30 animate-kenburns object-cover"
        />
        <div className="absolute inset-0 -z-20 bg-gradient-to-r from-pitch-900 via-pitch-900/80 to-pitch-900/30" />

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
                <Link
                  href={`/ligas/${ligaId}`}
                  className="inline-flex w-fit items-center gap-2 rounded-full border border-chalk-0/20 bg-chalk-0/15 px-4 py-1.5 font-mono text-[11px] font-semibold tracking-widest text-chalk-0 backdrop-blur transition-colors hover:bg-chalk-0/25"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  {ligaNombre.toUpperCase()}
                </Link>
                <span className="font-mono text-xs font-semibold tracking-[0.3em] text-lime-300/80">
                  SUBGRUPO
                </span>
              </div>
            </Reveal>

            <Reveal retraso={100}>
              <h1 className="font-display text-6xl font-bold leading-[1.05] tracking-tight text-chalk-0 xl:text-7xl">
                {nombre}
              </h1>
            </Reveal>

            <Reveal retraso={200}>
              <div className="flex flex-wrap items-center gap-4">
                <MarcadorCodigo codigo={codigo} />
                <CompartirCodigo
                  codigo={codigo}
                  nombreGrupo={nombre}
                  ligaNombre={ligaNombre}
                  oscuro
                />
              </div>
            </Reveal>
          </div>

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
                href="#miembros"
                className="text-sm font-medium text-chalk-0/80 underline-offset-4 hover:text-chalk-0 hover:underline"
              >
                Ir a los miembros ↓
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal variante="right" retraso={250} className="relative self-center">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div className="absolute inset-[10%] animate-spin-slow rounded-full border border-dashed border-chalk-0/25" />
            <div className="absolute inset-[24%] animate-spin-slow-reverse rounded-full border border-lime-400/25" />
          </div>

          <div className="relative grid animate-float-slow grid-cols-2 rounded-3xl border border-chalk-0/20 bg-pitch-900/50 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <Dato etiqueta="LÍDER DEL GRUPO" className="col-span-2 border-b border-chalk-0/15">
              {hayResultados && resumen.lider ? (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-display text-3xl font-bold leading-tight text-lime-300 xl:text-4xl">
                    {resumen.lider.nombre}
                  </span>
                  <span className="text-sm text-chalk-100/70">
                    <NumeroAnimado
                      valor={resumen.lider.pts}
                      className="font-semibold text-chalk-0"
                    />{" "}
                    puntos en {resumen.jornadasJugadas}{" "}
                    {resumen.jornadasJugadas === 1 ? "fecha" : "fechas"}
                  </span>
                </div>
              ) : (
                <span className="font-display text-2xl font-bold leading-tight text-chalk-0/80">
                  Todavía sin resultados
                </span>
              )}
            </Dato>

            <Dato etiqueta="MIEMBROS" className="border-r border-chalk-0/15">
              <NumeroAnimado
                valor={resumen.totalMiembros}
                className="font-display text-3xl font-bold leading-tight text-chalk-0"
              />
            </Dato>

            <Dato etiqueta="MI LUGAR">
              <span className="font-display text-3xl font-bold leading-tight text-chalk-0">
                {resumen.miPosicion ? `${resumen.miPosicion}°` : "—"}
              </span>
              <span className="text-xs text-chalk-100/60">{resumen.miPuntos} puntos</span>
            </Dato>
          </div>
        </Reveal>
      </section>
    </>
  );
}
