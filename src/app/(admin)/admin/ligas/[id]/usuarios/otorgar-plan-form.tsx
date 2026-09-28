"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Result = { error?: string } | void;

interface PlanOpcion {
  id: string;
  nombre: string;
  cantidad_creditos: number;
  slug: string | null;
}

export function OtorgarPlanForm({
  planes,
  slugSugerido,
  action,
}: {
  planes: PlanOpcion[];
  slugSugerido: string | null;
  action: (formData: FormData) => Promise<Result>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const planPreseleccionado = planes.find((plan) => plan.slug === slugSugerido);

  return (
    <form
      className="flex items-center gap-2"
      action={(formData) =>
        startTransition(async () => {
          const result = await action(formData);
          setError(result?.error);
        })
      }
    >
      <select
        name="plan_id"
        defaultValue={planPreseleccionado?.id ?? ""}
        disabled={pending}
        aria-label="Plan a otorgar"
        className="rounded-lg border border-line-strong bg-chalk-0 px-3 py-2 text-sm font-medium text-ink-900 disabled:opacity-60"
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
      <Button type="submit" variant="secondary" loading={pending}>
        Otorgar
      </Button>
      {error && (
        <p role="alert" className="text-xs font-medium text-coral-700">
          {error}
        </p>
      )}
    </form>
  );
}
