"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

function traducirError(mensaje: string) {
  if (mensaje.includes("Invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }
  if (mensaje.includes("Email not confirmed")) {
    return "Todavía no confirmaste tu email. Revisá tu bandeja de entrada.";
  }
  return "No pudimos iniciar sesión. Intentá de nuevo.";
}

export async function iniciarSesion(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá email y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: traducirError(error.message) };
  }

  redirect("/ligas");
}

export async function iniciarSesionConGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/auth/auth-code-error");
  }

  redirect(data.url);
}
