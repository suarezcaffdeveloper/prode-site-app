import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LogoLiga } from "@/components/ui/logo-liga";
import { formatearPesos } from "@/lib/pozo";
import type { ResumenCatalogo } from "./catalogo-hero";
import type { EstadoFechaLiga, LigaCatalogo } from "./catalogo-escritorio";

const ESTADO_FECHA: Record<EstadoFechaLiga, { dot: string; etiqueta: string }> = {
  abierta: { dot: "bg-lime-400", etiqueta: "Abierta" },
  bloqueada: { dot: "bg-coral-500", etiqueta: "Bloqueada" },
  cerrada: { dot: "bg-ink-400", etiqueta: "Cerrada" },
  sin_fecha: { dot: "bg-ink-400", etiqueta: "Sin fecha" },
};

const ESTADO_MEMBRESIA: Record<
  NonNullable<LigaCatalogo["membresia"]> | "sin_plan",
  { dot: string; texto: string; etiqueta: string }
> = {
  activa: { dot: "bg-lime-400", texto: "text-pitch-700", etiqueta: "Activa" },
  pendiente: { dot: "bg-amber-500", texto: "text-amber-700", etiqueta: "Pendiente" },
  inactiva: { dot: "bg-coral-500", texto: "text-coral-700", etiqueta: "Inactiva" },
  sin_plan: { dot: "bg-ink-400", texto: "text-ink-400", etiqueta: "Sin plan" },
};

function DatoHero({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-3 py-3 first:pl-4 last:pr-4">
      <span className="font-mono text-[10px] font-semibold tracking-widest text-chalk-0/70">
        {etiqueta}
      </span>
      {children}
    </div>
  );
}

// Solo mobile: en escritorio lo reemplaza CatalogoHero.
export function CatalogoHeroMovil({ resumen }: { resumen: ResumenCatalogo }) {
  return (
    <section className="relative isolate flex min-h-80 flex-col justify-end gap-4 overflow-hidden rounded-2xl px-5 py-5 sm:min-h-96 sm:px-6 sm:py-6 lg:hidden">
      <Image
        src="/images/liga-hero-stadium.png"
        alt=""
        fill
        priority
        sizes="(min-width: 672px) 672px, 100vw"
        className="-z-20 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-pitch-900 via-pitch-900/70 to-pitch-900/10" />

      <div className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-chalk-0/20 bg-chalk-0/15 px-3 py-1 font-mono text-[11px] font-semibold tracking-widest text-chalk-0 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-400" aria-hidden="true" />
          CATÁLOGO
        </span>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-chalk-0 sm:text-4xl">
          Ligas disponibles
        </h1>
        <p className="text-sm text-chalk-100/75">
          Elegí una liga y jugá el prode de cada fecha. Si acertás todo, te llevás el pozo.
        </p>
      </div>

      <div className="grid grid-cols-3 divide-x divide-chalk-0/15 rounded-xl border border-chalk-0/15 bg-chalk-0/10 backdrop-blur">
        <DatoHero etiqueta="POZO">
          <span className="truncate font-display text-xl font-bold leading-tight text-lime-300">
            {resumen.pozoEnJuego !== null ? formatearPesos(resumen.pozoEnJuego) : "—"}
          </span>
        </DatoHero>
        <DatoHero etiqueta="LIGAS">
          <span className="font-display text-xl font-bold leading-tight text-chalk-0">
            {resumen.totalLigas}
          </span>
        </DatoHero>
        <DatoHero etiqueta="TUS LIGAS">
          <span className="font-display text-xl font-bold leading-tight text-chalk-0">
            {resumen.ligasSuscriptas}
          </span>
        </DatoHero>
      </div>

      {resumen.totalLigas > 0 && (
        <a
          href="#ligas-movil"
          className="flex w-full items-center justify-between gap-2 rounded-xl bg-lime-400 px-5 py-3.5 text-sm font-semibold tracking-tight text-pitch-900 transition-colors hover:bg-lime-300"
        >
          Ver las ligas
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </a>
      )}
    </section>
  );
}

function FilaLiga({ liga }: { liga: LigaCatalogo }) {
  const fecha = ESTADO_FECHA[liga.estadoFecha];
  const membresia = ESTADO_MEMBRESIA[liga.membresia ?? "sin_plan"];

  return (
    <Link
      href={`/ligas/${liga.id}`}
      className="flex flex-col gap-3 px-4 py-4 transition-colors active:bg-chalk-50"
    >
      <div className="flex items-center gap-3">
        <LogoLiga
          url={liga.logoUrl}
          nombre={liga.nombre}
          className="h-11 w-11 rounded-full"
          fallbackClassName="bg-pitch-900 text-base text-lime-300"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold leading-tight text-ink-900">
            {liga.nombre}
          </p>
          {liga.descripcion && (
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-600">{liga.descripcion}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-3 divide-x divide-line rounded-lg bg-chalk-50">
        <div className="flex min-w-0 flex-col gap-1 px-3 py-2.5">
          <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
            FECHA
          </span>
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-900">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${fecha.dot}`} aria-hidden="true" />
            <span className="truncate">
              {liga.jornada !== null ? `${liga.jornada} · ${fecha.etiqueta}` : fecha.etiqueta}
            </span>
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1 px-3 py-2.5">
          <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
            POZO
          </span>
          <span className="truncate font-display text-[13px] font-bold text-pitch-700">
            {liga.pozo !== null ? formatearPesos(liga.pozo) : "—"}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1 px-3 py-2.5">
          <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
            PLAN
          </span>
          <span
            className={`flex items-center gap-1.5 text-[13px] font-semibold ${membresia.texto}`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${membresia.dot}`} aria-hidden="true" />
            <span className="truncate">{membresia.etiqueta}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

// Solo mobile: en escritorio lo reemplaza CatalogoEscritorio.
export function CatalogoListaMovil({ ligas }: { ligas: LigaCatalogo[] }) {
  return (
    <section id="ligas-movil" className="flex scroll-mt-6 flex-col gap-3 lg:hidden">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {ligas.length} {ligas.length === 1 ? "LIGA" : "LIGAS"}
        </p>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">
          Elegí dónde jugar
        </h2>
      </div>

      {ligas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-600">
          Todavía no hay ligas activas. Volvé a revisar más adelante.
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {ligas.map((liga) => (
            <FilaLiga key={liga.id} liga={liga} />
          ))}
        </Card>
      )}
    </section>
  );
}
