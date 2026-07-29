"use client";

import { useRef, useTransition } from "react";

const ESTADOS = ["pendiente", "activa", "inactiva"] as const;

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
        className="rounded-lg border border-line-strong bg-chalk-0 px-3 py-2 text-sm font-medium text-ink-900 disabled:opacity-60"
      >
        {ESTADOS.map((estado) => (
          <option key={estado} value={estado}>
            {estado}
          </option>
        ))}
      </select>
    </form>
  );
}
