"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/usuario-actual";
import { armarEmailGanador, enviarEmail } from "@/lib/email";

export type ResultadoAccion = { error?: string; exito?: string };

const PAUSA_ENTRE_EMAILS_MS = 600;

function mensajeErrorRpc(error: { message?: string }): string {
  const mensaje = error.message ?? "";
  if (mensaje.includes("no_autorizado")) return "No tenés permisos para hacer esto.";
  if (mensaje.includes("jornada_ya_liquidada")) return "Esta jornada ya está liquidada.";
  if (mensaje.includes("jornada_sin_partidos")) return "La jornada no tiene partidos cargados.";
  if (mensaje.includes("partidos_pendientes")) {
    return "Todavía hay partidos sin resultado en esta jornada.";
  }
  if (mensaje.includes("jornadas_previas_sin_liquidar")) {
    return "Liquidá primero las jornadas anteriores.";
  }
  if (mensaje.includes("liquidacion_inexistente")) return "Esta jornada no está liquidada.";
  if (mensaje.includes("ganadores_ya_avisados")) {
    return "No se puede deshacer: ya se avisó a algún ganador.";
  }
  if (mensaje.includes("liquidacion_posterior_existente")) {
    return "No se puede deshacer: hay una jornada posterior ya liquidada.";
  }
  return "No pudimos completar la operación. Intentá de nuevo.";
}

function revalidar(ligaId: string) {
  revalidatePath(`/admin/ligas/${ligaId}/ganadores`);
  revalidatePath(`/admin/ligas/${ligaId}/partidos`);
  revalidatePath(`/ligas/${ligaId}/pronosticos`);
}

export async function liquidarJornada(ligaId: string, jornada: number): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("liquidar_jornada", {
    p_liga_id: ligaId,
    p_jornada: jornada,
  });
  if (error) return { error: mensajeErrorRpc(error) };

  revalidar(ligaId);
  return { exito: `Jornada ${jornada} liquidada.` };
}

export async function deshacerLiquidacion(
  ligaId: string,
  jornada: number,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deshacer_liquidacion", {
    p_liga_id: ligaId,
    p_jornada: jornada,
  });
  if (error) return { error: mensajeErrorRpc(error) };

  revalidar(ligaId);
  return { exito: `Se deshizo la liquidación de la jornada ${jornada}.` };
}

type GanadorFila = {
  id: string;
  usuario_id: string;
  email: string;
  monto_premio: number;
  usuarios: { nombre: string | null } | { nombre: string | null }[] | null;
};

type GrupoUsuario = {
  filaIds: string[];
  email: string;
  nombre: string | null;
  cantidadCartones: number;
  centavos: number;
};

// El envío no pasa por RLS, así que el rol admin se verifica de forma
// explícita. Manda un email por usuario (consolidando sus cartones ganadores)
// y solo a quienes todavía no fueron avisados, para que reintentar no duplique.
export async function enviarAvisoGanadores(
  ligaId: string,
  jornada: number,
): Promise<ResultadoAccion> {
  const usuarioActual = await getUsuarioActual();
  if (!usuarioActual || usuarioActual.rol !== "admin") {
    return { error: "No tenés permisos para hacer esto." };
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return { error: "Falta configurar RESEND_API_KEY y EMAIL_FROM para enviar emails." };
  }

  const supabase = await createClient();

  const { data: liga } = await supabase.from("ligas").select("nombre").eq("id", ligaId).single();
  if (!liga) return { error: "No encontramos la liga." };

  const { data: liquidacion } = await supabase
    .from("liquidaciones_jornada")
    .select("id")
    .eq("liga_id", ligaId)
    .eq("jornada", jornada)
    .maybeSingle();
  if (!liquidacion) return { error: "Liquidá la jornada antes de enviar el aviso." };

  const { data: filas } = await supabase
    .from("ganadores_jornada")
    .select("id, usuario_id, email, monto_premio, usuarios(nombre)")
    .eq("liquidacion_id", liquidacion.id)
    .is("avisado_en", null)
    .returns<GanadorFila[]>();

  if (!filas || filas.length === 0) {
    return { error: "No hay ganadores pendientes de aviso en esta jornada." };
  }

  const grupos = new Map<string, GrupoUsuario>();
  for (const fila of filas) {
    const usuario = Array.isArray(fila.usuarios) ? fila.usuarios[0] : fila.usuarios;
    const grupo = grupos.get(fila.usuario_id) ?? {
      filaIds: [],
      email: fila.email,
      nombre: usuario?.nombre ?? null,
      cantidadCartones: 0,
      centavos: 0,
    };
    grupo.filaIds.push(fila.id);
    grupo.cantidadCartones += 1;
    grupo.centavos += Math.round(fila.monto_premio * 100);
    grupos.set(fila.usuario_id, grupo);
  }

  let enviados = 0;
  let fallidos = 0;
  let primerError: string | undefined;
  let primero = true;

  for (const grupo of grupos.values()) {
    if (!primero) await new Promise((resolver) => setTimeout(resolver, PAUSA_ENTRE_EMAILS_MS));
    primero = false;

    const { subject, html, text } = armarEmailGanador({
      nombre: grupo.nombre,
      ligaNombre: liga.nombre,
      jornada,
      cantidadCartones: grupo.cantidadCartones,
      montoTotal: grupo.centavos / 100,
    });

    const { error } = await enviarEmail({ to: grupo.email, subject, html, text });

    if (error) {
      fallidos += 1;
      primerError ??= error;
      await supabase
        .from("ganadores_jornada")
        .update({ aviso_error: error })
        .in("id", grupo.filaIds);
    } else {
      enviados += 1;
      await supabase
        .from("ganadores_jornada")
        .update({ avisado_en: new Date().toISOString(), aviso_error: null })
        .in("id", grupo.filaIds);
    }
  }

  revalidar(ligaId);

  if (fallidos > 0) {
    return {
      error: `Se enviaron ${enviados} y fallaron ${fallidos}. ${primerError ?? ""}`.trim(),
    };
  }
  return { exito: `Aviso enviado a ${enviados} ${enviados === 1 ? "ganador" : "ganadores"}.` };
}
