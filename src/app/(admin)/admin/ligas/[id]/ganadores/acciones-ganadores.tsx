"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ResultadoAccion } from "./actions";

export function AccionesGanadores({
  liquidada,
  puedeLiquidar,
  motivoNoLiquidar,
  hayPendientesDeAviso,
  hayAvisados,
  liquidarAction,
  deshacerAction,
  avisarAction,
}: {
  liquidada: boolean;
  puedeLiquidar: boolean;
  motivoNoLiquidar?: string;
  hayPendientesDeAviso: boolean;
  hayAvisados: boolean;
  liquidarAction: () => Promise<ResultadoAccion>;
  deshacerAction: () => Promise<ResultadoAccion>;
  avisarAction: () => Promise<ResultadoAccion>;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState<"liquidar" | "deshacer" | null>(null);
  const [resultado, setResultado] = useState<ResultadoAccion>();

  function ejecutar(accion: () => Promise<ResultadoAccion>) {
    setResultado(undefined);
    startTransition(async () => {
      setResultado(await accion());
      setConfirmando(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {!liquidada ? (
          confirmando === "liquidar" ? (
            <>
              <p className="text-sm text-coral-700">
                Se congelan el pozo y los ganadores, y ya no se podrán editar los partidos de esta
                jornada.
              </p>
              <Button loading={pending} onClick={() => ejecutar(liquidarAction)}>
                Sí, liquidar
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setConfirmando(null)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              disabled={!puedeLiquidar}
              onClick={() => {
                setResultado(undefined);
                setConfirmando("liquidar");
              }}
            >
              Liquidar jornada
            </Button>
          )
        ) : confirmando === "deshacer" ? (
          <>
            <p className="text-sm text-coral-700">
              Se borra la liquidación y los partidos vuelven a poder editarse.
            </p>
            <Button variant="danger" loading={pending} onClick={() => ejecutar(deshacerAction)}>
              Sí, deshacer
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setConfirmando(null)}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              loading={pending}
              disabled={!hayPendientesDeAviso}
              onClick={() => ejecutar(avisarAction)}
            >
              {hayAvisados && hayPendientesDeAviso ? "Reenviar a pendientes" : "Enviar aviso"}
            </Button>
            <Button
              variant="secondary"
              disabled={pending || hayAvisados}
              onClick={() => {
                setResultado(undefined);
                setConfirmando("deshacer");
              }}
            >
              Deshacer liquidación
            </Button>
          </>
        )}
      </div>

      {!liquidada && !puedeLiquidar && motivoNoLiquidar && (
        <p className="text-xs text-ink-600">{motivoNoLiquidar}</p>
      )}
      {liquidada && hayAvisados && (
        <p className="text-xs text-ink-600">
          No se puede deshacer la liquidación porque ya se avisó a algún ganador.
        </p>
      )}

      {resultado?.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {resultado.error}
        </p>
      )}
      {resultado?.exito && (
        <p role="status" className="text-sm font-medium text-pitch-700">
          {resultado.exito}
        </p>
      )}
    </div>
  );
}
