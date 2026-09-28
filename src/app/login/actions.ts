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

export type EstadoLogin = { error?: string; emailSinConfirmar?: string };

export async function iniciarSesion(
  _prevState: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá email y contraseña." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Distinguimos este caso para ofrecer el botón de reenvío de confirmación
    // (SPEC 11) en vez de solo mostrar el mensaje de error.
    if (error.message.includes("Email not confirmed")) {
      return { error: traducirError(error.message), emailSinConfirmar: email };
    }
    return { error: traducirError(error.message) };
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", data.user.id)
    .single();

  redirect(usuario?.rol === "admin" ? "/admin/ligas" : "/ligas");
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
