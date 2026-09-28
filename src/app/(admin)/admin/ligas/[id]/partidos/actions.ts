"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcularTotalJornadas, MAX_FILAS_CARGA_MASIVA } from "@/lib/fixture";
import { validarLoteFixture, type FilaFixtureCruda, type ErrorFilaFixture } from "@/lib/fixture-batch";

type State = { error?: string; exito?: string };
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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

async function validarRangoJornada(
  supabase: SupabaseServerClient,
  ligaId: string,
  jornada: number,
): Promise<string | null> {
  const { count } = await supabase
    .from("equipos")
    .select("id", { count: "exact", head: true })
    .eq("liga_id", ligaId);

  const totalJornadas = calcularTotalJornadas(count ?? 0);
  if (jornada > totalJornadas) {
    return totalJornadas === 0
      ? "Todavía no hay equipos suficientes para calcular las jornadas de esta liga."
      : `La liga tiene ${totalJornadas} jornada${totalJornadas === 1 ? "" : "s"} posible${
          totalJornadas === 1 ? "" : "s"
        } como máximo.`;
  }
  return null;
}

async function validarEquipoNoRepiteEnJornada(
  supabase: SupabaseServerClient,
  ligaId: string,
  jornada: number,
  equipoLocalId: string,
  equipoVisitanteId: string,
  partidoIdExcluir?: string,
): Promise<string | null> {
  let query = supabase
    .from("partidos")
    .select(
      `equipo_local:equipo_local_id (id, nombre), equipo_visitante:equipo_visitante_id (id, nombre)`,
    )
    .eq("liga_id", ligaId)
    .eq("jornada", jornada);
  if (partidoIdExcluir) query = query.neq("id", partidoIdExcluir);

  const { data } = await query.returns<
    {
      equipo_local: { id: string; nombre: string };
      equipo_visitante: { id: string; nombre: string };
    }[]
  >();
  for (const partido of data ?? []) {
    for (const equipo of [partido.equipo_local, partido.equipo_visitante]) {
      if (equipo.id === equipoLocalId || equipo.id === equipoVisitanteId) {
        return `${equipo.nombre} ya tiene un partido cargado en la jornada ${jornada}.`;
      }
    }
  }
  return null;
}

async function validarCruceNoRepetido(
  supabase: SupabaseServerClient,
  ligaId: string,
  equipoLocalId: string,
  equipoVisitanteId: string,
  partidoIdExcluir?: string,
): Promise<string | null> {
  let query = supabase
    .from("partidos")
    .select(
      `jornada, equipo_local:equipo_local_id (nombre), equipo_visitante:equipo_visitante_id (nombre)`,
    )
    .eq("liga_id", ligaId)
    .or(
      `and(equipo_local_id.eq.${equipoLocalId},equipo_visitante_id.eq.${equipoVisitanteId}),` +
        `and(equipo_local_id.eq.${equipoVisitanteId},equipo_visitante_id.eq.${equipoLocalId})`,
    );
  if (partidoIdExcluir) query = query.neq("id", partidoIdExcluir);

  const { data } = await query.returns<
    { jornada: number; equipo_local: { nombre: string }; equipo_visitante: { nombre: string } }[]
  >();
  const existente = data?.[0];
  if (existente) {
    return `${existente.equipo_local.nombre} ya jugó contra ${existente.equipo_visitante.nombre} en la jornada ${existente.jornada}.`;
  }
  return null;
}

const MENSAJE_JORNADA_LIQUIDADA =
  "Esta jornada ya está liquidada. Deshacé la liquidación en Ganadores para editarla.";

function esJornadaLiquidada(error: { message?: string }): boolean {
  return error.message?.includes("jornada_liquidada") ?? false;
}

function mensajeErrorGuardado(error: { code?: string; message?: string }): string {
  if (esJornadaLiquidada(error)) return MENSAJE_JORNADA_LIQUIDADA;
  if (error.code === "23505") {
    return "Ese cruce de equipos ya existe en otra jornada de esta liga.";
  }
  return "No pudimos guardar el partido. Intentá de nuevo.";
}

