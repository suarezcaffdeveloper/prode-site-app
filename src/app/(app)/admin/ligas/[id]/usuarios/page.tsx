import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { MarcadorEstado } from "@/components/ui/marcador";
import { EstadoSelector } from "./estado-selector";
import { cambiarEstadoSuscripcion } from "./actions";

export default async function UsuariosLigaPage({
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

  const { data: membresias } = await supabase
    .from("membresias_liga")
    .select("id, estado_suscripcion, usuarios(email, nombre)")
    .eq("liga_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {liga.nombre.toUpperCase()}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Suscripciones
        </h1>
      </div>

      {!membresias || membresias.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-600">
          Todavía nadie pidió suscribirse a esta liga.
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {membresias.map((membresia) => {
            const usuario = Array.isArray(membresia.usuarios)
              ? membresia.usuarios[0]
              : membresia.usuarios;
            return (
              <li key={membresia.id}>
                <Card className="flex items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {usuario?.nombre || usuario?.email}
                    </p>
                    {usuario?.nombre && (
                      <p className="truncate text-xs text-ink-400">
                        {usuario.email}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <MarcadorEstado estado={membresia.estado_suscripcion} />
                    <EstadoSelector
                      estadoActual={membresia.estado_suscripcion}
                      action={cambiarEstadoSuscripcion.bind(null, liga.id, membresia.id)}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
