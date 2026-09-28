import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";

type EstadoJornada = "abierta" | "cerrada" | "bloqueada" | "sin_jornada";

const badgeConfig: Record<EstadoJornada, { dot: string; label: (jornada: number | null) => string }> = {
  abierta: { dot: "bg-lime-400", label: (jornada) => `En curso · Fecha ${jornada}` },
  cerrada: { dot: "bg-chalk-0/60", label: (jornada) => `Cerrada · Fecha ${jornada}` },
  bloqueada: { dot: "bg-coral-500", label: (jornada) => `Bloqueada · Fecha ${jornada}` },
  sin_jornada: { dot: "bg-chalk-0/60", label: () => "Sin jornada activa" },
};

export function LigaHero({
  liga,
  ligaId,
  jornada,
  estadoJornada,
}: {
  liga: { nombre: string };
  ligaId: string;
  jornada: number | null;
  estadoJornada: EstadoJornada;
}) {
  const badge = badgeConfig[estadoJornada];

  return (
    <div className="relative isolate flex h-64 flex-col justify-end overflow-hidden rounded-2xl px-5 py-5 sm:h-72">
      <Image
        src="/images/liga-hero-stadium.png"
        alt=""
        fill
        priority
        sizes="(min-width: 640px) 640px, 100vw"
        className="-z-10 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-pitch-900/95 via-pitch-900/50 to-pitch-900/10" />

      <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-chalk-0/20 bg-chalk-0/15 px-3 py-1 font-mono text-[11px] font-semibold tracking-widest text-chalk-0 backdrop-blur">
        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />
        {badge.label(jornada).toUpperCase()}
      </span>

      <h1 className="mb-4 font-display text-2xl font-bold leading-tight tracking-tight text-chalk-0 sm:text-3xl">
        {liga.nombre}
      </h1>

      <Link
        href={`/ligas/${ligaId}/partidos`}
        className="flex w-full items-center justify-between gap-2 rounded-xl bg-pitch-700 px-5 py-3 text-sm font-semibold tracking-tight text-chalk-0 transition-colors hover:bg-pitch-600"
      >
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          Ver fixture completo
        </span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
