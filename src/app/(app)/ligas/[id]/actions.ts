"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generarCodigoInvitacion } from "@/lib/codigo-invitacion";
import { obtenerPlan } from "@/lib/planes";
import type { SupabaseClient } from "@supabase/supabase-js";

type State = { error?: string };
type ElegirPlanState = { error?: string; success?: boolean };

const COMPROBANTE_TAMANIO_MAXIMO = 5 * 1024 * 1024; // 5 MB

async function subirComprobante(
  supabase: SupabaseClient,
  usuarioId: string,
  ligaId: string,
  comprobante: File,
): Promise<string | null> {
  const extension = comprobante.name.split(".").pop();
  const path = `${usuarioId}/${ligaId}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;

  const { error } = await supabase.storage
    .from("comprobantes")
    .upload(path, comprobante);
  if (error) return null;

  return path;
}

export async function elegirPlan(
  ligaId: string,
  planSlug: string,
  _prevState: ElegirPlanState,
  formData: FormData,
): Promise<ElegirPlanState> {
  const plan = obtenerPlan(planSlug);
  if (!plan) {
    return { error: "Ese plan no existe. Volvé a intentar." };
  }

  const comprobante = formData.get("comprobante");
  if (!(comprobante instanceof File) || comprobante.size === 0) {
    return { error: "Subí una imagen del comprobante." };
  }
  if (!comprobante.type.startsWith("image/")) {
    return { error: "El archivo debe ser una imagen." };
  }
  if (comprobante.size > COMPROBANTE_TAMANIO_MAXIMO) {
    return { error: "La imagen es demasiado pesada (máximo 5 MB)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const comprobantePath = await subirComprobante(supabase, user.id, ligaId, comprobante);
  if (!comprobantePath) {
    return { error: "No pudimos subir el comprobante. Intentá de nuevo." };
  }

  // TEMPORAL (ver migración 20260926140000_temp_auto_activar_suscripcion):
  // mientras no haya integración real de pago ni revisión manual del
  // comprobante, se activa la suscripción directamente al elegir un plan,
  // para poder probar el flujo de créditos/pronósticos sin esperar al admin.
  // Revertir a "pendiente" cuando se implemente la corroboración real.
  //
  // activar_suscripcion_liga (20260927120000) activa la membresía y otorga
  // el lote de créditos del plan en la misma transacción: son dos escrituras
  // (membresias_liga + creditos_lotes) que tienen que ocurrir juntas, nunca
  // una sin la otra.
  const { error } = await supabase.rpc("activar_suscripcion_liga", {
    p_liga_id: ligaId,
    p_plan_slug: plan.slug,
    p_comprobante_path: comprobantePath,
  });

  if (error) {
    return { error: "No pudimos registrar tu solicitud. Intentá de nuevo." };
  }

  revalidatePath(`/ligas/${ligaId}`);
  return { success: true };
}

export async function crearGrupo(
  ligaId: string,
  _prevState: State,
  formData: FormData,
) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) {
    return { error: "El nombre del subgrupo es obligatorio." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  let grupoId: string | null = null;

  // Reintenta si el código generado al azar choca con el constraint unique
  // (altamente improbable con 6 caracteres, pero posible).
  for (let intento = 0; intento < 5 && !grupoId; intento++) {
    const { data, error } = await supabase
      .from("grupos")
      .insert({
        liga_id: ligaId,
        nombre,
        creador_id: user.id,
        codigo_invitacion: generarCodigoInvitacion(),
      })
      .select("id")
      .single();

    if (data) {
      grupoId = data.id;
    } else if (error && error.code !== "23505") {
      return { error: "No pudimos crear el subgrupo. Intentá de nuevo." };
    }
  }

  if (!grupoId) {
    return { error: "No pudimos generar un código único. Intentá de nuevo." };
  }

  await supabase
    .from("membresias_grupo")
    .insert({ grupo_id: grupoId, usuario_id: user.id });

  revalidatePath(`/ligas/${ligaId}`);
  redirect(`/grupos/${grupoId}`);
}

export async function unirseAGrupo(
  ligaId: string,
  _prevState: State,
  formData: FormData,
) {
  const codigo = String(formData.get("codigo") ?? "").trim();
  if (!codigo) {
    return { error: "Ingresá un código de invitación." };
  }

  const supabase = await createClient();
  const { data: grupoId, error } = await supabase.rpc("unirse_a_grupo", {
    p_codigo: codigo,
  });

  if (error) {
    if (error.message.includes("codigo_invalido")) {
      return { error: "Ese código no corresponde a ningún subgrupo." };
    }
    if (error.message.includes("suscripcion_no_activa")) {
      return { error: "Necesitás una suscripción activa a esta liga para unirte." };
    }
    return { error: "No pudimos procesar el código. Intentá de nuevo." };
  }

  revalidatePath(`/ligas/${ligaId}`);
  redirect(`/grupos/${grupoId}`);
}
