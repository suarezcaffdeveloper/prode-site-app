import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import { ScrollIntoViewOnMount } from "@/components/scroll-into-view-on-mount";

type EquipoRef = { id: string; nombre: string; escudo_url: string | null };

type Partido = {
  id: string;
  jornada: number;
  goles_local: number | null;
  goles_visitante: number | null;
  estado: "pendiente" | "finalizado";
  equipo_local: EquipoRef;
  equipo_visitante: EquipoRef;
};

export default async function FixtureLigaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: liga, error: ligaError } = await supabase
    .from("ligas")
    .select("id, nombre, activa")
    .eq("id", id)
    .single();

  if (ligaError) throw new Error(`No se pudo cargar la liga ${id}: ${ligaError.message}`);
  if (!liga || !liga.activa) notFound();

  const { data: activaData } = await supabase.rpc("jornada_activa", { p_liga_id: id });
  const activa =
    (activaData as { jornada: number; hora_cierre: string | null }[] | null)?.[0] ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membresia } = await supabase
    .from("membresias_liga")
    .select("estado_suscripcion")
    .eq("liga_id", id)
    .eq("usuario_id", user!.id)
    .maybeSingle();

  const tieneSuscripcionActiva = membresia?.estado_suscripcion === "activa";

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
    .returns<Partido[]>();

  const jornadas = new Map<number, Partido[]>();
  for (const partido of partidos ?? []) {
    const grupo = jornadas.get(partido.jornada) ?? [];
    grupo.push(partido);
    jornadas.set(partido.jornada, grupo);
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            {liga.nombre.toUpperCase()}
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
            Fixture
          </h1>
          <Link
            href={`/ligas/${id}/pronosticos`}
            className="mt-2 inline-block text-sm font-medium text-pitch-700 hover:underline"
          >
            Cargar tus prodes{activa ? ` para la jornada ${activa.jornada}` : ""} →
          </Link>
        </div>
      </div>

      {!partidos || partidos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-600">
          Todavía no hay partidos cargados para esta liga.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...jornadas.entries()].map(([jornada, partidosJornada]) => {
            const esActiva = jornada === activa?.jornada;

            const card = (
              <Card
                className={`flex flex-col gap-3 p-5 ${
                  esActiva ? "border-pitch-500 ring-1 ring-pitch-500" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 border-b border-line pb-3">
                  <p className="font-mono text-[13px] font-bold tracking-[0.25em] text-pitch-600">
                    JORNADA {jornada}
                  </p>
                  {esActiva ? (
                    <Link
                      href={tieneSuscripcionActiva ? `/ligas/${id}/pronosticos` : `/ligas/${id}/planes`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pitch-700 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-chalk-0 hover:bg-pitch-600"
                    >
                      Jugar prode →
                    </Link>
                  ) : (
                    <p className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                      {partidosJornada.length} PARTIDO{partidosJornada.length === 1 ? "" : "S"}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2.5">
                  {partidosJornada.map((partido) => (
                    <div
                      key={partido.id}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5"
                    >
                      <div className="flex min-w-0 items-center justify-end gap-1.5">
                        <p className="min-w-0 flex-1 truncate text-right text-xs font-medium text-ink-900">
                          {partido.equipo_local.nombre}
                        </p>
                        <Escudo
                          url={partido.equipo_local.escudo_url}
                          nombre={partido.equipo_local.nombre}
                          className="h-6 w-6 shrink-0 text-[10px]"
                        />
                        {partido.estado === "finalizado" && (
                          <span className="inline-flex min-w-[20px] shrink-0 items-center justify-center rounded border border-pitch-500 px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-pitch-500">
                            {partido.goles_local}
                          </span>
                        )}
                      </div>

                      <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-pitch-500">
                        vs
                      </span>

                      <div className="flex min-w-0 items-center justify-start gap-1.5">
                        {partido.estado === "finalizado" && (
                          <span className="inline-flex min-w-[20px] shrink-0 items-center justify-center rounded border border-pitch-500 px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-pitch-500">
                            {partido.goles_visitante}
                          </span>
                        )}
                        <Escudo
                          url={partido.equipo_visitante.escudo_url}
                          nombre={partido.equipo_visitante.nombre}
                          className="h-6 w-6 shrink-0 text-[10px]"
                        />
                        <p className="min-w-0 flex-1 truncate text-left text-xs font-medium text-ink-900">
                          {partido.equipo_visitante.nombre}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );

            return esActiva ? (
              <ScrollIntoViewOnMount key={jornada}>{card}</ScrollIntoViewOnMount>
            ) : (
              <div key={jornada}>{card}</div>
            );
          })}
        </div>
      )}

      <Link href={`/ligas/${id}`} className="text-sm font-medium text-pitch-700 hover:underline">
        ← Volver a la liga
      </Link>
    </div>
  );
}
