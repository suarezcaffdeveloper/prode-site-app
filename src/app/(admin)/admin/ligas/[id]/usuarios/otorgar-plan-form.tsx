"use client";

import { useState, useTransition } from "react";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Result = { error?: string } | void;

interface PlanOpcion {
  id: string;
  nombre: string;
  cantidad_creditos: number;
  slug: string | null;
}

// Otorgar un plan es la única forma de activar una suscripción: activa la
// membresía y suma los créditos del plan en el mismo paso. `etiqueta` explica
// qué va a pasar según el estado actual (activar, reactivar, sumar créditos).
export function OtorgarPlanForm({
  planes,
  slugSugerido,
  etiqueta,
  variante = "primary",
  action,
}: {
  planes: PlanOpcion[];
  slugSugerido: string | null;
  etiqueta: string;
  variante?: "primary" | "secondary";
  action: (formData: FormData) => Promise<Result>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const planPreseleccionado = planes.find((plan) => plan.slug === slugSugerido);

  return (
    <form
      className="flex flex-col gap-1.5"
      action={(formData) =>
        startTransition(async () => {
          const result = await action(formData);
          setError(result?.error);
        })
      }
    >
      <div className="flex items-center gap-2">
        <select
          name="plan_id"
          defaultValue={planPreseleccionado?.id ?? ""}
          disabled={pending}
          aria-label="Plan a otorgar"
          className="rounded-lg border border-line-strong bg-chalk-0 px-3.5 py-2 text-sm font-medium text-ink-900 transition-colors focus-visible:border-pitch-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-500/30 disabled:opacity-60"
        >
          <option value="" disabled>
            Elegí un plan
          </option>
          {planes.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.nombre} ({plan.cantidad_creditos} créditos)
            </option>
          ))}
        </select>
        <Button type="submit" variant={variante} size="sm" loading={pending}>
          <UserCheck className="h-4 w-4" aria-hidden="true" />
          {etiqueta}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-coral-700">
          {error}
        </p>
      )}
    </form>
  );
}
