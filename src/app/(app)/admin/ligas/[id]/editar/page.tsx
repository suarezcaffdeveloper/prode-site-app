import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { LigaForm } from "../../liga-form";
import { actualizarLiga } from "../../actions";

export default async function EditarLigaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: liga } = await supabase
    .from("ligas")
    .select("id, nombre, descripcion, activa")
    .eq("id", id)
    .single();

  if (!liga) notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          ADMINISTRACIÓN
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Editar liga
        </h1>
      </div>
      <Card className="p-6">
        <LigaForm
          action={actualizarLiga.bind(null, liga.id)}
          submitLabel="Guardar cambios"
          defaultValues={liga}
          showActivaToggle
        />
      </Card>
    </div>
  );
}
