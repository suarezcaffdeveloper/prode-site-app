import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { MarcadorCodigo, MarcadorActiva } from "@/components/ui/marcador";
import { renombrarGrupo, echarMiembro, eliminarGrupo } from "./actions";
import {
  RenombrarForm,
  EcharMiembroBoton,
  EliminarGrupoBoton,
} from "./gestion-creador";

export default async function GrupoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: grupo } = await supabase
    .from("grupos")
    .select("id, nombre, liga_id, creador_id, codigo_invitacion")
    .eq("id", id)
    .single();

  if (!grupo) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const esCreador = user?.id === grupo.creador_id;

  const { data: miembros } = await supabase
    .from("membresias_grupo")
    .select("id, usuario_id, usuarios(email, nombre)")
    .eq("grupo_id", id)
    .order("created_at");

  const usuarioIds = (miembros ?? []).map((m) => m.usuario_id);
  const { data: estadosLiga } = usuarioIds.length
    ? await supabase
        .from("membresias_liga")
        .select("usuario_id, estado_suscripcion")
        .eq("liga_id", grupo.liga_id)
        .in("usuario_id", usuarioIds)
    : { data: [] };

  const estadoPorUsuario = new Map(
    (estadosLiga ?? []).map((e) => [e.usuario_id, e.estado_suscripcion]),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            SUBGRUPO
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
            {grupo.nombre}
          </h1>
        </div>
        <MarcadorCodigo codigo={grupo.codigo_invitacion} />
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <p className="text-sm font-semibold text-ink-900">Miembros</p>
        <ul className="flex flex-col gap-3">
          {miembros?.map((miembro) => {
            const usuario = Array.isArray(miembro.usuarios)
              ? miembro.usuarios[0]
              : miembro.usuarios;
            const activa = estadoPorUsuario.get(miembro.usuario_id) === "activa";
            const esElMismo = miembro.usuario_id === grupo.creador_id;
            return (
              <li
                key={miembro.id}
                className="flex items-center justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {usuario?.nombre || usuario?.email}
                    {esElMismo && (
                      <span className="ml-2 text-xs font-normal text-ink-400">
                        (creador)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <MarcadorActiva activa={activa} />
                  {esCreador && !esElMismo && (
                    <EcharMiembroBoton
                      nombre={usuario?.nombre || usuario?.email || "este miembro"}
                      action={echarMiembro.bind(null, grupo.id, miembro.id)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {esCreador && (
        <Card className="flex flex-col gap-6 p-6">
          <div>
            <p className="mb-3 text-sm font-semibold text-ink-900">
              Renombrar subgrupo
            </p>
            <RenombrarForm
              nombreActual={grupo.nombre}
              action={renombrarGrupo.bind(null, grupo.id)}
            />
          </div>
          <div className="border-t border-line pt-6">
            <p className="mb-3 text-sm font-semibold text-coral-700">
              Zona de riesgo
            </p>
            <EliminarGrupoBoton
              action={eliminarGrupo.bind(null, grupo.id, grupo.liga_id)}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
