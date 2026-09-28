import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Pencil, Plus } from "lucide-react";
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

  const cantidad = equipos?.length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/ligas"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-pitch-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Todas las ligas
        </Link>
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
              {liga.nombre.toUpperCase()}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
              Equipos
            </h1>
            <p className="mt-1 text-sm text-ink-600">
              {cantidad === 0
                ? "Todavía no hay equipos cargados."
                : `${cantidad} ${cantidad === 1 ? "equipo cargado" : "equipos cargados"}`}
            </p>
          </div>
          <Link
            href={`/admin/ligas/${id}/partidos`}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line-strong bg-chalk-0 px-4 py-2 text-sm font-semibold tracking-tight text-ink-900 transition-colors hover:border-pitch-700 hover:text-pitch-700"
          >
            Ir a partidos
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Panel de carga: siempre visible a la derecha y fijo al hacer scroll. */}
        <Card className="p-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
          <div className="mb-5 flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pitch-700 text-chalk-0"
              aria-hidden="true"
            >
              <Plus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight text-ink-900">
                Nuevo equipo
              </h2>
              <p className="text-xs text-ink-600">Se suma al listado al instante.</p>
            </div>
          </div>
          <EquipoForm
            key={cantidad}
            action={crearEquipo.bind(null, id)}
            submitLabel="Crear equipo"
            fullWidthSubmit
          />
        </Card>

        <div className="lg:col-start-1 lg:row-start-1">
          {!equipos || equipos.length === 0 ? (
            <Card className="flex flex-col items-center gap-1 border-dashed p-16 text-center">
              <p className="font-display text-lg font-semibold text-ink-900">
                Sin equipos todavía
              </p>
              <p className="text-sm text-ink-600">
                Cargá el primero con el panel &ldquo;Nuevo equipo&rdquo;.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {equipos.map((equipo) => (
                  <li
                    key={equipo.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-chalk-50"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <Escudo
                        url={equipo.escudo_url}
                        nombre={equipo.nombre}
                        className="h-11 w-11"
                      />
                      <p className="truncate font-display text-base font-semibold text-ink-900">
                        {equipo.nombre}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/admin/ligas/${id}/equipos/${equipo.id}/editar`}
                        className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-chalk-0 px-3.5 py-2 text-sm font-semibold tracking-tight text-ink-900 transition-colors hover:border-pitch-700 hover:text-pitch-700"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Editar
                      </Link>
                      <ConfirmDeleteButton
                        compact
                        label="Borrar"
                        confirmLabel={`¿Borrar "${equipo.nombre}"? No se puede deshacer.`}
                        action={borrarEquipo.bind(null, id, equipo.id)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
