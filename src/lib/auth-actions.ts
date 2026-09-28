"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type EstadoReenvio = { error?: string; exito?: string };

// Reenvío de confirmación (SPEC 11), usado desde /login (cuenta sin confirmar)
// y desde /registro/revisa-tu-email. Usa el método nativo de Supabase Auth
// (auth.resend) en vez del envío propio con Resend: a diferencia del alta
// inicial, acá no volvemos a pasar por la Admin API ni por una contraseña, así
// que reutilizamos la plantilla de Supabase para este caso puntual de reenvío.
export async function reenviarConfirmacion(
  _prevState: EstadoReenvio,
  formData: FormData,
): Promise<EstadoReenvio> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Falta el email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error) {
    return { error: "No pudimos reenviar el email. Esperá unos segundos e intentá de nuevo." };
  }

  return { exito: "Te reenviamos el email de confirmación. Revisá tu bandeja de entrada (y spam)." };
}
