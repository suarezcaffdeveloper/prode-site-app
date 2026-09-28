import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, Layers, Percent, Repeat, Ticket } from "lucide-react";
import { PLANES } from "@/lib/planes";
import { formatearPesos } from "@/lib/pozo";
import { HeroCarton } from "./hero-carton";
import { TextoRotativo } from "./texto-rotativo";
import { Reveal } from "./reveal";

const precioMinimoPorProde = Math.min(...PLANES.map((p) => p.precio / p.cantidadCreditos));

const CONFIANZA = [
  { icono: Percent, texto: "80% del recaudado al pozo" },
  { icono: Repeat, texto: "Si nadie acierta, el pozo se acumula" },
  { icono: Layers, texto: "Subgrupos con tus amigos" },
  { icono: Ticket, texto: `Desde ${formatearPesos(precioMinimoPorProde)} por prode` },
];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-pitch-900 text-chalk-0">
      <Image
        src="/images/liga-hero-stadium.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-30 animate-kenburns object-cover opacity-40"
      />
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-pitch-900/70 via-pitch-900/85 to-pitch-900" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(245,247,242,0.05) 0, rgba(245,247,242,0.05) 1px, transparent 1px, transparent 72px)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 top-10 -z-10 h-96 w-96 animate-drift rounded-full bg-lime-400/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 -z-10 h-[28rem] w-[28rem] animate-drift rounded-full bg-pitch-500/40 blur-3xl [animation-delay:-8s]"
        aria-hidden="true"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-28 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pt-36">
        <div className="flex flex-col gap-7">
          <Reveal>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-chalk-0/15 bg-chalk-0/10 px-4 py-1.5 font-mono text-[11px] font-semibold tracking-widest text-chalk-0 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inset-0 animate-pulse-ring rounded-full bg-lime-400"
                  aria-hidden="true"
                />
                <span className="relative h-2 w-2 rounded-full bg-lime-400" aria-hidden="true" />
              </span>
              PRODE DE FÚTBOL · POZO POR FECHA
            </span>
          </Reveal>

          <Reveal retraso={100}>
            <h1 className="font-display text-4xl font-bold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
              Acertá el marcador de la fecha y{" "}
              <span className="animate-gradient bg-gradient-to-r from-lime-300 via-chalk-0 to-lime-300 bg-[length:200%_auto] bg-clip-text text-transparent">
                llevate el pozo.
              </span>
            </h1>
          </Reveal>

          <Reveal retraso={200}>
            <p className="max-w-xl text-lg leading-relaxed text-chalk-100/75">
              Cargá tus pronósticos de cada jornada, jugá con{" "}
              <span className="font-semibold text-lime-300">
                <TextoRotativo
                  palabras={["tus amigos", "tu familia", "tus compañeros", "toda la liga"]}
                />
              </span>{" "}
              y competí por un pozo que crece con cada prode cargado.
            </p>
          </Reveal>

          <Reveal retraso={300} className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/registro"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-lime-400 px-7 py-4 text-base font-semibold text-pitch-900 transition-all hover:-translate-y-0.5 hover:bg-lime-300 hover:shadow-[0_14px_40px_rgba(163,230,53,0.45)]"
            >
              <span className="relative z-10">Crear mi cuenta</span>
              <ArrowRight
                className="relative z-10 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5"
                aria-hidden="true"
              />
              <span
                className="absolute inset-y-0 left-0 w-1/3 animate-sheen bg-chalk-0/50 blur-md"
                aria-hidden="true"
              />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-chalk-0/25 bg-chalk-0/5 px-7 py-4 text-base font-semibold text-chalk-0 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-chalk-0/50 hover:bg-chalk-0/15"
            >
              Ver cómo funciona
            </a>
          </Reveal>

          <Reveal retraso={400}>
            <ul className="grid gap-x-6 gap-y-3 pt-2 sm:grid-cols-2">
              {CONFIANZA.map(({ icono: Icono, texto }) => (
                <li key={texto} className="group flex items-center gap-3 text-sm text-chalk-100/80">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-lime-300 transition-all duration-300 group-hover:scale-110 group-hover:bg-lime-400 group-hover:text-pitch-900">
                    <Icono className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {texto}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal variante="right" retraso={250}>
          <HeroCarton />
        </Reveal>
      </div>

      <a
        href="#como-funciona"
        aria-label="Bajar a la siguiente sección"
        className="absolute inset-x-0 bottom-6 mx-auto hidden w-fit animate-bounce-soft text-chalk-0/70 hover:text-lime-300 lg:block"
      >
        <ChevronDown className="h-7 w-7" />
      </a>
    </section>
  );
}
