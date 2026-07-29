"use client";

import { useState, useTransition } from "react";
import { Button } from "./button";

type Result = { error?: string } | void;

// Botón de borrado con confirmación explícita en dos pasos: primero pide
// confirmar, después ejecuta. Requerido por la spec para toda acción de
// borrado (equipos y partidos).
export function ConfirmDeleteButton({
  label,
  confirmLabel,
  action,
}: {
  label: string;
  confirmLabel: string;
  action: () => Promise<Result>;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string>();

  if (!confirmando) {
    return (
      <Button
        type="button"
        variant="danger"
        onClick={() => {
          setError(undefined);
          setConfirmando(true);
        }}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        <p className="text-sm text-coral-700">{confirmLabel}</p>
        <Button
          type="button"
          variant="danger"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await action();
              if (result?.error) {
                setError(result.error);
                setConfirmando(false);
              }
            })
          }
        >
          Sí, borrar
        </Button>
        <Button type="button" variant="ghost" onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {error}
        </p>
      )}
    </div>
  );
}
