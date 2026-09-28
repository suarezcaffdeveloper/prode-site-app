"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { Button } from "@/components/ui/button";
import { reenviarConfirmacion, type EstadoReenvio } from "@/lib/auth-actions";
import { iniciarSesion, iniciarSesionConGoogle, type EstadoLogin } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<EstadoLogin, FormData>(
    iniciarSesion,
    {},
  );
  const [estadoReenvio, reenviarAction, reenviando] = useActionState<
    EstadoReenvio,
    FormData
  >(reenviarConfirmacion, {});

  return (
    <AuthShell
      eyebrow="INICIAR SESIÓN"
      title="Volvé a la cancha"
      subtitle="Ingresá para ver tus ligas y subgrupos."
      footer={
        <>
          ¿Todavía no tenés cuenta?{" "}
          <Link href="/registro" className="font-medium text-pitch-700 hover:underline">
            Registrate
          </Link>
        </>
      }
    >
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <PasswordField
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          required
        />
        {state?.error && (
          <p role="alert" className="text-sm font-medium text-coral-700">
            {state.error}
          </p>
        )}
        <Button type="submit" loading={pending} className="mt-1 w-full">
          Iniciar sesión
        </Button>
      </form>

      {state?.emailSinConfirmar && (
        <div className="mt-4 rounded-lg border border-line-strong bg-chalk-100 p-4">
          {estadoReenvio?.exito ? (
            <p className="text-sm font-medium text-pitch-700">{estadoReenvio.exito}</p>
          ) : (
            <form action={reenviarAction} className="flex flex-col gap-2">
              <input type="hidden" name="email" value={state.emailSinConfirmar} />
              <p className="text-sm text-ink-600">
                ¿No te llegó el email? Podemos reenviarlo.
              </p>
              {estadoReenvio?.error && (
                <p role="alert" className="text-xs font-medium text-coral-700">
                  {estadoReenvio.error}
                </p>
              )}
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                loading={reenviando}
                className="w-fit"
              >
                Reenviar email de confirmación
              </Button>
            </form>
          )}
        </div>
      )}

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-400">O</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <GoogleButton formAction={iniciarSesionConGoogle} />
    </AuthShell>
  );
}
