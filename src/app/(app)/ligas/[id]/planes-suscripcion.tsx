"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, MoveHorizontal, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PLANES,
  ahorroVsSuelto,
  formatearPrecio,
  obtenerPlan,
  precioPorProde,
  type Plan,
} from "@/lib/planes";
import { formatearPesos } from "@/lib/pozo";
import { CheckoutPlan, type CuentaCobro } from "./checkout-plan";
import type { SolicitudVista } from "./pago-actions";

export function PlanesSuscripcion({
  ligaId,
  recompra = false,
  cuenta,
  solicitudAbierta,
}: {
  ligaId: string;
  recompra?: boolean;
  cuenta: CuentaCobro | null;
  // Pago iniciado (monto reservado) que todavía no recibió comprobante.
  solicitudAbierta: SolicitudVista | null;
}) {
  const [planSeleccionado, setPlanSeleccionado] = useState<Plan | null>(null);
  const planPendiente = solicitudAbierta ? obtenerPlan(solicitudAbierta.planSlug) : undefined;
  const [indiceVisible, setIndiceVisible] = useState(() => {
    const indiceRecomendado = PLANES.findIndex((plan) => plan.recomendado);
    return indiceRecomendado >= 0 ? indiceRecomendado : 0;
  });
  const cerrarCheckout = useCallback(() => setPlanSeleccionado(null), []);
  const carruselRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    cardRefs.current[indiceVisible]?.scrollIntoView({
      inline: "center",
      block: "nearest",
    });
    // Solo se ejecuta al montar, para centrar el plan recomendado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function manejarScroll() {
    const contenedor = carruselRef.current;
    if (!contenedor) return;

    let indiceCercano = 0;
    let distanciaMinima = Infinity;
    const centroContenedor = contenedor.scrollLeft + contenedor.clientWidth / 2;

    cardRefs.current.forEach((card, indice) => {
      if (!card) return;
      const centroCard = card.offsetLeft + card.offsetWidth / 2;
      const distancia = Math.abs(centroCard - centroContenedor);
      if (distancia < distanciaMinima) {
        distanciaMinima = distancia;
        indiceCercano = indice;
      }
    });

    setIndiceVisible(indiceCercano);
  }

  return (
    <div id="planes" className="flex scroll-mt-40 flex-col gap-4 lg:gap-8">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {recompra ? "MÁS PRODES" : "SUSCRIPCIÓN"}
        </p>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink-900 lg:text-3xl">
          {recompra ? "Sumá más prodes" : "Elegí tu plan"}
        </h2>
        <p className="mt-1 text-sm text-ink-600 lg:mt-2 lg:text-base">
          {recompra
            ? "Podés comprar cuando quieras, incluso el mismo plan otra vez. Los prodes nuevos se suman a tu saldo y cada compra vence a los 30 días."
            : "Cada plan te da prodes para jugar en las próximas fechas."}
        </p>
      </div>

      {solicitudAbierta && planPendiente && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pitch-500/40 bg-lime-400/15 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">Tenés un pago iniciado</p>
            <p className="text-sm text-ink-600">
              {planPendiente.nombre} · transferí {formatearPesos(solicitudAbierta.montoATransferir)} y
              subí el comprobante.
            </p>
          </div>
          <Button type="button" onClick={() => setPlanSeleccionado(planPendiente)}>
            Continuar mi pago
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between font-mono text-[11px] font-semibold tracking-widest lg:hidden">
        <span className="flex items-center gap-1.5 text-pitch-600">
          <MoveHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          DESLIZÁ PARA COMPARAR
        </span>
        <span className="text-ink-400">{PLANES.length} PLANES DISPONIBLES</span>
      </div>

      <div
        ref={carruselRef}
        onScroll={manejarScroll}
        className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:px-[7%] lg:mx-0 lg:grid lg:snap-none lg:grid-cols-3 lg:items-stretch lg:gap-8 lg:overflow-visible lg:px-0 lg:pb-0 lg:pt-4 [&::-webkit-scrollbar]:hidden"
      >
        {PLANES.map((plan, indice) => {
          const ahorro = ahorroVsSuelto(plan);
          const destacado = plan.recomendado === true;
          return (
            <Card
              key={plan.slug}
              ref={(elemento) => {
                cardRefs.current[indice] = elemento;
              }}
              style={{ animationDelay: `${indice * 120}ms` }}
              className={`relative flex w-[78%] shrink-0 snap-center flex-col gap-4 p-6 sm:w-[320px] lg:w-auto lg:animate-pop-in lg:gap-6 lg:overflow-hidden lg:rounded-3xl lg:p-8 lg:transition-all lg:duration-300 ${
                destacado
                  ? "border-2 border-pitch-500 lg:-translate-y-4 lg:border-pitch-900 lg:bg-pitch-900 lg:shadow-[0_30px_70px_rgba(11,31,20,0.35)] lg:hover:-translate-y-6"
                  : "lg:hover:-translate-y-2 lg:hover:border-pitch-500 lg:hover:shadow-[0_20px_44px_rgba(16,36,26,0.12)]"
              }`}
            >
              {destacado && (
                <>
                  {/* Solo escritorio: luz que se mueve y textura de cancha detrás del plan recomendado. */}
                  <div
                    className="pointer-events-none absolute -right-16 -top-16 hidden h-64 w-64 animate-drift rounded-full bg-lime-400/25 blur-3xl lg:block"
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 hidden opacity-60 lg:block"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, rgba(245,247,242,0.05) 0, rgba(245,247,242,0.05) 1px, transparent 1px, transparent 72px)",
                    }}
                    aria-hidden="true"
                  />
                  <span className="absolute right-4 top-4 inline-flex items-center rounded-full bg-pitch-700 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-widest text-lime-300 lg:right-6 lg:top-6 lg:bg-lime-400 lg:text-pitch-900">
                    MÁS POPULAR
                  </span>
                </>
              )}
              <div className="relative">
                {destacado && (
                  <p className="mb-1 font-mono text-[11px] font-semibold tracking-widest text-pitch-600 lg:hidden">
                    RECOMENDADO
                  </p>
                )}
                <p
                  className={`text-sm font-semibold text-ink-900 lg:text-base ${
                    destacado ? "lg:text-chalk-0" : ""
                  }`}
                >
                  {plan.nombre}
                </p>
                <p
                  className={`mt-1 font-display text-2xl font-bold tracking-tight text-ink-900 lg:mt-3 lg:text-5xl ${
                    destacado ? "lg:text-lime-300" : "lg:text-pitch-700"
                  }`}
                >
                  {formatearPrecio(plan.precio)}
                </p>
                <p
                  className={`text-xs text-ink-400 lg:mt-1 lg:text-sm ${
                    destacado ? "lg:text-chalk-0/60" : ""
                  }`}
                >
                  {plan.tipo === "unico" ? "Pago único" : "Por mes"}
                </p>
                <div className="mt-4 hidden flex-wrap items-center gap-2 lg:flex">
                  <span
                    className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest ${
                      destacado ? "bg-chalk-0/10 text-chalk-0" : "bg-chalk-100 text-ink-600"
                    }`}
                  >
                    {formatearPrecio(Math.round(precioPorProde(plan)))} POR PRODE
                  </span>
                  {ahorro !== null && (
                    <span
                      className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest ${
                        destacado ? "bg-lime-400 text-pitch-900" : "bg-lime-400/25 text-pitch-700"
                      }`}
                    >
                      AHORRÁS {ahorro}%
                    </span>
                  )}
                </div>
              </div>
              <ul
                className={`relative flex flex-1 flex-col gap-2 text-sm text-ink-600 lg:gap-3.5 lg:border-t lg:pt-6 lg:text-[15px] ${
                  destacado ? "lg:border-chalk-0/15 lg:text-chalk-100/80" : "lg:border-line"
                }`}
              >
                {plan.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 lg:gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-lime-400/25 text-pitch-700 lg:h-5 lg:w-5 ${
                        destacado ? "lg:bg-lime-400 lg:text-pitch-900" : ""
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant={destacado ? "primary" : "secondary"}
                onClick={() => setPlanSeleccionado(plan)}
                className={`relative justify-center overflow-hidden lg:rounded-full lg:py-3.5 lg:text-base lg:transition-all lg:hover:-translate-y-0.5 ${
                  destacado
                    ? "lg:bg-lime-400 lg:text-pitch-900 lg:hover:bg-lime-300 lg:hover:shadow-[0_14px_40px_rgba(163,230,53,0.45)]"
                    : "lg:hover:shadow-[0_10px_24px_rgba(16,36,26,0.1)]"
                }`}
              >
                {destacado ? (
                  <>
                    <span className="relative z-10 flex items-center gap-2">
                      Suscribirme <Zap className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span
                      className="absolute inset-y-0 left-0 hidden w-1/3 animate-sheen bg-chalk-0/50 blur-md lg:block"
                      aria-hidden="true"
                    />
                  </>
                ) : (
                  "Elegir este plan"
                )}
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-1.5 lg:hidden">
        {PLANES.map((plan, indice) => (
          <span
            key={plan.slug}
            className={`h-1.5 rounded-full transition-all ${
              indice === indiceVisible ? "w-4 bg-pitch-700" : "w-1.5 bg-line-strong"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      {planSeleccionado && (
        <CheckoutPlan
          key={planSeleccionado.slug}
          ligaId={ligaId}
          plan={planSeleccionado}
          cuenta={cuenta}
          solicitudInicial={
            solicitudAbierta && solicitudAbierta.planSlug === planSeleccionado.slug
              ? solicitudAbierta
              : null
          }
          onClose={cerrarCheckout}
        />
      )}
    </div>
  );
}
