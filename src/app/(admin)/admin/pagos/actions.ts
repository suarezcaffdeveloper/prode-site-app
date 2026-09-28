"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ResultadoAccion = { error?: string; exito?: string };

function mensajeError(error: { message?: string }): string {
  const mensaje = error.message ?? "";
  if (mensaje.includes("no_autorizado")) return "No tenés permisos para hacer esto.";
  if (mensaje.includes("solicitud_no_aprobable")) {
    return "Esta solicitud ya fue resuelta o no se puede aprobar.";
  }
  if (mensaje.includes("solicitud_no_rechazable")) {
    return "Esta solicitud ya fue resuelta o no se puede rechazar.";
  }
  if (mensaje.includes("movimiento_no_disponible")) {
    return "Ese movimiento ya está asociado a otra solicitud.";
  }
  if (mensaje.includes("movimiento_inexistente")) return "No encontramos ese movimiento.";
  if (mensaje.includes("motivo_requerido")) return "Escribí el motivo del rechazo.";
  if (mensaje.includes("plan_invalido")) return "El plan de la solicitud ya no está activo.";
  return "No pudimos completar la operación. Intentá de nuevo.";
}

// Aprueba una solicitud (con o sin un movimiento de la cuenta asociado) y
// otorga el plan. Corre con la sesión del admin: la función de base de datos
// verifica el rol.
export async function aprobarPago(
  solicitudId: string,
  formData: FormData,
): Promise<ResultadoAccion> {
  const movimientoId = String(formData.get("movimiento_id") ?? "") || null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("aprobar_solicitud_pago", {
    p_solicitud_id: solicitudId,
    p_movimiento_id: movimientoId,
  });
  if (error) return { error: mensajeError(error) };

  revalidatePath("/admin/pagos");
  return { exito: "Pago aprobado: los prodes ya se acreditaron." };
}

export async function rechazarPago(
  solicitudId: string,
  formData: FormData,
): Promise<ResultadoAccion> {
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "Escribí el motivo del rechazo." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("rechazar_solicitud_pago", {
    p_solicitud_id: solicitudId,
    p_motivo: motivo,
  });
  if (error) return { error: mensajeError(error) };

  revalidatePath("/admin/pagos");
  return { exito: "Pago rechazado. Se le avisó al usuario." };
}
