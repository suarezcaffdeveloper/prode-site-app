import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PartidoForm } from "../../partido-form";
import { actualizarPartido } from "../../actions";

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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          PARTIDOS
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Editar partido
        </h1>
      </div>
      <Card className="p-6">
        <PartidoForm
          action={actualizarPartido.bind(null, id, partido.id)}
          submitLabel="Guardar cambios"
          equipos={equipos ?? []}
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
    </div>
  );
}
