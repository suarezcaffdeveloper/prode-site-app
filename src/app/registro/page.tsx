"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { Button } from "@/components/ui/button";
import { evaluarContrasena } from "@/lib/password";
import { iniciarSesionConGoogle } from "../login/actions";
import { registrarse } from "./actions";

type State = { error?: string };

function ReglaChecklistItem({ cumple, texto }: { cumple: boolean; texto: string }) {
  return (
    <li
      className={`flex items-center gap-1.5 ${cumple ? "text-pitch-700" : "text-ink-400"}`}
    >
      <span aria-hidden="true">{cumple ? "✓" : "○"}</span>
      {texto}
    </li>
  );
}

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    registrarse,
    {},
  );
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");

  const reglas = evaluarContrasena(password);
  const coinciden = confirmarPassword.length > 0 && password === confirmarPassword;
  const noCoinciden = confirmarPassword.length > 0 && password !== confirmarPassword;

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
        <div className="flex flex-col gap-2">
          <PasswordField
            label="Contraseña"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {password.length > 0 && (
            <ul className="flex flex-col gap-1 pl-0.5 text-xs">
              <ReglaChecklistItem cumple={reglas.longitud} texto="Al menos 8 caracteres" />
              <ReglaChecklistItem cumple={reglas.mayuscula} texto="Una letra mayúscula" />
              <ReglaChecklistItem cumple={reglas.minuscula} texto="Una letra minúscula" />
              <ReglaChecklistItem cumple={reglas.numero} texto="Un número" />
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <PasswordField
            label="Repetir contraseña"
            name="confirmarPassword"
            autoComplete="new-password"
            value={confirmarPassword}
            onChange={(e) => setConfirmarPassword(e.target.value)}
            required
          />
          {coinciden && (
            <p className="text-xs font-medium text-pitch-700">Las contraseñas coinciden.</p>
          )}
          {noCoinciden && (
            <p role="alert" className="text-xs font-medium text-coral-700">
              Las contraseñas no coinciden.
            </p>
          )}
        </div>
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
