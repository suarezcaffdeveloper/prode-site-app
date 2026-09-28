"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// "activa" queda afuera a propósito: activar una membresía sin pasar por
// otorgar_plan_admin es lo que dejaba usuarios "activos" con 0 créditos.
const ESTADOS_ASIGNABLES = ["pendiente", "inactiva"];

export async function cambiarEstadoSuscripcion(
  ligaId: string,
  membresiaId: string,
  formData: FormData,
): Promise<{ error?: string } | void> {
  const nuevoEstado = String(formData.get("estado_suscripcion"));
  if (!ESTADOS_ASIGNABLES.includes(nuevoEstado)) return;

  const supabase = await createClient();

  const { error } = await supabase
    .from("membresias_liga")
    .update({ estado_suscripcion: nuevoEstado })
    .eq("id", membresiaId);

  if (error) return { error: "No pudimos actualizar el estado. Intentá de nuevo." };

  revalidatePath(`/admin/ligas/${ligaId}/usuarios`);
}

// Otorga un plan real (tabla "planes", SPEC 04) a un usuario en esta liga:
// crea el lote de créditos correspondiente. Sigue siendo 100% manual, igual
// que cambiarEstadoSuscripcion — no hay pasarela de pago todavía.
export async function otorgarPlan(
  ligaId: string,
  usuarioId: string,
  formData: FormData,
): Promise<{ error?: string } | void> {
  const planId = String(formData.get("plan_id") ?? "");
  if (!planId) return { error: "Elegí un plan." };

  const supabase = await createClient();

  // otorgar_plan_admin (20260927120000) activa la membresía y otorga el lote
  // de créditos del plan en la misma transacción: antes este action solo
  // insertaba el lote y dejaba estado_suscripcion sin tocar, lo que permitía
  // que un admin otorgara créditos sin activar la suscripción (o viceversa,
  // vía el EstadoSelector) y el usuario quedara con "0 prodes" pese a figurar
  // activo.
  const { error } = await supabase.rpc("otorgar_plan_admin", {
    p_liga_id: ligaId,
    p_usuario_id: usuarioId,
    p_plan_id: planId,
  });

  if (error) return { error: "No pudimos otorgar el plan. Intentá de nuevo." };

  revalidatePath(`/admin/ligas/${ligaId}/usuarios`);
}
