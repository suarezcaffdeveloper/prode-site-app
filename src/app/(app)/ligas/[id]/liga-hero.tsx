import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ClipboardList, Clock, Calendar, Ticket, type LucideIcon } from "lucide-react";
import { formatearPesos } from "@/lib/pozo";
import { Reveal } from "@/components/landing/reveal";
import { LogoLiga } from "@/components/ui/logo-liga";
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
  "group relative flex w-full items-center justify-between gap-2 overflow-hidden rounded-xl px-5 py-3.5 text-sm font-semibold tracking-tight transition-all lg:w-fit lg:justify-center lg:gap-4 lg:rounded-full lg:px-8 lg:py-4 lg:text-base";
const ctaPrimaria = `${ctaClase} bg-lime-400 text-pitch-900 hover:bg-lime-300 lg:hover:-translate-y-0.5 lg:hover:shadow-[0_14px_40px_rgba(163,230,53,0.45)]`;
const ctaSecundaria = `${ctaClase} bg-chalk-0/15 text-chalk-0 backdrop-blur hover:bg-chalk-0/25 lg:border lg:border-chalk-0/25 lg:hover:-translate-y-0.5`;

function Cta({
  href,
  icono: Icono,
  etiqueta,
  variante = "primaria",
}: {
  href: string;
  icono: LucideIcon;
  etiqueta: string;
  variante?: "primaria" | "secundaria";
}) {
  return (
    <Link href={href} className={variante === "primaria" ? ctaPrimaria : ctaSecundaria}>
      <span className="relative z-10 flex items-center gap-2">
        <Icono className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden="true" />
        {etiqueta}
      </span>
      <ArrowRight
        className="relative z-10 h-4 w-4 transition-transform duration-300 lg:h-5 lg:w-5 lg:group-hover:translate-x-1.5"
        aria-hidden="true"
      />
      {variante === "primaria" && (
        <span
          className="absolute inset-y-0 left-0 hidden w-1/3 animate-sheen bg-chalk-0/50 blur-md lg:block"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

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
    <div
      className={`flex min-w-0 flex-col gap-1 px-3 py-3 first:pl-4 last:pr-4 lg:gap-2 lg:px-7 lg:py-6 lg:first:pl-7 lg:last:pr-7 ${className}`}
    >
      <span className="font-mono text-[10px] font-semibold tracking-widest text-chalk-0/70 lg:text-[11px]">
        {etiqueta}
      </span>
      {children}
    </div>
  );
}

export function LigaHero({
  ligaId,
  nombre,
  descripcion,
  logoUrl,
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
  descripcion: string | null;
  logoUrl: string | null;
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
  const totalProdes = cargados + saldo;

  let cta: React.ReactNode;
  if (!membresia) {
    cta = <Cta href={`/ligas/${ligaId}/planes`} icono={Ticket} etiqueta="Elegir un plan" />;
  } else if (membresia === "pendiente") {
    cta = (
      <p
        className={`${ctaClase} bg-chalk-0/15 text-chalk-0 backdrop-blur lg:border lg:border-chalk-0/25`}
      >
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden="true" />
          Comprobante en revisión
        </span>
      </p>
    );
  } else if (membresia === "inactiva") {
    cta = <Cta href={`/ligas/${ligaId}/planes`} icono={Ticket} etiqueta="Reactivar suscripción" />;
  } else if (abierta && saldo > 0) {
    cta = (
      <Cta href={`/ligas/${ligaId}/pronosticos`} icono={ClipboardList} etiqueta="Cargar mis prodes" />
    );
  } else if (abierta && cargados > 0) {
    cta = (
      <Cta href={`/ligas/${ligaId}/pronosticos`} icono={ClipboardList} etiqueta="Ver mis prodes" />
    );
  } else if (abierta) {
    cta = <Cta href={`/ligas/${ligaId}/planes`} icono={Ticket} etiqueta="Comprar más prodes" />;
  } else {
    cta = (
      <Cta
        href={`/ligas/${ligaId}/partidos`}
        icono={Calendar}
        etiqueta="Ver fixture completo"
        variante="secundaria"
      />
    );
  }

  return (
    <section className="relative isolate flex min-h-80 flex-col justify-end gap-4 overflow-hidden rounded-2xl px-5 py-5 sm:min-h-96 sm:px-6 sm:py-6 lg:grid lg:min-h-[34rem] lg:grid-cols-[1.1fr_0.9fr] lg:grid-rows-[1fr_auto] lg:justify-normal lg:gap-x-12 lg:gap-y-8 lg:rounded-3xl lg:px-14 lg:py-14 xl:px-16">
      <Image
        src="/images/liga-hero-stadium.png"
        alt=""
        fill
        priority
        sizes="(min-width: 1280px) 1280px, (min-width: 1024px) 100vw, (min-width: 672px) 672px, 100vw"
        className="-z-30 object-cover lg:animate-kenburns"
      />
      <div className="absolute inset-0 -z-20 bg-gradient-to-t from-pitch-900 via-pitch-900/70 to-pitch-900/10 lg:bg-gradient-to-r lg:from-pitch-900 lg:via-pitch-900/75 lg:to-pitch-900/25" />

      {/* Solo escritorio: textura de cancha, luces que se mueven y círculo central. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 hidden opacity-60 lg:block"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(245,247,242,0.05) 0, rgba(245,247,242,0.05) 1px, transparent 1px, transparent 72px)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 top-10 -z-10 hidden h-96 w-96 animate-drift rounded-full bg-lime-400/20 blur-3xl lg:block"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 right-0 -z-10 hidden h-[28rem] w-[28rem] animate-drift rounded-full bg-pitch-500/40 blur-3xl [animation-delay:-8s] lg:block"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1 lg:justify-end lg:gap-6">
        {logoUrl && (
          <Reveal soloEscritorio>
            <LogoLiga
              url={logoUrl}
              nombre={nombre}
              className="h-16 w-16 rounded-2xl shadow-lg lg:h-24 lg:w-24 lg:rounded-3xl lg:p-2"
            />
          </Reveal>
        )}

        <Reveal soloEscritorio>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-chalk-0/20 bg-chalk-0/15 px-3 py-1 font-mono text-[11px] font-semibold tracking-widest text-chalk-0 backdrop-blur lg:gap-2.5 lg:px-4 lg:py-1.5">
            <span className="relative flex h-1.5 w-1.5 lg:h-2 lg:w-2">
              <span
                className={`absolute inset-0 hidden rounded-full lg:block ${badge.dot} ${abierta ? "animate-pulse-ring" : ""}`}
                aria-hidden="true"
              />
              <span
                className={`relative h-1.5 w-1.5 rounded-full lg:h-2 lg:w-2 ${badge.dot}`}
                aria-hidden="true"
              />
            </span>
            {badge.label(jornada).toUpperCase()}
          </span>
        </Reveal>

        <Reveal soloEscritorio retraso={100}>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-chalk-0 sm:text-4xl lg:text-5xl lg:leading-[1.05] xl:text-6xl">
            {nombre}
          </h1>
        </Reveal>

        {descripcion && (
          <Reveal soloEscritorio retraso={200} className="hidden lg:block">
            <p className="max-w-xl text-lg leading-relaxed text-chalk-100/75">{descripcion}</p>
          </Reveal>
        )}
      </div>

      <Reveal
        soloEscritorio
        variante="right"
        retraso={250}
        className="relative lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center"
      >
        {/* Círculo central de la cancha girando detrás del tablero. */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 lg:block"
          aria-hidden="true"
        >
          <div className="absolute inset-[10%] animate-spin-slow rounded-full border border-dashed border-chalk-0/25" />
          <div className="absolute inset-[24%] animate-spin-slow-reverse rounded-full border border-lime-400/25" />
        </div>

        <div className="relative grid grid-cols-3 divide-x divide-chalk-0/15 rounded-xl border border-chalk-0/15 bg-chalk-0/10 backdrop-blur lg:animate-float-slow lg:grid-cols-2 lg:divide-x-0 lg:rounded-3xl lg:border-chalk-0/20 lg:bg-pitch-900/50 lg:shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <Dato etiqueta="POZO" className="lg:col-span-2 lg:border-b lg:border-chalk-0/15">
            <span className="truncate font-display text-xl font-bold leading-tight text-lime-300 lg:text-5xl xl:text-6xl">
              {pozoTotal !== null ? formatearPesos(pozoTotal) : "—"}
            </span>
            <span className="hidden text-sm text-chalk-100/70 lg:block">
              Se lo lleva quien acierte todos los marcadores de la fecha.
            </span>
          </Dato>
          <Dato etiqueta="CIERRE" className="lg:border-r lg:border-chalk-0/15">
            {abierta && horaCierre ? (
              <CuentaRegresivaCierre horaCierre={horaCierre} variante="hero" />
            ) : (
              <span className="font-display text-xl font-bold leading-tight text-chalk-0 lg:text-3xl">
                {estadoJornada === "cerrada"
                  ? "Cerrada"
                  : estadoJornada === "bloqueada"
                    ? "Pendiente"
                    : "—"}
              </span>
            )}
          </Dato>
          <Dato etiqueta="TUS PRODES">
            <span className="font-display text-xl font-bold leading-tight text-chalk-0 lg:text-3xl">
              {activa ? cargados : "—"}
              {activa && abierta && (
                <span className="text-sm font-medium text-chalk-0/70"> de {totalProdes}</span>
              )}
            </span>
            {activa && abierta && totalProdes > 0 && (
              <span
                className="mt-1 hidden h-1.5 overflow-hidden rounded-full bg-chalk-0/15 lg:block"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-lime-400 transition-[width] duration-700"
                  style={{ width: `${Math.round((cargados / totalProdes) * 100)}%` }}
                />
              </span>
            )}
          </Dato>
        </div>
      </Reveal>

      <Reveal soloEscritorio retraso={300} className="lg:col-start-1 lg:row-start-2 lg:self-start">
        {cta}
      </Reveal>
    </section>
  );
}
