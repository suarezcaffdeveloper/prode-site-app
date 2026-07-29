"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type State = { error?: string };

export function CrearGrupoForm({
  action,
}: {
  action: (prevState: State, formData: FormData) => Promise<State>;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <Field label="Nombre del subgrupo" name="nombre" required placeholder="Los de la oficina" />
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending} variant="secondary" className="self-start">
        Crear subgrupo
      </Button>
    </form>
  );
}

export function UnirseGrupoForm({
  action,
}: {
  action: (prevState: State, formData: FormData) => Promise<State>;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <Field
        label="Código de invitación"
        name="codigo"
        required
        placeholder="A1B2C3"
        maxLength={6}
        className="uppercase"
      />
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending} variant="secondary" className="self-start">
        Unirme
      </Button>
    </form>
  );
}
