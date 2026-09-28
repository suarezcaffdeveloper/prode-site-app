import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LogoLiga } from "@/components/ui/logo-liga";
import { MarcadorEstado } from "@/components/ui/marcador";
import { Reveal } from "@/components/landing/reveal";
import { formatearPesos } from "@/lib/pozo";

export type EstadoFechaLiga = "abierta" | "bloqueada" | "cerrada" | "sin_fecha";

export type LigaCatalogo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  logoUrl: string | null;
  jornada: number | null;
  estadoFecha: EstadoFechaLiga;
  pozo: number | null;
  membresia: "pendiente" | "activa" | "inactiva" | null;
};

const BADGE: Record<EstadoFechaLiga, { dot: string; etiqueta: string }> = {
  abierta: { dot: "bg-lime-400", etiqueta: "ABIERTA" },
  bloqueada: { dot: "bg-coral-500", etiqueta: "BLOQUEADA" },
  cerrada: { dot: "bg-chalk-0/60", etiqueta: "CERRADA" },
  sin_fecha: { dot: "bg-chalk-0/60", etiqueta: "SIN FECHA ACTIVA" },
};

function TarjetaLiga({ liga, indice }: { liga: LigaCatalogo; indice: number }) {
  const badge = BADGE[liga.estadoFecha];
  const abierta = liga.estadoFecha === "abierta";

  return (
    <Reveal variante="scale" retraso={(indice % 3) * 80 + Math.floor(indice / 3) * 60} className="h-full">
      <Link href={`/ligas/${liga.id}`} className="group block h-full">
        <Card className="flex h-full flex-col overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:border-pitch-500 group-hover:shadow-[0_16px_36px_rgba(16,36,26,0.10)]">
          {/* Cabecera oscura tipo ticket, con textura de cancha y una luz que se mueve. */}
          <div className="relative isolate flex items-center justify-between gap-3 overflow-hidden bg-pitch-900 px-6 py-5">
            <div
              className="pointer-events-none absolute inset-0 -z-10 opacity-60"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(245,247,242,0.05) 0, rgba(245,247,242,0.05) 1px, transparent 1px, transparent 48px)",
              }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -right-10 -top-16 -z-10 h-40 w-40 animate-drift rounded-full bg-lime-400/25 blur-3xl"
              aria-hidden="true"
            />
            <LogoLiga
              url={liga.logoUrl}
              nombre={liga.nombre}
              className="h-14 w-14 rounded-full transition-transform duration-300 group-hover:scale-110"
              fallbackClassName="border border-lime-400/40 bg-chalk-0/10 text-xl text-lime-300"
            />
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest text-chalk-0/80">
              <span className="relative flex h-1.5 w-1.5">
                {abierta && (
                  <span
                    className="absolute inset-0 animate-pulse-ring rounded-full bg-lime-400"
                    aria-hidden="true"
                  />
                )}
                <span className={`relative h-1.5 w-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />
              </span>
              {liga.jornada !== null ? `FECHA ${liga.jornada} · ` : ""}
              {badge.etiqueta}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-3 p-6">
            <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-ink-900">
              {liga.nombre}
            </h2>
            <p className="line-clamp-3 text-[15px] leading-relaxed text-ink-600">
              {liga.descripcion ?? "Pronosticá los resultados de cada fecha y competí por el pozo."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-line px-6 py-4">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                POZO
              </span>
              <span className="font-display text-xl font-bold leading-tight text-pitch-700">
                {liga.pozo !== null ? formatearPesos(liga.pozo) : "—"}
              </span>
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                TU SUSCRIPCIÓN
              </span>
              {liga.membresia ? (
                <MarcadorEstado estado={liga.membresia} />
              ) : (
                <span className="rounded-md bg-chalk-100 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest text-ink-400">
                  SIN PLAN
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-line bg-chalk-50 px-6 py-3.5">
            <span className="text-sm font-semibold text-pitch-700">
              {liga.membresia === "activa" ? "Entrar a la liga" : "Ver la liga"}
            </span>
            <ArrowRight
              className="h-4 w-4 text-pitch-700 transition-transform duration-300 group-hover:translate-x-1.5"
              aria-hidden="true"
            />
          </div>
        </Card>
      </Link>
    </Reveal>
  );
}

export function CatalogoEscritorio({ ligas }: { ligas: LigaCatalogo[] }) {
  return (
    <section id="ligas" className="hidden scroll-mt-24 flex-col gap-6 lg:flex">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {ligas.length} {ligas.length === 1 ? "LIGA" : "LIGAS"}
        </p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Elegí dónde jugar
        </h2>
      </div>

      {ligas.length === 0 ? (
        <Card className="p-16 text-center text-base text-ink-600">
          Todavía no hay ligas activas. Volvé a revisar más adelante.
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-6 xl:grid-cols-3">
          {ligas.map((liga, indice) => (
            <li key={liga.id} className="h-full">
              <TarjetaLiga liga={liga} indice={indice} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
