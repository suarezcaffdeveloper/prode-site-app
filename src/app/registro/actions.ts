"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function traducirError(mensaje: string) {
  if (mensaje.includes("already registered") || mensaje.includes("already exists")) {
    return "Ese email ya tiene una cuenta. Iniciá sesión.";
  }
  if (mensaje.includes("Password should be")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (mensaje.includes("Unable to validate email")) {
    return "Ese email no es válido.";
  }
  return "No pudimos crear la cuenta. Intentá de nuevo.";
}

export async function registrarse(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá email y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: traducirError(error.message) };
  }

  redirect("/ligas");
}
