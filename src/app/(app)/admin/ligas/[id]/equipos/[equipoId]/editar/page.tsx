import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EquipoForm } from "../../equipo-form";
import { actualizarEquipo } from "../../actions";

export default async function EditarEquipoPage({
  params,
}: {
  params: Promise<{ id: string; equipoId: string }>;
}) {
  const { id, equipoId } = await params;
  const supabase = await createClient();
  const { data: equipo } = await supabase
    .from("equipos")
    .select("id, nombre, escudo_url")
    .eq("id", equipoId)
    .single();

  if (!equipo) notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          EQUIPOS
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Editar equipo
        </h1>
      </div>
      <Card className="p-6">
        <EquipoForm
          action={actualizarEquipo.bind(null, id, equipo.id)}
          submitLabel="Guardar cambios"
          defaultValues={{ nombre: equipo.nombre, escudoUrl: equipo.escudo_url }}
        />
      </Card>
    </div>
  );
}
