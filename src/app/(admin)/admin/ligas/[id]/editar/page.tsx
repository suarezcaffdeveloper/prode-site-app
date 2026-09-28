import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
    .select("id, nombre, descripcion, activa, logo_url")
    .eq("id", id)
    .single();

  if (!liga) notFound();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/ligas"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-pitch-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Todas las ligas
        </Link>
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            {liga.nombre.toUpperCase()}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Editar liga
          </h1>
        </div>
      </div>
      <Card className="p-8">
        <LigaForm
          action={actualizarLiga.bind(null, liga.id)}
          submitLabel="Guardar cambios"
          defaultValues={{
            nombre: liga.nombre,
            descripcion: liga.descripcion,
            activa: liga.activa,
            logoUrl: liga.logo_url,
          }}
          showActivaToggle
        />
      </Card>
    </div>
  );
}
