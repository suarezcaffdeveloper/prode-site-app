"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { confirmarCuenta } from "./actions";

type State = { error?: string };

export function ConfirmarCuentaForm({
  tokenHash,
  type,
}: {
  tokenHash: string;
  type: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    confirmarCuenta,
    {},
  );

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3">
      <form action={formAction} className="w-full">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        {state?.error && (
          <p role="alert" className="mb-3 text-sm font-medium text-coral-700">
            {state.error}
          </p>
        )}
        <Button type="submit" loading={pending} className="w-full">
          Confirmar mi cuenta
        </Button>
      </form>
      {state?.error && (
        <Link href="/login" className="text-sm font-medium text-pitch-700 hover:underline">
          Volver a iniciar sesión
        </Link>
      )}
    </div>
  );
}
