"use client";

import { useState, useTransition } from "react";
import { Lock, Mail, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResultadoAccion } from "./actions";

// Confirmación en dos pasos para las acciones que congelan o revierten la
// liquidación: el aviso explica el efecto antes de ejecutarlo.
function Confirmacion({
  mensaje,
  etiqueta,
  variante,
  pending,
  onConfirmar,
  onCancelar,
}: {
  mensaje: string;
  etiqueta: string;
  variante: "primary" | "danger";
  pending: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-coral-500/30 bg-coral-500/5 p-4">
      <p className="text-sm text-coral-700">{mensaje}</p>
      <div className="flex items-center gap-2">
        <Button variant={variante} size="sm" loading={pending} onClick={onConfirmar}>
          {etiqueta}
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

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
      {!liquidada ? (
        confirmando === "liquidar" ? (
          <Confirmacion
            mensaje="Se congelan el pozo y los ganadores, y ya no se podrán editar los partidos de esta jornada."
            etiqueta="Sí, liquidar"
            variante="primary"
            pending={pending}
            onConfirmar={() => ejecutar(liquidarAction)}
            onCancelar={() => setConfirmando(null)}
          />
        ) : (
          <Button
            className="w-full"
            disabled={!puedeLiquidar}
            onClick={() => {
              setResultado(undefined);
              setConfirmando("liquidar");
            }}
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Liquidar jornada
          </Button>
        )
      ) : confirmando === "deshacer" ? (
        <Confirmacion
          mensaje="Se borra la liquidación y los partidos vuelven a poder editarse."
          etiqueta="Sí, deshacer"
          variante="danger"
          pending={pending}
          onConfirmar={() => ejecutar(deshacerAction)}
          onCancelar={() => setConfirmando(null)}
        />
      ) : (
        <>
          <Button
            className="w-full"
            loading={pending}
            disabled={!hayPendientesDeAviso}
            onClick={() => ejecutar(avisarAction)}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {hayAvisados && hayPendientesDeAviso ? "Reenviar a pendientes" : "Enviar aviso a ganadores"}
          </Button>
          <Button
            className="w-full"
            variant="danger-soft"
            disabled={pending || hayAvisados}
            onClick={() => {
              setResultado(undefined);
              setConfirmando("deshacer");
            }}
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Deshacer liquidación
          </Button>
        </>
      )}

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
