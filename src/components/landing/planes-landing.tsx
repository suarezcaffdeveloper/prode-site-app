import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PLANES } from "@/lib/planes";
import { formatearPesos } from "@/lib/pozo";
import { EncabezadoSeccion } from "./encabezado-seccion";
import { Reveal } from "./reveal";

export function PlanesLanding() {
  return (
    <div>
      <EncabezadoSeccion
        etiqueta="PLANES"
        titulo="Elegí cuántos prodes querés jugar"
        descripcion="Empezá con uno suelto o suscribite a un plan mensual. Cuantos más prodes, menos pagás por cada uno."
      />

      <div className="-mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-6 pt-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
        {PLANES.map((plan, i) => {
          const destacado = Boolean(plan.recomendado);
          const porProde = plan.precio / plan.cantidadCreditos;

          return (
            <Reveal
              key={plan.slug}
              retraso={i * 110}
              className="min-w-[82%] snap-center sm:min-w-[60%] md:min-w-0"
            >
              <article
                className={`group relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl border p-7 transition-all duration-300 hover:-translate-y-2 ${
                  destacado
                    ? "border-lime-400 bg-pitch-900 text-chalk-0 shadow-[0_30px_70px_rgba(11,31,20,0.35)] hover:shadow-[0_40px_90px_rgba(11,31,20,0.45)] md:-mt-4 md:pb-11 md:pt-11"
                    : "border-line bg-chalk-0 text-ink-900 hover:border-pitch-500/50 hover:shadow-[0_24px_60px_rgba(20,83,45,0.14)]"
                }`}
              >
                {destacado && (
                  <>
                    <span className="absolute right-5 top-5 rounded-full bg-lime-400 px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-pitch-900">
                      RECOMENDADO
                    </span>
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-sheen bg-chalk-0/10 blur-md"
                      aria-hidden="true"
                    />
                  </>
                )}

                <div className="relative flex flex-col gap-1">
                  <p
                    className={`font-mono text-[11px] font-semibold tracking-widest ${
                      destacado ? "text-lime-300" : "text-pitch-600"
                    }`}
                  >
                    {plan.tipo === "mensual" ? "SUSCRIPCIÓN MENSUAL" : "COMPRA SUELTA"}
                  </p>
                  <h3 className="font-display text-2xl font-bold tracking-tight">{plan.nombre}</h3>
                </div>

                <div className="relative">
                  <p className="font-display text-5xl font-bold tabular-nums tracking-tight">
                    {formatearPesos(plan.precio)}
                  </p>
                  <p className={`mt-1 text-sm ${destacado ? "text-chalk-100/70" : "text-ink-600"}`}>
                    {plan.tipo === "mensual" ? "por mes" : "pago único"} ·{" "}
                    <strong className="font-semibold">{formatearPesos(Math.round(porProde))}</strong> por prode
                  </p>
                </div>

                <ul className="relative flex flex-1 flex-col gap-3">
                  {plan.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className={`flex items-start gap-3 text-sm leading-snug ${
                        destacado ? "text-chalk-100/85" : "text-ink-600"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 ${
                          destacado ? "bg-lime-400 text-pitch-900" : "bg-lime-400/30 text-pitch-700"
                        }`}
                      >
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/registro"
                  className={`group/boton relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-all ${
                    destacado
                      ? "bg-lime-400 text-pitch-900 hover:bg-lime-300 hover:shadow-[0_10px_30px_rgba(163,230,53,0.4)]"
                      : "bg-pitch-900 text-chalk-0 hover:bg-pitch-700"
                  }`}
                >
                  Empezar con este plan
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover/boton:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </article>
            </Reveal>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-ink-600">
        Creás tu cuenta gratis y elegís tu plan dentro de la liga en la que quieras jugar.
      </p>
    </div>
  );
}
