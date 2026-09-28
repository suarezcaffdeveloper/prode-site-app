import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcularPartidosPorJornadaCompleta, calcularTotalJornadas } from "@/lib/fixture";
import { PartidosAdmin } from "./partidos-admin";
import {
  crearPartido,
  cargarResultadosMasivo,
  cargarHorario,
  activarJornada,
  cargarFixtureMasivo,
} from "./actions";

type EquipoRef = { id: string; nombre: string; escudo_url: string | null };

export default async function PartidosLigaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: liga, error: ligaError } = await supabase
    .from("ligas")
    .select("id, nombre, jornada_activa")
    .eq("id", id)
    .single();

  if (ligaError) throw new Error(`No se pudo cargar la liga ${id}: ${ligaError.message}`);
  if (!liga) notFound();

  const { data: equipos } = await supabase
    .from("equipos")
    .select("id, nombre")
    .eq("liga_id", id)
    .order("nombre", { ascending: true });

  const { data: partidos } = await supabase
    .from("partidos")
    .select(
      `id, jornada, fecha_hora, goles_local, goles_visitante, estado,
       equipo_local:equipo_local_id (id, nombre, escudo_url),
       equipo_visitante:equipo_visitante_id (id, nombre, escudo_url)`,
    )
    .eq("liga_id", id)
    .order("jornada", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<
      {
        id: string;
        jornada: number;
        fecha_hora: string | null;
        goles_local: number | null;
        goles_visitante: number | null;
        estado: "pendiente" | "finalizado";
        equipo_local: EquipoRef;
        equipo_visitante: EquipoRef;
      }[]
    >();

  const { data: liquidaciones } = await supabase
    .from("liquidaciones_jornada")
    .select("jornada")
    .eq("liga_id", id)
    .returns<{ jornada: number }[]>();
  const jornadasLiquidadas = (liquidaciones ?? []).map((l) => l.jornada);

  const partidosPorJornada = new Map<number, typeof partidos>();
  for (const partido of partidos ?? []) {
    const grupo = partidosPorJornada.get(partido.jornada) ?? [];
    grupo.push(partido);
    partidosPorJornada.set(partido.jornada, grupo);
  }

  const cantidadEquipos = equipos?.length ?? 0;
  const totalJornadas = calcularTotalJornadas(cantidadEquipos);
  const cupoJornada = calcularPartidosPorJornadaCompleta(cantidadEquipos);

  const ocupacionPorJornada: Record<number, string[]> = {};
  for (const partido of partidos ?? []) {
    const ocupados = ocupacionPorJornada[partido.jornada] ?? [];
    ocupados.push(partido.equipo_local.id, partido.equipo_visitante.id);
    ocupacionPorJornada[partido.jornada] = ocupados;
  }

  const jornadasDisponibles = Array.from({ length: totalJornadas }, (_, i) => i + 1).filter(
    (jornada) =>
      cupoJornada === 0 || (ocupacionPorJornada[jornada]?.length ?? 0) / 2 < cupoJornada,
  );

  const jornadas = Array.from({ length: totalJornadas }, (_, i) => {
    const numero = i + 1;
    const partidosJornada = partidosPorJornada.get(numero) ?? [];
    return {
      numero,
      partidos: partidosJornada.map((partido) => ({
        id: partido.id,
        estado: partido.estado,
        fechaHora: partido.fecha_hora,
        golesLocal: partido.goles_local,
        golesVisitante: partido.goles_visitante,
        local: partido.equipo_local,
        visitante: partido.equipo_visitante,
      })),
    };
  });

  // Arranca abierta sola la jornada activa (la que hay que cargar); si la liga
  // todavía no activó ninguna, la primera con lugar disponible.
  const jornadaAbiertaInicial =
    liga.jornada_activa ?? jornadasDisponibles[0] ?? (totalJornadas > 0 ? 1 : null);

  const partidosExistentes = (partidos ?? []).map((partido) => ({
    jornada: partido.jornada,
    equipoLocalId: partido.equipo_local.id,
    equipoVisitanteId: partido.equipo_visitante.id,
  }));

  return (
    <PartidosAdmin
      ligaId={id}
      ligaNombre={liga.nombre}
      equipos={equipos ?? []}
      jornadas={jornadas}
      jornadaAbiertaInicial={jornadaAbiertaInicial}
      jornadaActiva={liga.jornada_activa}
      jornadasLiquidadas={jornadasLiquidadas}
      jornadasDisponibles={jornadasDisponibles}
      ocupacionPorJornada={ocupacionPorJornada}
      totalJornadas={totalJornadas}
      partidosExistentes={partidosExistentes}
      crearPartidoAction={crearPartido.bind(null, id)}
      guardarResultadosAction={cargarResultadosMasivo.bind(null, id)}
      guardarHorarioAction={cargarHorario.bind(null, id)}
      activarJornadaAction={activarJornada.bind(null, id)}
      cargarFixtureMasivoAction={cargarFixtureMasivo.bind(null, id)}
    />
  );
}
