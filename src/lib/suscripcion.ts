import type { SupabaseClient } from "@supabase/supabase-js";

// Da de baja la suscripción si su último lote de créditos ya venció y devuelve
// la membresía actualizada (ver vencer_suscripciones en la migración 20260930110000).
//
// El RPC solo se llama en el caso raro de vencimiento real: en el camino
// feliz (sin suscripción activa, o activa con créditos vigentes) alcanza con
// leer membresías/créditos, sin pagar el UPDATE de vencer_suscripciones en
// cada navegación.
export async function obtenerMembresia(
  supabase: SupabaseClient,
  ligaId: string,
  usuarioId: string,
): Promise<{ estado_suscripcion: "pendiente" | "activa" | "inactiva" } | null> {
  const { data: membresia } = await supabase
    .from("membresias_liga")
    .select("estado_suscripcion")
    .eq("liga_id", ligaId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (membresia?.estado_suscripcion !== "activa") return membresia;

  const { data: lotes } = await supabase
    .from("creditos_lotes")
    .select("expira_en")
    .eq("usuario_id", usuarioId)
    .eq("liga_id", ligaId);

  const sinLotes = !lotes || lotes.length === 0;
  const tieneVigente = (lotes ?? []).some(
    (l) => l.expira_en === null || new Date(l.expira_en) > new Date(),
  );
  if (sinLotes || tieneVigente) return membresia;

  // Único caso donde hace falta escribir: todos los lotes de esta liga
  // vencieron y la membresía todavía figura como "activa".
  await supabase.rpc("vencer_suscripciones", { p_liga_id: ligaId });
  return { estado_suscripcion: "inactiva" };
}
