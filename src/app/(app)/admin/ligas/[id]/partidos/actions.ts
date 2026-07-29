"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string };

type DatosPartido = {
  jornada: number;
  equipo_local_id: string;
  equipo_visitante_id: string;
  fecha_hora: string | null;
  goles_local: number | null;
  goles_visitante: number | null;
  estado: "pendiente" | "finalizado";
};

function parsearPartido(formData: FormData): DatosPartido | { error: string } {
  const equipoLocalId = String(formData.get("equipo_local_id") ?? "");
  const equipoVisitanteId = String(formData.get("equipo_visitante_id") ?? "");
  if (!equipoLocalId || !equipoVisitanteId) {
    return { error: "Elegí el equipo local y el visitante." };
  }
  if (equipoLocalId === equipoVisitanteId) {
    return { error: "El equipo local y el visitante no pueden ser el mismo." };
  }

  const jornadaRaw = String(formData.get("jornada") ?? "").trim();
  const jornada = Number(jornadaRaw);
  if (!jornadaRaw || !Number.isInteger(jornada) || jornada < 1) {
    return { error: "La jornada debe ser un número entero mayor o igual a 1." };
  }

  const fechaHoraRaw = String(formData.get("fecha_hora") ?? "").trim();
  const fechaHora = fechaHoraRaw || null;

  const golesLocalRaw = String(formData.get("goles_local") ?? "").trim();
  const golesVisitanteRaw = String(formData.get("goles_visitante") ?? "").trim();

  let golesLocal: number | null = null;
  let golesVisitante: number | null = null;
  let estado: "pendiente" | "finalizado" = "pendiente";

  if (golesLocalRaw || golesVisitanteRaw) {
    if (!golesLocalRaw || !golesVisitanteRaw) {
      return { error: "Para cargar el resultado, ingresá los goles de ambos equipos." };
    }
    golesLocal = Number(golesLocalRaw);
    golesVisitante = Number(golesVisitanteRaw);
    if (
      !Number.isInteger(golesLocal) ||
      golesLocal < 0 ||
      !Number.isInteger(golesVisitante) ||
      golesVisitante < 0
    ) {
      return { error: "Los goles deben ser números enteros mayores o iguales a 0." };
    }
    estado = "finalizado";
  }

  return {
    jornada,
    equipo_local_id: equipoLocalId,
    equipo_visitante_id: equipoVisitanteId,
    fecha_hora: fechaHora,
    goles_local: golesLocal,
    goles_visitante: golesVisitante,
    estado,
  };
}

export async function crearPartido(
  ligaId: string,
  _prevState: State,
  formData: FormData,
) {
  const datos = parsearPartido(formData);
  if ("error" in datos) return datos;

  const supabase = await createClient();
  const { error } = await supabase.from("partidos").insert({ liga_id: ligaId, ...datos });

  if (error) {
    return { error: "No pudimos crear el partido. Intentá de nuevo." };
  }

  revalidatePath(`/admin/ligas/${ligaId}/partidos`);
  redirect(`/admin/ligas/${ligaId}/partidos`);
}

export async function actualizarPartido(
  ligaId: string,
  partidoId: string,
  _prevState: State,
  formData: FormData,
) {
  const datos = parsearPartido(formData);
  if ("error" in datos) return datos;

  const supabase = await createClient();
  const { error } = await supabase.from("partidos").update(datos).eq("id", partidoId);

  if (error) {
    return { error: "No pudimos guardar los cambios. Intentá de nuevo." };
  }

  revalidatePath(`/admin/ligas/${ligaId}/partidos`);
  redirect(`/admin/ligas/${ligaId}/partidos`);
}

export async function borrarPartido(ligaId: string, partidoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("partidos").delete().eq("id", partidoId);

  if (error) {
    return { error: "No pudimos borrar el partido. Intentá de nuevo." };
  }

  revalidatePath(`/admin/ligas/${ligaId}/partidos`);
}
