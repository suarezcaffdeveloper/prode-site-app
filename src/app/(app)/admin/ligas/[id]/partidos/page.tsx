import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import { MarcadorPartido, MarcadorResultado } from "@/components/ui/marcador";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { PartidoForm } from "./partido-form";
import { crearPartido, borrarPartido } from "./actions";

type EquipoRef = { id: string; nombre: string; escudo_url: string | null };

export default async function PartidosLigaPage({
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

  const jornadas = new Map<number, typeof partidos>();
  for (const partido of partidos ?? []) {
    const grupo = jornadas.get(partido.jornada) ?? [];
    grupo.push(partido);
    jornadas.set(partido.jornada, grupo);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {liga.nombre.toUpperCase()}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Partidos
        </h1>
        <Link
          href={`/admin/ligas/${id}/equipos`}
          className="mt-1 inline-block text-sm font-medium text-pitch-700 hover:underline"
        >
          Ir a equipos →
        </Link>
      </div>

      {!partidos || partidos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-600">
          Todavía no cargaste ningún partido en esta liga.
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {[...jornadas.entries()].map(([jornada, partidosJornada]) => (
            <div key={jornada} className="flex flex-col gap-3">
              <p className="font-mono text-xs font-semibold tracking-[0.3em] text-ink-400">
                JORNADA {jornada}
              </p>
              <ul className="flex flex-col gap-3">
                {partidosJornada?.map((partido) => (
                  <li key={partido.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Escudo url={partido.equipo_local.escudo_url} nombre={partido.equipo_local.nombre} className="h-8 w-8 text-xs" />
                        <p className="truncate text-sm font-medium text-ink-900">
                          {partido.equipo_local.nombre}
                        </p>
                        {partido.estado === "finalizado" ? (
                          <MarcadorResultado
                            golesLocal={partido.goles_local!}
                            golesVisitante={partido.goles_visitante!}
                          />
                        ) : (
                          <span className="text-sm text-ink-400">vs</span>
                        )}
                        <p className="truncate text-sm font-medium text-ink-900">
                          {partido.equipo_visitante.nombre}
                        </p>
                        <Escudo url={partido.equipo_visitante.escudo_url} nombre={partido.equipo_visitante.nombre} className="h-8 w-8 text-xs" />
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        <MarcadorPartido estado={partido.estado} />
                        <Link
                          href={`/admin/ligas/${id}/partidos/${partido.id}/editar`}
                          className="text-sm font-medium text-pitch-700 hover:underline"
                        >
                          Editar
                        </Link>
                        <ConfirmDeleteButton
                          label="Borrar"
                          confirmLabel="¿Borrar este partido? No se puede deshacer."
                          action={borrarPartido.bind(null, id, partido.id)}
                        />
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Card className="p-6">
        <p className="mb-3 text-sm font-semibold text-ink-900">Cargar un partido nuevo</p>
        {!equipos || equipos.length < 2 ? (
          <p className="text-sm text-ink-600">
            Necesitás al menos dos equipos cargados para armar un partido.{" "}
            <Link href={`/admin/ligas/${id}/equipos`} className="font-medium text-pitch-700 hover:underline">
              Cargar equipos
            </Link>
          </p>
        ) : (
          <PartidoForm action={crearPartido.bind(null, id)} submitLabel="Crear partido" equipos={equipos} />
        )}
      </Card>
    </div>
  );
}
