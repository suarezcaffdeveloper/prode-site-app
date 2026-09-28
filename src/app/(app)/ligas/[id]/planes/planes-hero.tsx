import Image from "next/image";
import { ArrowDown } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

export type EstadoMembresiaHero = "pendiente" | "activa" | "inactiva" | null;

export type DatoHero = { etiqueta: string; valor: string; detalle?: string };

const ESTADO: Record<
  NonNullable<EstadoMembresiaHero> | "sin_plan",
  { etiqueta: string; dot: string; texto: string; detalle: string }
> = {
  sin_plan: {
    etiqueta: "SIN PLAN",
    dot: "bg-chalk-0/60",
    texto: "text-chalk-0",
    detalle: "Elegí un plan para empezar a pronosticar en esta liga.",
  },
  pendiente: {
    etiqueta: "PENDIENTE",
    dot: "bg-amber-500",
    texto: "text-amber-500",
    detalle:
      "Recibimos tu comprobante y lo estamos revisando. En cuanto lo confirmemos, tu suscripción pasa a activa.",
  },
  activa: {
    etiqueta: "ACTIVA",
    dot: "bg-lime-400",
    texto: "text-lime-400",
    detalle: "Ya podés cargar tus pronósticos y crear o unirte a subgrupos.",
  },
  inactiva: {
    etiqueta: "INACTIVA",
    dot: "bg-coral-500",
    texto: "text-coral-500",
    detalle: "Elegí un plan de nuevo y subí el comprobante para reactivar tu suscripción.",
  },
};

const SUBTITULO: Record<NonNullable<EstadoMembresiaHero> | "sin_plan", string> = {
  sin_plan: "Elegí cuántos prodes querés jugar y suscribite en un par de minutos.",
  pendiente: "Estamos revisando tu comprobante. Mientras tanto, podés comparar los planes.",
  activa: "Tu suscripción está activa. Armá subgrupos para competir con tus amigos.",
  inactiva: "Reactivá tu suscripción eligiendo un plan y subiendo el comprobante.",
};

const ctaClase =
  "group relative flex w-fit items-center justify-center gap-4 overflow-hidden rounded-full px-8 py-4 text-base font-semibold tracking-tight transition-all hover:-translate-y-0.5 bg-lime-400 text-pitch-900 hover:bg-lime-300 hover:shadow-[0_14px_40px_rgba(163,230,53,0.45)]";

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

// Solo escritorio: en mobile Planes conserva su encabezado y tarjeta de suscripción.
export function PlanesHero({
  ligaNombre,
  membresia,
  cta,
  datos,
}: {
  ligaNombre: string;
  membresia: EstadoMembresiaHero;
  cta: { href: string; etiqueta: string } | null;
  datos: DatoHero[];
}) {
  const clave = membresia ?? "sin_plan";
  const estado = ESTADO[clave];

  return (
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
            <span className="font-mono text-xs font-semibold tracking-[0.3em] text-lime-300/80">
              {ligaNombre.toUpperCase()}
            </span>
          </Reveal>

          <Reveal retraso={100}>
            <h1 className="font-display text-6xl font-bold leading-[1.05] tracking-tight text-chalk-0 xl:text-7xl">
              Planes
            </h1>
          </Reveal>

          <Reveal retraso={200}>
            <p className="max-w-xl text-lg leading-relaxed text-chalk-100/75">
              {SUBTITULO[clave]}
            </p>
          </Reveal>
        </div>

        {cta && (
          <Reveal retraso={300}>
            <a href={cta.href} className={ctaClase}>
              <span className="relative z-10">{cta.etiqueta}</span>
              <ArrowDown
                className="relative z-10 h-5 w-5 transition-transform duration-300 group-hover:translate-y-1"
                aria-hidden="true"
              />
              <span
                className="absolute inset-y-0 left-0 w-1/3 animate-sheen bg-chalk-0/50 blur-md"
                aria-hidden="true"
              />
            </a>
          </Reveal>
        )}
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
          <Dato etiqueta="TU SUSCRIPCIÓN" className="col-span-2 border-b border-chalk-0/15">
            <span className="inline-flex w-fit items-center gap-2.5 rounded-md bg-pitch-900 px-3 py-1.5 font-mono text-sm font-semibold tracking-widest">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                {membresia === "activa" && (
                  <span className={`absolute inset-0 animate-pulse-ring rounded-full ${estado.dot}`} />
                )}
                <span className={`relative h-2 w-2 rounded-full ${estado.dot}`} />
              </span>
              <span className={estado.texto}>{estado.etiqueta}</span>
            </span>
            <span className="text-sm leading-relaxed text-chalk-100/70">{estado.detalle}</span>
          </Dato>

          {datos.map((dato, indice) => (
            <Dato
              key={dato.etiqueta}
              etiqueta={dato.etiqueta}
              className={
                datos.length === 1
                  ? "col-span-2"
                  : indice === 0
                    ? "border-r border-chalk-0/15"
                    : ""
              }
            >
              <span className="font-display text-3xl font-bold leading-tight text-chalk-0">
                {dato.valor}
              </span>
              {dato.detalle && <span className="text-xs text-chalk-100/60">{dato.detalle}</span>}
            </Dato>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
