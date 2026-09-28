"use server";

import { createClient } from "@/lib/supabase/server";
import { obtenerNotificaciones } from "@/lib/notificaciones";

export async function cargarNotificaciones() {
  return obtenerNotificaciones();
}

export async function marcarNotificacionesLeidas() {
  const supabase = await createClient();
  await supabase
    .from("notificaciones")
    .update({ leida_en: new Date().toISOString() })
    .is("leida_en", null);
}
