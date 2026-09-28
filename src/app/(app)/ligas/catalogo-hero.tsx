import Image from "next/image";
import { ArrowDown } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { NumeroAnimado } from "@/components/numero-animado";
import { PozoAnimado } from "@/components/pozo-animado";

export type ResumenCatalogo = {
  totalLigas: number;
  ligasSuscriptas: number;
  // Suma de los pozos de las fechas en curso; null si ninguna liga tiene fecha activa.
  pozoEnJuego: number | null;
};

const ctaClase =
  "group relative flex w-fit items-center justify-center gap-4 overflow-hidden rounded-full bg-lime-400 px-8 py-4 text-base font-semibold tracking-tight text-pitch-900 transition-all hover:-translate-y-0.5 hover:bg-lime-300 hover:shadow-[0_14px_40px_rgba(163,230,53,0.45)]";

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

// Solo escritorio: en mobile el catálogo conserva su encabezado simple.
export function CatalogoHero({ resumen }: { resumen: ResumenCatalogo }) {
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
              CATÁLOGO
            </span>
          </Reveal>

          <Reveal retraso={100}>
            <h1 className="font-display text-6xl font-bold leading-[1.05] tracking-tight text-chalk-0 xl:text-7xl">
              Ligas disponibles
            </h1>
          </Reveal>

          <Reveal retraso={200}>
            <p className="max-w-xl text-lg leading-relaxed text-chalk-100/75">
              Elegí una liga, suscribite y jugá el prode de cada fecha. Si acertás todos los
              marcadores, te llevás el pozo.
            </p>
          </Reveal>
        </div>

        {resumen.totalLigas > 0 && (
          <Reveal retraso={300}>
            <a href="#ligas" className={ctaClase}>
              <span className="relative z-10">Ver las ligas</span>
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
          <Dato etiqueta="POZO EN JUEGO" className="col-span-2 border-b border-chalk-0/15">
            {resumen.pozoEnJuego !== null ? (
              <PozoAnimado
                monto={resumen.pozoEnJuego}
                className="truncate font-display text-5xl font-bold leading-tight text-lime-300 xl:text-6xl"
              />
            ) : (
              <span className="font-display text-5xl font-bold leading-tight text-lime-300">—</span>
            )}
            <span className="text-sm text-chalk-100/70">
              {resumen.pozoEnJuego !== null
                ? "Sumando las fechas que se están jugando ahora."
                : "Ninguna liga tiene una fecha en juego por el momento."}
            </span>
          </Dato>

          <Dato etiqueta="LIGAS" className="border-r border-chalk-0/15">
            <NumeroAnimado
              valor={resumen.totalLigas}
              className="font-display text-3xl font-bold leading-tight text-chalk-0"
            />
          </Dato>

          <Dato etiqueta="TUS LIGAS">
            <NumeroAnimado
              valor={resumen.ligasSuscriptas}
              className="font-display text-3xl font-bold leading-tight text-chalk-0"
            />
            <span className="text-xs text-chalk-100/60">Con suscripción activa</span>
          </Dato>
        </div>
      </Reveal>
    </section>
  );
}
