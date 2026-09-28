import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ClipboardList, Clock, Calendar, Ticket } from "lucide-react";
import { formatearPesos } from "@/lib/pozo";
import { CuentaRegresivaCierre } from "./pronosticos/cuenta-regresiva";

export type EstadoJornada = "abierta" | "cerrada" | "bloqueada" | "sin_jornada";
export type EstadoMembresia = "pendiente" | "activa" | "inactiva" | null;

const badgeConfig: Record<EstadoJornada, { dot: string; label: (jornada: number | null) => string }> = {
  abierta: { dot: "bg-lime-400", label: (jornada) => `En curso · Fecha ${jornada}` },
  cerrada: { dot: "bg-chalk-0/60", label: (jornada) => `Cerrada · Fecha ${jornada}` },
  bloqueada: { dot: "bg-coral-500", label: (jornada) => `Bloqueada · Fecha ${jornada}` },
  sin_jornada: { dot: "bg-chalk-0/60", label: () => "Sin jornada activa" },
};

const ctaClase =
  "flex w-full items-center justify-between gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold tracking-tight transition-colors";
const ctaPrimaria = `${ctaClase} bg-lime-400 text-pitch-900 hover:bg-lime-300`;
const ctaSecundaria = `${ctaClase} bg-chalk-0/15 text-chalk-0 backdrop-blur hover:bg-chalk-0/25`;

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-3 py-3 first:pl-4 last:pr-4">
      <span className="font-mono text-[10px] font-semibold tracking-widest text-chalk-0/70">
        {etiqueta}
      </span>
      {children}
    </div>
  );
}

export function LigaHero({
  ligaId,
  nombre,
  jornada,
  estadoJornada,
  horaCierre,
  pozoTotal,
  membresia,
  saldo,
  cargados,
}: {
  ligaId: string;
  nombre: string;
  jornada: number | null;
  estadoJornada: EstadoJornada;
  horaCierre: string | null;
  pozoTotal: number | null;
  membresia: EstadoMembresia;
  saldo: number;
  cargados: number;
}) {
  const badge = badgeConfig[estadoJornada];
  const activa = membresia === "activa";
  const abierta = estadoJornada === "abierta";

  let cta: React.ReactNode;
  if (!membresia) {
    cta = (
      <Link href={`/ligas/${ligaId}/planes`} className={ctaPrimaria}>
        <span className="flex items-center gap-2">
          <Ticket className="h-4 w-4" aria-hidden="true" />
          Elegir un plan
        </span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  } else if (membresia === "pendiente") {
    cta = (
      <p className={`${ctaClase} bg-chalk-0/15 text-chalk-0 backdrop-blur`}>
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4" aria-hidden="true" />
          Comprobante en revisión
        </span>
      </p>
    );
  } else if (membresia === "inactiva") {
    cta = (
      <Link href={`/ligas/${ligaId}/planes`} className={ctaPrimaria}>
        <span className="flex items-center gap-2">
          <Ticket className="h-4 w-4" aria-hidden="true" />
          Reactivar suscripción
        </span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  } else if (abierta && saldo > 0) {
    cta = (
      <Link href={`/ligas/${ligaId}/pronosticos`} className={ctaPrimaria}>
        <span className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Cargar mis prodes
        </span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  } else if (abierta && cargados > 0) {
    cta = (
      <Link href={`/ligas/${ligaId}/pronosticos`} className={ctaPrimaria}>
        <span className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Ver mis prodes
        </span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  } else if (abierta) {
    cta = (
      <Link href={`/ligas/${ligaId}/planes`} className={ctaPrimaria}>
        <span className="flex items-center gap-2">
          <Ticket className="h-4 w-4" aria-hidden="true" />
          Comprar más prodes
        </span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  } else {
    cta = (
      <Link href={`/ligas/${ligaId}/partidos`} className={ctaSecundaria}>
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          Ver fixture completo
        </span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <section className="relative isolate flex min-h-80 flex-col justify-end gap-4 overflow-hidden rounded-2xl px-5 py-5 sm:min-h-96 sm:px-6 sm:py-6">
      <Image
        src="/images/liga-hero-stadium.png"
        alt=""
        fill
        priority
        sizes="(min-width: 672px) 672px, 100vw"
        className="-z-10 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-pitch-900 via-pitch-900/70 to-pitch-900/10" />

      <div className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-chalk-0/20 bg-chalk-0/15 px-3 py-1 font-mono text-[11px] font-semibold tracking-widest text-chalk-0 backdrop-blur">
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />
          {badge.label(jornada).toUpperCase()}
        </span>

        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-chalk-0 sm:text-4xl">
          {nombre}
        </h1>
      </div>

      <div className="grid grid-cols-3 divide-x divide-chalk-0/15 rounded-xl border border-chalk-0/15 bg-chalk-0/10 backdrop-blur">
        <Dato etiqueta="POZO">
          <span className="truncate font-display text-xl font-bold leading-tight text-lime-300">
            {pozoTotal !== null ? formatearPesos(pozoTotal) : "—"}
          </span>
        </Dato>
        <Dato etiqueta="CIERRE">
          {abierta && horaCierre ? (
            <CuentaRegresivaCierre horaCierre={horaCierre} variante="hero" />
          ) : (
            <span className="font-display text-xl font-bold leading-tight text-chalk-0">
              {estadoJornada === "cerrada"
                ? "Cerrada"
                : estadoJornada === "bloqueada"
                  ? "Pendiente"
                  : "—"}
            </span>
          )}
        </Dato>
        <Dato etiqueta="TUS PRODES">
          <span className="font-display text-xl font-bold leading-tight text-chalk-0">
            {activa ? cargados : "—"}
            {activa && abierta && (
              <span className="text-sm font-medium text-chalk-0/70"> de {cargados + saldo}</span>
            )}
          </span>
        </Dato>
      </div>

      {cta}
    </section>
  );
}