// A diferencia de actualizarPartido, no redirige: devuelve un mensaje de éxito
// para que el panel de alta siga abierto y el admin pueda cargar el partido
// siguiente sin volver a abrirlo.
export async function crearPartido(
  ligaId: string,
  _prevState: State,
  formData: FormData,
): Promise<State> {
  const datos = parsearPartido(formData);
  if ("error" in datos) return datos;

  const supabase = await createClient();

  const errorRango = await validarRangoJornada(supabase, ligaId, datos.jornada);
  if (errorRango) return { error: errorRango };

  const errorJornada = await validarEquipoNoRepiteEnJornada(
    supabase,
    ligaId,
    datos.jornada,
    datos.equipo_local_id,
    datos.equipo_visitante_id,
  );
  if (errorJornada) return { error: errorJornada };

  const errorCruce = await validarCruceNoRepetido(
    supabase,
    ligaId,
    datos.equipo_local_id,
    datos.equipo_visitante_id,
  );
  if (errorCruce) return { error: errorCruce };

  const { error } = await supabase.from("partidos").insert({ liga_id: ligaId, ...datos });

  if (error) {
    return { error: mensajeErrorGuardado(error) };
  }

  const { data: equiposPartido } = await supabase
    .from("equipos")
    .select("id, nombre")
    .in("id", [datos.equipo_local_id, datos.equipo_visitante_id]);
  const nombreLocal = equiposPartido?.find((e) => e.id === datos.equipo_local_id)?.nombre ?? "Local";
  const nombreVisitante =
    equiposPartido?.find((e) => e.id === datos.equipo_visitante_id)?.nombre ?? "Visitante";

  revalidatePath(`/admin/ligas/${ligaId}/partidos`);
  return { exito: `${nombreLocal} vs ${nombreVisitante} (jornada ${datos.jornada}) se cargó correctamente.` };
}

export async function actualizarPartido(
  ligaId: string,
  partidoId: string,
  _prevState: State,
  formData: FormData,
): Promise<State> {
  const datos = parsearPartido(formData);
  if ("error" in datos) return datos;

  const supabase = await createClient();

  const errorRango = await validarRangoJornada(supabase, ligaId, datos.jornada);
  if (errorRango) return { error: errorRango };

  const errorJornada = await validarEquipoNoRepiteEnJornada(
    supabase,
    ligaId,
    datos.jornada,
    datos.equipo_local_id,
    datos.equipo_visitante_id,
    partidoId,
  );
  if (errorJornada) return { error: errorJornada };

  const errorCruce = await validarCruceNoRepetido(
    supabase,
    ligaId,
    datos.equipo_local_id,
    datos.equipo_visitante_id,
    partidoId,
  );
  if (errorCruce) return { error: errorCruce };

  const { error } = await supabase.from("partidos").update(datos).eq("id", partidoId);

  if (error) {
    return { error: mensajeErrorGuardado(error) };
  }

  revalidatePath(`/admin/ligas/${ligaId}/partidos`);
  redirect(`/admin/ligas/${ligaId}/partidos`);
}

export async function borrarPartido(ligaId: string, partidoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("partidos").delete().eq("id", partidoId);

  if (error) {
    return {
      error: esJornadaLiquidada(error)
        ? MENSAJE_JORNADA_LIQUIDADA
        : "No pudimos borrar el partido. Intentá de nuevo.",
    };
  }

  revalidatePath(`/admin/ligas/${ligaId}/partidos`);
  redirect(`/admin/ligas/${ligaId}/partidos`);
}

export async function activarJornada(ligaId: string, jornada: number) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("partidos")
    .select("id", { count: "exact", head: true })
    .eq("liga_id", ligaId)
    .eq("jornada", jornada);

  if (!count) {
    return { error: "Esa jornada todavía no tiene partidos cargados." };
  }

  const { error } = await supabase
    .from("ligas")
    .update({ jornada_activa: jornada })
    .eq("id", ligaId);

  if (error) {
    return { error: "No pudimos activar la jornada. Intentá de nuevo." };
  }

  revalidatePath(`/admin/ligas/${ligaId}/partidos`);
}

export type ResultadoPartidoInput = {
  partidoId: string;
  golesLocal: number;
  golesVisitante: number;
};

export type ResultadoGuardadoResultados = {
  error?: string;
  erroresPorPartido?: Record<string, string>;
};

