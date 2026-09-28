import type { SupabaseClient } from "@supabase/supabase-js";

// Da de baja la suscripción si su último lote de créditos ya venció y devuelve
// la membresía actualizada (ver vencer_suscripciones en la migración 20260930110000).
export async function obtenerMembresia(
  supabase: SupabaseClient,
  ligaId: string,
  usuarioId: string,
): Promise<{ estado_suscripcion: "pendiente" | "activa" | "inactiva" } | null> {
  await supabase.rpc("vencer_suscripciones", { p_liga_id: ligaId });

  const { data } = await supabase
    .from("membresias_liga")
    .select("estado_suscripcion")
    .eq("liga_id", ligaId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  return data;
}
