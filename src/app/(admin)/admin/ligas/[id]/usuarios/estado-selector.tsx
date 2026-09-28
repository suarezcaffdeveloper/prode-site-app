"use client";

import { useRef, useTransition } from "react";

// "activa" no es un estado seleccionable a mano: depende exclusivamente de
// otorgar un plan (ver otorgarPlan/otorgar_plan_admin), que activa la
// membresía y otorga sus créditos en el mismo paso. Permitir "activa" acá
// dejaba membresías activas sin ningún crédito otorgado.
const ESTADOS = ["pendiente", "inactiva"] as const;

export function EstadoSelector({
  estadoActual,
  action,
}: {
  estadoActual: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={action}
      onChange={(e) => startTransition(() => action(new FormData(e.currentTarget)))}
    >
      <select
        name="estado_suscripcion"
        defaultValue={estadoActual}
        disabled={pending}
        aria-label="Estado de suscripción"
        title={
          estadoActual === "activa"
            ? 'Para desactivar una membresía "activa", elegí "inactiva". No se puede volver a "activa" desde acá: usá "Otorgar plan".'
            : undefined
        }
        className="rounded-lg border border-line-strong bg-chalk-0 px-3 py-2 text-sm font-medium text-ink-900 disabled:opacity-60"
      >
        {estadoActual === "activa" && (
          <option value="activa" disabled>
            activa (otorgá un plan para cambiarlo)
          </option>
        )}
        {ESTADOS.map((estado) => (
          <option key={estado} value={estado}>
            {estado}
          </option>
        ))}
      </select>
    </form>
  );
}
