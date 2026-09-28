"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "./button";

type Result = { error?: string } | void;

// Botón de borrado con confirmación explícita en dos pasos: primero pide
// confirmar, después ejecuta. Requerido por la spec para toda acción de
// borrado (equipos y partidos). `compact` es la versión discreta para filas
// de listado: botón chico con ícono y confirmación apilada.
export function ConfirmDeleteButton({
  label,
  confirmLabel,
  action,
  compact = false,
}: {
  label: string;
  confirmLabel: string;
  action: () => Promise<Result>;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string>();

  if (!confirmando) {
    return (
      <Button
        type="button"
        variant={compact ? "danger-soft" : "danger"}
        size={compact ? "sm" : "md"}
        onClick={() => {
          setError(undefined);
          setConfirmando(true);
        }}
      >
        {compact && <Trash2 className="h-4 w-4" aria-hidden="true" />}
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div
        className={
          compact ? "flex flex-col items-end gap-2" : "flex items-center gap-3"
        }
      >
        <p className={`text-coral-700 ${compact ? "text-xs" : "text-sm"}`}>
          {confirmLabel}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="danger"
            size={compact ? "sm" : "md"}
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
          <Button
            type="button"
            variant="ghost"
            size={compact ? "sm" : "md"}
            onClick={() => setConfirmando(false)}
          >
            Cancelar
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {error}
        </p>
      )}
    </div>
  );
}
