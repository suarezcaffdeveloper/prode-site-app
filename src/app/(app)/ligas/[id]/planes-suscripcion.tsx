"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, MoveHorizontal, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PLANES, type Plan } from "@/lib/planes";
import { elegirPlan } from "./actions";

const ALIAS_TRANSFERENCIA = "prode.pagos";
const TITULAR_TRANSFERENCIA = "Prode App S.R.L. (alias de ejemplo)";

function formatearPrecio(precio: number) {
  return precio.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export function PlanesSuscripcion({ ligaId }: { ligaId: string }) {
  const [planSeleccionado, setPlanSeleccionado] = useState<Plan | null>(null);
  const [indiceVisible, setIndiceVisible] = useState(() => {
    const indiceRecomendado = PLANES.findIndex((plan) => plan.recomendado);
    return indiceRecomendado >= 0 ? indiceRecomendado : 0;
  });
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
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          SUSCRIPCIÓN
        </p>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">
          Elegí tu plan
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Cada plan te da prodes para jugar en las próximas fechas.
        </p>
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] font-semibold tracking-widest">
        <span className="flex items-center gap-1.5 text-pitch-600">
          <MoveHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          DESLIZÁ PARA COMPARAR
        </span>
        <span className="text-ink-400">{PLANES.length} PLANES DISPONIBLES</span>
      </div>

      <div
        ref={carruselRef}
        onScroll={manejarScroll}
        className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:px-[7%] [&::-webkit-scrollbar]:hidden"
      >
        {PLANES.map((plan, indice) => (
          <Card
            key={plan.slug}
            ref={(elemento) => {
              cardRefs.current[indice] = elemento;
            }}
            className={`relative flex w-[78%] shrink-0 snap-center flex-col gap-4 p-6 sm:w-[320px] ${
              plan.recomendado ? "border-2 border-pitch-500" : ""
            }`}
          >
            {plan.recomendado && (
              <span className="absolute right-4 top-4 inline-flex items-center rounded-full bg-pitch-700 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-widest text-lime-300">
                MÁS POPULAR
              </span>
            )}
            <div>
              {plan.recomendado && (
                <p className="mb-1 font-mono text-[11px] font-semibold tracking-widest text-pitch-600">
                  RECOMENDADO
                </p>
              )}
              <p className="text-sm font-semibold text-ink-900">{plan.nombre}</p>
              <p className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-900">
                {formatearPrecio(plan.precio)}
              </p>
              <p className="text-xs text-ink-400">
                {plan.tipo === "unico" ? "Pago único" : "Por mes"}
              </p>
            </div>
            <ul className="flex flex-1 flex-col gap-2 text-sm text-ink-600">
              {plan.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-lime-400/25 text-pitch-700"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant={plan.recomendado ? "primary" : "secondary"}
              onClick={() => setPlanSeleccionado(plan)}
              className="justify-center"
            >
              {plan.recomendado ? (
                <>
                  Suscribirme <Zap className="h-4 w-4" aria-hidden="true" />
                </>
              ) : (
                "Elegir este plan"
              )}
            </Button>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5">
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

      <Modal
        open={planSeleccionado !== null}
        onClose={() => setPlanSeleccionado(null)}
        title={planSeleccionado ? planSeleccionado.nombre : ""}
      >
        {planSeleccionado && (
          <FormularioPlan
            key={planSeleccionado.slug}
            ligaId={ligaId}
            plan={planSeleccionado}
            onSuccess={() => setPlanSeleccionado(null)}
          />
        )}
      </Modal>
    </div>
  );
}

type State = { error?: string; success?: boolean };

function FormularioPlan({
  ligaId,
  plan,
  onSuccess,
}: {
  ligaId: string;
  plan: Plan;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    elegirPlan.bind(null, ligaId, plan.slug),
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 text-sm text-ink-600">
        <p>
          Cada prode te permite cargar un pronóstico completo (todos los partidos) de la
          próxima fecha habilitada de la liga. Podés cargar más de un prode en la misma
          fecha, cada uno con resultados distintos.
        </p>
        {plan.tipo === "mensual" && (
          <p>
            Tu plan incluye <strong>{plan.cantidadCreditos} prodes</strong> para usar
            durante el mes, uno por cada fecha. Si una fecha se suspende y se reprograma
            para otro finde, no perdés ese prode: lo vas a poder seguir usando en la
            fecha reprogramada, no es que te queda sin jugar.
          </p>
        )}
      </div>

      <div className="rounded-lg bg-chalk-100 p-4">
        <p className="text-sm font-medium text-ink-900">Transferí para confirmar tu plan</p>
        <dl className="mt-2 flex flex-col gap-1 font-mono text-sm text-ink-600">
          <div className="flex justify-between gap-4">
            <dt>Alias</dt>
            <dd className="font-semibold text-ink-900">{ALIAS_TRANSFERENCIA}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Titular</dt>
            <dd className="text-right text-ink-900">{TITULAR_TRANSFERENCIA}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Monto</dt>
            <dd className="font-semibold text-ink-900">{formatearPrecio(plan.precio)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-400">
          Después de transferir, subí la foto o captura del comprobante. Vamos a revisarlo
          y activar tu plan a la brevedad.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-3" noValidate>
        <Field
          label="Comprobante de pago"
          name="comprobante"
          type="file"
          accept="image/*"
          required
          className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-pitch-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-chalk-0 file:hover:bg-pitch-600"
        />
        {state.error && (
          <p role="alert" className="text-sm font-medium text-coral-700">
            {state.error}
          </p>
        )}
        <Button type="submit" loading={pending} className="self-start">
          Enviar comprobante
        </Button>
      </form>
    </div>
  );
}
