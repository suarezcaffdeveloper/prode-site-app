"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { armarEmailConfirmacion, enviarEmail } from "@/lib/email";
import { esContrasenaSegura, mensajeContrasenaInsegura } from "@/lib/password";

function traducirError(mensaje: string) {
  if (mensaje.includes("already registered") || mensaje.includes("already exists")) {
    return "Ese email ya tiene una cuenta. Iniciá sesión.";
  }
  if (mensaje.includes("Password") || mensaje.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }
  if (mensaje.includes("Unable to validate email") || mensaje.includes("invalid")) {
    return "Ese email no es válido.";
  }
  return "No pudimos crear la cuenta. Intentá de nuevo.";
}

export async function registrarse(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmarPassword = String(formData.get("confirmarPassword") ?? "");

  if (!email || !password || !confirmarPassword) {
    return { error: "Completá todos los campos." };
  }

  if (password !== confirmarPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  if (!esContrasenaSegura(password)) {
    return { error: mensajeContrasenaInsegura(password) ?? "La contraseña no es lo suficientemente segura." };
  }

  // Generamos el link de confirmación con la Admin API (crea el usuario en el
  // mismo paso) en vez de supabase.auth.signUp(): así controlamos nosotros el
  // envío del email (marca propia vía Resend, SPEC 11) en lugar de dejar que
  // Supabase Auth mande su plantilla nativa.
  const origin = (await headers()).get("origin");
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
  });

  if (error) {
    return { error: traducirError(error.message) };
  }

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) {
    return { error: "No pudimos generar el link de confirmación. Intentá de nuevo." };
  }

  // Ojo: este link va a NUESTRA página (/auth/confirmar), no al action_link de
  // Supabase. Nuestra página exige un clic explícito en "Confirmar mi cuenta"
  // antes de canjear el token, para que un escáner de seguridad de email no lo
  // consuma solo por pre-visitar el link.
  const confirmUrl = `${origin}/auth/confirmar?token_hash=${tokenHash}&type=signup`;
  const { subject, html, text } = armarEmailConfirmacion({ confirmUrl });
  const { error: errorEnvio } = await enviarEmail({ to: email, subject, html, text });

  const query = new URLSearchParams({ email });

  if (errorEnvio) {
    // El envío de marca (Resend) puede fallar sin que sea un bug: con el
    // dominio de prueba de Resend (onboarding@resend.dev) solo se puede
    // mandar al email dueño de la cuenta de Resend, no a cualquier
    // destinatario, hasta verificar un dominio propio. En ese caso, en vez de
    // dejar al usuario sin ningún mail, hacemos fallback al reenvío nativo de
    // Supabase Auth (mismo mecanismo que el botón "Reenviar confirmación"),
    // que en local cae en Mailpit y en producción depende del SMTP
    // configurado en el dashboard de Supabase.
    //
    // El generateLink de arriba ya cuenta como un "envío" para el rate limit
    // de Supabase (auth.email.max_frequency, 1s en local). Si llamamos a
    // resend() inmediatamente después, cae dentro de esa ventana y responde
    // "for security purposes, you can only request this after N seconds" en
    // vez de mandar el mail. Esperamos un toque más que esa ventana antes de
    // reintentar.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const supabase = await createClient();
    const { error: errorFallback } = await supabase.auth.resend({ type: "signup", email });

    if (errorFallback) {
      query.set("envio", "fallido");
    }
  }

  redirect(`/registro/revisa-tu-email?${query.toString()}`);
}
