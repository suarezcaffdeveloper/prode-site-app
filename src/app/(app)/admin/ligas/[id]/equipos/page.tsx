import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { EquipoForm } from "./equipo-form";
import { crearEquipo, borrarEquipo } from "./actions";

export default async function EquiposLigaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: liga } = await supabase
    .from("ligas")
    .select("id, nombre")
    .eq("id", id)
    .single();

  if (!liga) notFound();

  const { data: equipos } = await supabase
    .from("equipos")
    .select("id, nombre, escudo_url")
    .eq("liga_id", id)
    .order("nombre", { ascending: true });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {liga.nombre.toUpperCase()}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Equipos
        </h1>
        <Link
          href={`/admin/ligas/${id}/partidos`}
          className="mt-1 inline-block text-sm font-medium text-pitch-700 hover:underline"
        >
          Ir a partidos →
        </Link>
      </div>

      {!equipos || equipos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-600">
          Todavía no cargaste ningún equipo en esta liga.
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {equipos.map((equipo) => (
            <li key={equipo.id}>
              <Card className="flex items-center justify-between gap-4 p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Escudo url={equipo.escudo_url} nombre={equipo.nombre} />
                  <p className="truncate font-medium text-ink-900">{equipo.nombre}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <Link
                    href={`/admin/ligas/${id}/equipos/${equipo.id}/editar`}
                    className="text-sm font-medium text-pitch-700 hover:underline"
                  >
                    Editar
                  </Link>
                  <ConfirmDeleteButton
                    label="Borrar"
                    confirmLabel={`¿Borrar "${equipo.nombre}"? No se puede deshacer.`}
                    action={borrarEquipo.bind(null, id, equipo.id)}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="p-6">
        <p className="mb-3 text-sm font-semibold text-ink-900">Cargar un equipo nuevo</p>
        <EquipoForm action={crearEquipo.bind(null, id)} submitLabel="Crear equipo" />
      </Card>
    </div>
  );
}
