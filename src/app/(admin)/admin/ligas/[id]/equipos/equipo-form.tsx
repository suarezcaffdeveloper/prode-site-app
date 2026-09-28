"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Escudo } from "@/components/ui/escudo";

type State = { error?: string };

export function EquipoForm({
  action,
  submitLabel,
  defaultValues,
}: {
  action: (prevState: State, formData: FormData) => Promise<State>;
  submitLabel: string;
  defaultValues?: { nombre?: string; escudoUrl?: string | null };
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field
        label="Nombre"
        name="nombre"
        required
        defaultValue={defaultValues?.nombre}
        placeholder="River Plate"
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="escudo" className="text-sm font-medium text-ink-900">
          Escudo
          <span className="ml-1 font-normal text-ink-400">(opcional)</span>
        </label>
        <div className="flex items-center gap-3">
          {defaultValues?.escudoUrl && (
            <Escudo url={defaultValues.escudoUrl} nombre={defaultValues.nombre ?? ""} />
          )}
          <input
            id="escudo"
            name="escudo"
            type="file"
            accept="image/*"
            className="flex-1 text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-pitch-700 file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-chalk-0 hover:file:bg-pitch-600"
          />
        </div>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending} className="mt-1 self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
