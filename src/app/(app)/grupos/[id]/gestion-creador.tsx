"use client";

import { useActionState, useState, useTransition } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type State = { error?: string };

export function RenombrarForm({
  nombreActual,
  action,
}: {
  nombreActual: string;
  action: (prevState: State, formData: FormData) => Promise<State>;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});

  return (
    <form action={formAction} className="flex items-end gap-3" noValidate>
      <div className="flex-1">
        <Field label="Nombre del subgrupo" name="nombre" defaultValue={nombreActual} required />
      </div>
      <Button type="submit" variant="secondary" loading={pending}>
        Guardar
      </Button>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function EcharMiembroBoton({
  nombre,
  action,
}: {
  nombre: string;
  action: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      loading={pending}
      onClick={() => {
        if (confirm(`¿Echar a ${nombre} del subgrupo?`)) {
          startTransition(() => action());
        }
      }}
    >
      Echar
    </Button>
  );
}

export function EliminarGrupoBoton({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button type="button" variant="danger" onClick={() => setConfirmando(true)}>
        Eliminar subgrupo
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-sm text-coral-700">¿Seguro? No se puede deshacer.</p>
      <Button
        type="button"
        variant="danger"
        loading={pending}
        onClick={() => startTransition(() => action())}
      >
        Sí, eliminar
      </Button>
      <Button type="button" variant="ghost" onClick={() => setConfirmando(false)}>
        Cancelar
      </Button>
    </div>
  );
}
