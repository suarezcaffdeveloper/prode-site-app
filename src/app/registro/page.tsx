"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { iniciarSesionConGoogle } from "../login/actions";
import { registrarse } from "./actions";

type State = { error?: string };

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    registrarse,
    {},
  );

  return (
    <AuthShell
      eyebrow="CREAR CUENTA"
      title="Sumate al equipo"
      subtitle="Registrate para ver el catálogo de ligas y empezar a pronosticar."
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-medium text-pitch-700 hover:underline">
            Iniciá sesión
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
          autoComplete="new-password"
          minLength={6}
          hint="Mínimo 6 caracteres."
          required
        />
        {state?.error && (
          <p role="alert" className="text-sm font-medium text-coral-700">
            {state.error}
          </p>
        )}
        <Button type="submit" loading={pending} className="mt-1 w-full">
          Crear cuenta
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