// Guarda los resultados de varios partidos de una jornada en una sola
// llamada (modo "Cargar resultados" de la jornada).
export async function cargarResultadosMasivo(
  ligaId: string,
  resultados: ResultadoPartidoInput[],
): Promise<ResultadoGuardadoResultados> {
  if (resultados.length === 0) {
    return { error: "No hay resultados para guardar." };
  }

  const erroresPorPartido: Record<string, string> = {};
  for (const r of resultados) {
    if (
      !Number.isInteger(r.golesLocal) ||
      r.golesLocal < 0 ||
      !Number.isInteger(r.golesVisitante) ||
      r.golesVisitante < 0
    ) {
      erroresPorPartido[r.partidoId] = "Los goles deben ser números enteros mayores o iguales a 0.";
    }
  }
  if (Object.keys(erroresPorPartido).length > 0) return { erroresPorPartido };

  const supabase = await createClient();
  const respuestas = await Promise.all(
    resultados.map(async (r) => {
      const { error } = await supabase
        .from("partidos")
        .update({
          goles_local: r.golesLocal,
          goles_visitante: r.golesVisitante,
          estado: "finalizado",
        })
        .eq("id", r.partidoId)
        .eq("liga_id", ligaId);
      return [r.partidoId, error] as const;
    }),
  );
  for (const [partidoId, error] of respuestas) {
    if (error) {
      erroresPorPartido[partidoId] = esJornadaLiquidada(error)
        ? MENSAJE_JORNADA_LIQUIDADA
        : "No pudimos guardar este resultado.";
    }
  }

  revalidatePath(`/admin/ligas/${ligaId}/partidos`);
  if (Object.keys(erroresPorPartido).length > 0) return { erroresPorPartido };
  return {};
}

export type ResultadoCargaMasiva = {
  error?: string;
  erroresPorFila?: ErrorFilaFixture[];
  cantidadCargada?: number;
};

export async function cargarFixtureMasivo(
  ligaId: string,
  filas: FilaFixtureCruda[],
): Promise<ResultadoCargaMasiva> {
  if (filas.length === 0) {
    return { error: "El archivo no tiene filas para cargar." };
  }
  if (filas.length > MAX_FILAS_CARGA_MASIVA) {
    return {
      error: `El archivo tiene ${filas.length} filas; el máximo soportado es ${MAX_FILAS_CARGA_MASIVA}.`,
    };
  }

  const supabase = await createClient();

  const { data: equipos } = await supabase.from("equipos").select("id, nombre").eq("liga_id", ligaId);
  const { data: partidos } = await supabase
    .from("partidos")
    .select("jornada, equipo_local_id, equipo_visitante_id")
    .eq("liga_id", ligaId);

  const { erroresPorFila, filasResueltas } = validarLoteFixture(
    filas,
    equipos ?? [],
    (partidos ?? []).map((p) => ({
      jornada: p.jornada,
      equipoLocalId: p.equipo_local_id,
      equipoVisitanteId: p.equipo_visitante_id,
    })),
  );

  if (erroresPorFila.length > 0) {
    return { erroresPorFila };
  }

  const { error } = await supabase.from("partidos").insert(
    filasResueltas.map((f) => ({
      liga_id: ligaId,
      jornada: f.jornada,
      equipo_local_id: f.equipoLocalId,
      equipo_visitante_id: f.equipoVisitanteId,
      estado: "pendiente" as const,
    })),
  );

  if (error) {
    return { error: mensajeErrorGuardado(error) };
  }

  revalidatePath(`/admin/ligas/${ligaId}/partidos`);
  return { cantidadCargada: filasResueltas.length };
}

// Solo actualiza y revalida, sin redirect, para que la edición de horarios
// se pueda hacer inline sin salir de la jornada
// (a diferencia de actualizarPartido, pensado para el form completo).
export async function cargarHorario(
  ligaId: string,
  partidoId: string,
  fechaHora: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("partidos")
    .update({ fecha_hora: fechaHora })
    .eq("id", partidoId);

  if (error) {
    return {
      error: esJornadaLiquidada(error)
        ? MENSAJE_JORNADA_LIQUIDADA
        : "No pudimos guardar el horario. Intentá de nuevo.",
    };
  }

  revalidatePath(`/admin/ligas/${ligaId}/partidos`);
}
