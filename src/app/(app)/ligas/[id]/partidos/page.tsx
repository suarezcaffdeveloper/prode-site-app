import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import { MarcadorPartido, MarcadorResultado } from "@/components/ui/marcador";

type EquipoRef = { id: string; nombre: string; escudo_url: string | null };

export default async function FixtureLigaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: liga } = await supabase
    .from("ligas")
    .select("id, nombre, activa")
    .eq("id", id)
    .single();

  if (!liga || !liga.activa) notFound();

  const { data: partidos } = await supabase
    .from("partidos")
    .select(
      `id, jornada, goles_local, goles_visitante, estado,
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
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {liga.nombre.toUpperCase()}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Fixture
        </h1>
      </div>

      {!partidos || partidos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-600">
          Todavía no hay partidos cargados para esta liga.
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
                        <Escudo
                          url={partido.equipo_local.escudo_url}
                          nombre={partido.equipo_local.nombre}
                          className="h-8 w-8 text-xs"
                        />
                        <p className="truncate text-sm font-medium text-ink-900">
                          {partido.equipo_local.nombre}
                        </p>
                        <span className="text-sm text-ink-400">–</span>
                        <p className="truncate text-sm font-medium text-ink-900">
                          {partido.equipo_visitante.nombre}
                        </p>
                        <Escudo
                          url={partido.equipo_visitante.escudo_url}
                          nombre={partido.equipo_visitante.nombre}
                          className="h-8 w-8 text-xs"
                        />
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        {partido.estado === "finalizado" ? (
                          <MarcadorResultado
                            golesLocal={partido.goles_local!}
                            golesVisitante={partido.goles_visitante!}
                          />
                        ) : (
                          <MarcadorPartido estado="pendiente" />
                        )}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Link href={`/ligas/${id}`} className="text-sm font-medium text-pitch-700 hover:underline">
        ← Volver a la liga
      </Link>
    </div>
  );
}
