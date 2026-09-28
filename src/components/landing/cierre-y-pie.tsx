import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Reveal } from "./reveal";

export function CtaFinal() {
  return (
    <section className="relative isolate overflow-hidden bg-pitch-900 text-chalk-0">
      <Image
        src="/images/liga-hero-stadium.png"
        alt=""
        fill
        sizes="100vw"
        className="-z-30 animate-kenburns object-cover opacity-25"
      />
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-pitch-900 via-pitch-900/80 to-pitch-900" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 animate-drift rounded-full bg-lime-400/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 py-24 text-center sm:py-32">
        <Reveal className="flex flex-col items-center gap-4">
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-lime-400">
            LA PRÓXIMA FECHA EMPIEZA ACÁ
          </p>
          <h2 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Armá tu prode antes del pitazo inicial.
          </h2>
          <p className="max-w-xl text-lg leading-relaxed text-chalk-100/70">
            Creá tu cuenta en un minuto, elegí tu liga y cargá tus marcadores. El pozo de la fecha te
            está esperando.
          </p>
        </Reveal>

        <Reveal retraso={150} className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/registro"
            className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-lime-400 px-8 py-4 text-base font-semibold text-pitch-900 transition-all hover:-translate-y-0.5 hover:bg-lime-300 hover:shadow-[0_14px_40px_rgba(163,230,53,0.45)]"
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
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-chalk-0/25 bg-chalk-0/5 px-8 py-4 text-base font-semibold text-chalk-0 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-chalk-0/50 hover:bg-chalk-0/15"
          >
            Ya tengo cuenta
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export function PieLanding() {
  return (
    <footer className="bg-pitch-900 text-chalk-100/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 border-t border-chalk-0/10 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3">
          <Logo inverted />
          <p className="max-w-sm text-sm leading-relaxed">
            Pronósticos de fútbol con pozo por fecha, para jugar solo o con tus amigos.
          </p>
        </div>

        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[
            { href: "#como-funciona", etiqueta: "Cómo funciona" },
            { href: "#pozo", etiqueta: "El pozo" },
            { href: "#planes", etiqueta: "Planes" },
            { href: "#preguntas", etiqueta: "Preguntas" },
          ].map((enlace) => (
            <a
              key={enlace.href}
              href={enlace.href}
              className="transition-colors hover:text-lime-300"
            >
              {enlace.etiqueta}
            </a>
          ))}
          <Link href="/login" className="transition-colors hover:text-lime-300">
            Ingresar
          </Link>
        </nav>
      </div>
      <div className="border-t border-chalk-0/10 px-6 py-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-chalk-100/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Prode. Todos los derechos reservados.</p>
          <p>Solo para mayores de 18 años. Jugá con responsabilidad.</p>
        </div>
      </div>
    </footer>
  );
}
