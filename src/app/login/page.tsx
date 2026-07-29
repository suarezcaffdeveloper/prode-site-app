"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { iniciarSesion, iniciarSesionConGoogle } from "./actions";

type State = { error?: string };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    iniciarSesion,
    {},
  );

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
        <Field
          label="Contraseña"
          name="password"
          type="password"
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

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-400">O</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <GoogleButton formAction={iniciarSesionConGoogle} />
    </AuthShell>
  );
}
