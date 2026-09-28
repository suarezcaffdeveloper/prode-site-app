"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Estado = { error?: string };

type TipoSoportado = "signup" | "magiclink";

function traducirError(mensaje: string) {
  if (mensaje.includes("expired")) {
    return "El link venció. Volvé a pedir que te reenvíen la confirmación.";
  }
  if (mensaje.includes("invalid") || mensaje.includes("not found") || mensaje.includes("used")) {
    return "Este link ya se usó o no es válido. Pedí que te reenvíen la confirmación.";
  }
  return "No pudimos confirmar tu cuenta. Pedí que te reenvíen la confirmación.";
}

// Recién acá, al hacer clic explícito en "Confirmar mi cuenta", se canjea el
// token. La página /auth/confirmar solo lo muestra; no lo canjea al cargar
// (SPEC 11), para no quedar expuestos a que un escáner de email lo consuma.
export async function confirmarCuenta(_prevState: Estado, formData: FormData): Promise<Estado> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "");

  if (!tokenHash || (type !== "signup" && type !== "magiclink")) {
    return { error: "Este link de confirmación no es válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as TipoSoportado,
  });

  if (error) {
    return { error: traducirError(error.message) };
  }

  redirect("/ligas");
}
