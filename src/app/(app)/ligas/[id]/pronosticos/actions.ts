"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string };

type Prediccion = { partido_id: string; goles_local: number; goles_visitante: number };

function parsearPredicciones(
  formData: FormData,
  partidoIds: string[],
): Prediccion[] | { error: string } {
  const predicciones: Prediccion[] = [];

  for (const partidoId of partidoIds) {
    const golesLocalRaw = String(formData.get(`goles_local_${partidoId}`) ?? "").trim();
    const golesVisitanteRaw = String(formData.get(`goles_visitante_${partidoId}`) ?? "").trim();

    if (!golesLocalRaw || !golesVisitanteRaw) {
      return { error: "Cargá un resultado para cada partido de la jornada." };
    }

    const golesLocal = Number(golesLocalRaw);
    const golesVisitante = Number(golesVisitanteRaw);
    if (
      !Number.isInteger(golesLocal) ||
      golesLocal < 0 ||
      !Number.isInteger(golesVisitante) ||
      golesVisitante < 0
    ) {
      return { error: "Los goles deben ser números enteros mayores o iguales a 0." };
    }

    predicciones.push({ partido_id: partidoId, goles_local: golesLocal, goles_visitante: golesVisitante });
  }

  return predicciones;
}

function mensajeErrorRpc(error: { message?: string }): string {
  const mensaje = error.message ?? "";
  if (mensaje.includes("sin_creditos_disponibles")) {
    return "No te quedan prodes disponibles para esta liga.";
  }
  if (mensaje.includes("jornada_bloqueada")) {
    return "La jornada está bloqueada: falta cargar el horario de algún partido.";
  }
  if (mensaje.includes("jornada_cerrada")) {
    return "Esta jornada ya cerró.";
  }
  if (mensaje.includes("jornada_no_activa")) {
    return "Esta ya no es la jornada activa.";
  }
  if (mensaje.includes("predicciones_incompletas")) {
    return "Cargá un resultado para cada partido de la jornada.";
  }
  if (mensaje.includes("carton_no_encontrado")) {
    return "No encontramos ese prode.";
  }
  return "No pudimos guardar tu prode. Intentá de nuevo.";
}

export async function crearCarton(
  ligaId: string,
  jornada: number,
  partidoIds: string[],
  _prevState: State,
  formData: FormData,
): Promise<State> {
  const predicciones = parsearPredicciones(formData, partidoIds);
  if ("error" in predicciones) return predicciones;

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_carton", {
    p_liga_id: ligaId,
    p_jornada: jornada,
    p_predicciones: predicciones,
  });

  if (error) return { error: mensajeErrorRpc(error) };

  revalidatePath(`/ligas/${ligaId}/pronosticos`);
  revalidatePath(`/ligas/${ligaId}`);
  return {};
}

export async function actualizarCarton(
  ligaId: string,
  cartonId: string,
  predicciones: Prediccion[],
): Promise<State> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_carton", {
    p_carton_id: cartonId,
    p_predicciones: predicciones,
  });

  if (error) return { error: mensajeErrorRpc(error) };

  revalidatePath(`/ligas/${ligaId}/pronosticos`);
  return {};
}
