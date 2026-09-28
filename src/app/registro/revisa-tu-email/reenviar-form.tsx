"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { reenviarConfirmacion, type EstadoReenvio } from "@/lib/auth-actions";

export function ReenviarConfirmacionForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<EstadoReenvio, FormData>(
    reenviarConfirmacion,
    {},
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="email" value={email} />
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {state.error}
        </p>
      )}
      {state?.exito && (
        <p role="status" className="text-sm font-medium text-pitch-700">
          {state.exito}
        </p>
      )}
      <Button
        type="submit"
        variant="secondary"
        loading={pending}
        disabled={!email}
        className="w-full"
      >
        Reenviar email de confirmación
      </Button>
    </form>
  );
}
