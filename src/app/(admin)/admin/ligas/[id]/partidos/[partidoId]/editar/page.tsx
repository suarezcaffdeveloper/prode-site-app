import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { calcularPartidosPorJornadaCompleta, calcularTotalJornadas } from "@/lib/fixture";
import { PartidoForm } from "../../partido-form";
import { actualizarPartido, borrarPartido } from "../../actions";

export default async function EditarPartidoPage({
  params,
}: {
  params: Promise<{ id: string; partidoId: string }>;
}) {
  const { id, partidoId } = await params;
  const supabase = await createClient();

  const { data: equipos } = await supabase
    .from("equipos")
    .select("id, nombre")
    .eq("liga_id", id)
    .order("nombre", { ascending: true });

  const { data: partido } = await supabase
    .from("partidos")
    .select(
      "id, jornada, fecha_hora, goles_local, goles_visitante, equipo_local_id, equipo_visitante_id",
    )
    .eq("id", partidoId)
    .single();

  if (!partido) notFound();

  const { data: otrosPartidos } = await supabase
    .from("partidos")
    .select("jornada, equipo_local_id, equipo_visitante_id")
    .eq("liga_id", id)
    .neq("id", partidoId);

  const cantidadEquipos = equipos?.length ?? 0;
  const totalJornadas = calcularTotalJornadas(cantidadEquipos);
  const partidosPorJornadaCompleta = calcularPartidosPorJornadaCompleta(cantidadEquipos);

  const ocupacionPorJornada: Record<number, string[]> = {};
  for (const otro of otrosPartidos ?? []) {
    const ocupados = ocupacionPorJornada[otro.jornada] ?? [];
    ocupados.push(otro.equipo_local_id, otro.equipo_visitante_id);
    ocupacionPorJornada[otro.jornada] = ocupados;
  }

  const jornadasDisponibles = Array.from({ length: totalJornadas }, (_, i) => i + 1).filter(
    (jornada) =>
      jornada === partido.jornada ||
      partidosPorJornadaCompleta === 0 ||
      (ocupacionPorJornada[jornada]?.length ?? 0) / 2 < partidosPorJornadaCompleta,
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href={`/admin/ligas/${id}/partidos`}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-pitch-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a partidos
        </Link>
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            PARTIDOS
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Editar partido
          </h1>
        </div>
      </div>
      <Card className="p-6">
        <PartidoForm
          action={actualizarPartido.bind(null, id, partido.id)}
          submitLabel="Guardar cambios"
          equipos={equipos ?? []}
          jornadasDisponibles={jornadasDisponibles}
          ocupacionPorJornada={ocupacionPorJornada}
          mostrarResultado
          defaultValues={{
            jornada: partido.jornada,
            equipoLocalId: partido.equipo_local_id,
            equipoVisitanteId: partido.equipo_visitante_id,
            fechaHora: partido.fecha_hora,
            golesLocal: partido.goles_local,
            golesVisitante: partido.goles_visitante,
          }}
        />
      </Card>
      <div className="flex justify-end">
        <ConfirmDeleteButton
          compact
          label="Borrar partido"
          confirmLabel="¿Borrar este partido? No se puede deshacer."
          action={borrarPartido.bind(null, id, partido.id)}
        />
      </div>
    </div>
  );
}
