import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario-actual";
import { LandingNav } from "@/components/landing/landing-nav";
import { Hero } from "@/components/landing/hero";
import { Marquee } from "@/components/landing/marquee";
import { ReglasEnNumeros } from "@/components/landing/reglas-en-numeros";
import { EncabezadoSeccion } from "@/components/landing/encabezado-seccion";
import { ComoFunciona } from "@/components/landing/como-funciona";
import { CalculadoraPozo } from "@/components/landing/calculadora-pozo";
import { Beneficios } from "@/components/landing/beneficios";
import { PlanesLanding } from "@/components/landing/planes-landing";
import { PreguntasFrecuentes } from "@/components/landing/preguntas-frecuentes";
import { CtaFinal, PieLanding } from "@/components/landing/cierre-y-pie";
import { Reveal } from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Prode — Pronósticos de fútbol con pozo por fecha",
  description:
    "Pronosticá el marcador exacto de cada fecha, jugá con tus amigos en subgrupos y competí por un pozo que crece con cada prode cargado.",
};

export default async function Home() {
  const usuario = await getUsuarioActual();

  if (usuario) redirect(usuario.rol === "admin" ? "/admin/ligas" : "/ligas");

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-chalk-50">
      <LandingNav />

      <main className="flex-1">
        <Hero />
        <Marquee />

        <section className="bg-chalk-0">
          <ReglasEnNumeros />
        </section>

        <section id="como-funciona" className="bg-chalk-50 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <EncabezadoSeccion
              etiqueta="CÓMO FUNCIONA"
              titulo="Tres pasos entre vos y el pozo"
              descripcion="Jugar es simple: elegís, pronosticás y esperás el pitazo final."
            />
            <Reveal>
              <ComoFunciona />
            </Reveal>
          </div>
        </section>

        <section id="pozo" className="relative isolate overflow-hidden bg-pitch-900 px-6 py-24">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-50"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(245,247,242,0.05) 0, rgba(245,247,242,0.05) 1px, transparent 1px, transparent 72px)",
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-32 top-1/3 -z-10 h-96 w-96 animate-drift rounded-full bg-lime-400/15 blur-3xl"
            aria-hidden="true"
          />
          <div className="mx-auto max-w-6xl">
            <EncabezadoSeccion
              invertido
              etiqueta="EL POZO"
              titulo="Mirá cuánto puede juntarse en una fecha"
              descripcion="Mové el simulador: el pozo es el 80% de lo recaudado y se reparte entre los prodes que aciertan todos los marcadores."
            />
            <Reveal variante="scale">
              <CalculadoraPozo />
            </Reveal>
            <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-chalk-100/50">
              Simulación ilustrativa con la regla de reparto vigente. Los montos reales dependen de
              los prodes que se jueguen en cada fecha.
            </p>
          </div>
        </section>

        <section id="beneficios" className="bg-chalk-50 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Beneficios />
          </div>
        </section>

        <section id="planes" className="bg-chalk-100/60 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <PlanesLanding />
          </div>
        </section>

        <section id="preguntas" className="bg-chalk-50 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <EncabezadoSeccion
              etiqueta="PREGUNTAS FRECUENTES"
              titulo="Lo que todos preguntan antes de jugar"
            />
            <Reveal>
              <PreguntasFrecuentes />
            </Reveal>
          </div>
        </section>

        <CtaFinal />
      </main>

      <PieLanding />
    </div>
  );
}
