"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type State = { error?: string };

export function LigaForm({
  action,
  submitLabel,
  defaultValues,
  showActivaToggle,
}: {
  action: (prevState: State, formData: FormData) => Promise<State>;
  submitLabel: string;
  defaultValues?: { nombre?: string; descripcion?: string | null; activa?: boolean };
  showActivaToggle?: boolean;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field
        label="Nombre"
        name="nombre"
        required
        defaultValue={defaultValues?.nombre}
        placeholder="Liga de los Viernes"
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="descripcion" className="text-sm font-medium text-ink-900">
          Descripción
          <span className="ml-1 font-normal text-ink-400">(opcional)</span>
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={3}
          defaultValue={defaultValues?.descripcion ?? ""}
          className="rounded-lg border border-line-strong bg-chalk-0 px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400"
        />
      </div>
      {showActivaToggle && (
        <label className="flex items-center gap-2 text-sm font-medium text-ink-900">
          <input
            type="checkbox"
            name="activa"
            defaultChecked={defaultValues?.activa}
            className="h-4 w-4 rounded border-line-strong accent-pitch-700"
          />
          Liga activa (visible en el catálogo)
        </label>
      )}
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
