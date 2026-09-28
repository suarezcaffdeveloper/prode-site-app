import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerMembresia } from "@/lib/suscripcion";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import { ScrollIntoViewOnMount } from "@/components/scroll-into-view-on-mount";
import { FixtureHero } from "./fixture-hero";
import {
  CalendarioFechas,
  FechaDestacada,
  RielFechas,
  type FechaFixture,
  type PartidoFixture,
} from "./fixture-escritorio";

type Partido = PartidoFixture;

export default async function FixtureLigaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: liga, error: ligaError } = await supabase
    .from("ligas")
    .select("id, nombre, activa")
    .eq("id", id)
    .single();

  if (ligaError) throw new Error(`No se pudo cargar la liga ${id}: ${ligaError.message}`);
  if (!liga || !liga.activa) notFound();

  const { data: activaData } = await supabase.rpc("jornada_activa", {
    p_liga_id: id,
  });
  const activa =
    (activaData as { jornada: number; hora_cierre: string | null }[] | null)?.[0] ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const membresia = await obtenerMembresia(supabase, id, user!.id);

  const tieneSuscripcionActiva = membresia?.estado_suscripcion === "activa";

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
    .returns<Partido[]>();

  const jornadas = new Map<number, Partido[]>();
  for (const partido of partidos ?? []) {
    const grupo = jornadas.get(partido.jornada) ?? [];
    grupo.push(partido);
    jornadas.set(partido.jornada, grupo);
  }

  const fechas: FechaFixture[] = [...jornadas.entries()].map(([jornada, partidosJornada]) => {
    const jugados = partidosJornada.filter((p) => p.estado === "finalizado").length;
    return {
      jornada,
      partidos: partidosJornada,
      jugados,
      estado:
        jornada === activa?.jornada
          ? "en_curso"
          : jugados === partidosJornada.length
            ? "jugada"
            : "proxima",
    };
  });
  const fechaActiva = fechas.find((f) => f.estado === "en_curso") ?? null;
  const partidosJugados = fechas.reduce((total, f) => total + f.jugados, 0);

  return (
    <div className="mx-auto flex w-full flex-col gap-8 lg:gap-10">
      <FixtureHero
        ligaId={id}
        ligaNombre={liga.nombre}
        suscripta={tieneSuscripcionActiva}
        stats={
          fechas.length > 0
            ? {
                jornadaActiva: fechaActiva?.jornada ?? null,
                totalFechas: fechas.length,
                fechasJugadas: fechas.filter((f) => f.jugados === f.partidos.length).length,
                partidosJugados,
                totalPartidos: partidos?.length ?? 0,
              }
            : null
        }
      />

      <div className="flex flex-wrap items-start justify-between gap-3 lg:hidden">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            {liga.nombre.toUpperCase()}
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">Fixture</h1>
          <Link
            href={`/ligas/${id}/pronosticos`}
            className="mt-2 inline-block text-sm font-medium text-pitch-700 hover:underline"
          >
            Cargar tus prodes
            {activa ? ` para la jornada ${activa.jornada}` : ""} →
          </Link>
        </div>
      </div>

      {!partidos || partidos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-600 lg:mx-auto lg:w-full lg:max-w-2xl lg:py-16 lg:text-base">
          Todavía no hay partidos cargados para esta liga.
        </Card>
      ) : (
        <>
          <RielFechas fechas={fechas} />

          {fechaActiva && (
            <FechaDestacada fecha={fechaActiva} ligaId={id} suscripta={tieneSuscripcionActiva} />
          )}

          <CalendarioFechas
            fechas={fechas.filter((f) => f.estado !== "en_curso")}
            ligaId={id}
            suscripta={tieneSuscripcionActiva}
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:hidden">
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
                        href={
                          tieneSuscripcionActiva
                            ? `/ligas/${id}/pronosticos`
                            : `/ligas/${id}/planes`
                        }
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pitch-700 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-chalk-0 hover:bg-pitch-600"
                      >
                        Jugar prode →
                      </Link>
                    ) : (
                      <p className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                        {partidosJornada.length} PARTIDO
                        {partidosJornada.length === 1 ? "" : "S"}
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
        </>
      )}

      <Link
        href={`/ligas/${id}`}
        className="text-sm font-medium text-pitch-700 hover:underline lg:hidden"
      >
        ← Volver a la liga
      </Link>
    </div>
  );
}
