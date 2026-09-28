"use client";

import { useState, useTransition } from "react";
import { Undo2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";

type Result = { error?: string } | void;

// Cambio de estado manual de una suscripción. "activa" no es un destino
// posible: depende exclusivamente de otorgar un plan (otorgar_plan_admin),
// que activa la membresía y otorga sus créditos en el mismo paso. Permitirlo
// acá dejaba membresías activas sin ningún crédito otorgado.
//
// - "inactiva" (dar de baja / rechazar): pide confirmación en dos pasos.
// - "pendiente" (volver a pendiente): se aplica directo.
export function CambiarEstadoBoton({
  destino,
  label,
  confirmLabel,
  action,
}: {
  destino: "inactiva" | "pendiente";
  label: string;
  confirmLabel?: string;
  action: (formData: FormData) => Promise<Result>;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string>();

  function ejecutar() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("estado_suscripcion", destino);
      const result = await action(formData);
      if (result?.error) setError(result.error);
      setConfirmando(false);
    });
  }

  if (destino === "inactiva" && confirmando) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="text-sm font-medium text-coral-700">{confirmLabel}</p>
        <Button type="button" variant="danger" size="sm" loading={pending} onClick={ejecutar}>
          Sí, confirmar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirmando(false)}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={destino === "inactiva" ? "danger-soft" : "secondary"}
        size="sm"
        loading={pending}
        onClick={() => {
          setError(undefined);
          if (destino === "inactiva") setConfirmando(true);
          else ejecutar();
        }}
      >
        {destino === "inactiva" ? (
          <UserX className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Undo2 className="h-4 w-4" aria-hidden="true" />
        )}
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-xs font-medium text-coral-700">
          {error}
        </p>
      )}
    </div>
  );
}
