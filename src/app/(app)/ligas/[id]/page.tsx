import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { MarcadorEstado, MarcadorCodigo } from "@/components/ui/marcador";
import { calcularSaldoDisponible } from "@/lib/creditos";
import { formatearPesos, obtenerPozoJornada } from "@/lib/pozo";
import {
  calcularTablaPosiciones,
  type EquipoRef,
  type PartidoFinalizado,
} from "@/lib/estadisticas";
import { LigaHero, type EstadoJornada } from "./liga-hero";
import { InicioPartidos, type PartidoInicio } from "./inicio-partidos";
import { InicioTablaResumen } from "./inicio-tabla-resumen";
import { InicioComoSeJuega } from "./inicio-como-se-juega";

type EquipoRow = { id: string; nombre: string; escudo_url: string | null };

type PartidoFinalizadoRow = {
  jornada: number;
  equipo_local_id: string;
  equipo_visitante_id: string;
  goles_local: number | null;
  goles_visitante: number | null;
};

export default async function LigaInicioPage({
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

  if (!liga || !liga.activa) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: membresia }, { data: activaData }] = await Promise.all([
    supabase
      .from("membresias_liga")
      .select("estado_suscripcion")
      .eq("liga_id", id)
      .eq("usuario_id", user!.id)
      .maybeSingle(),
    supabase.rpc("jornada_activa", { p_liga_id: id }),
  ]);

  const tieneSuscripcionActiva = membresia?.estado_suscripcion === "activa";

  const activa =
    (activaData as { jornada: number; hora_cierre: string | null }[] | null)?.[0] ?? null;
  const jornadaActiva = activa?.jornada ?? null;
  const estadoJornada: EstadoJornada = !activa
    ? "sin_jornada"
    : activa.hora_cierre === null
      ? "bloqueada"
      : new Date(activa.hora_cierre) <= new Date()
        ? "cerrada"
        : "abierta";

  // RLS en "grupos" ya limita el resultado a los subgrupos donde el usuario
  // es creador o miembro (ver policy grupos_select_miembro_o_admin).
  const [
    partidosRes,
    lotesRes,
    cartonesRes,
    pozo,
    pozoAnterior,
    equiposRes,
    finalizadosRes,
    gruposRes,
  ] = await Promise.all([
    jornadaActiva !== null
      ? supabase
          .from("partidos")
          .select(
            `id, fecha_hora, goles_local, goles_visitante, estado,
             equipo_local:equipo_local_id (nombre, escudo_url),
             equipo_visitante:equipo_visitante_id (nombre, escudo_url)`,
          )
          .eq("liga_id", id)
          .eq("jornada", jornadaActiva)
          .order("fecha_hora", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true })
          .returns<PartidoInicio[]>()
      : null,
    tieneSuscripcionActiva
      ? supabase
          .from("creditos_lotes")
          .select("cantidad_total, cantidad_usada, expira_en")
          .eq("usuario_id", user!.id)
          .eq("liga_id", id)
      : null,
    tieneSuscripcionActiva && jornadaActiva !== null
      ? supabase
          .from("cartones")
          .select("id", { count: "exact", head: true })
          .eq("liga_id", id)
          .eq("jornada", jornadaActiva)
          .eq("usuario_id", user!.id)
      : null,
    jornadaActiva !== null ? obtenerPozoJornada(supabase, id, jornadaActiva) : null,
    jornadaActiva !== null && jornadaActiva > 1
      ? obtenerPozoJornada(supabase, id, jornadaActiva - 1)
      : null,
    supabase.from("equipos").select("id, nombre, escudo_url").eq("liga_id", id).returns<EquipoRow[]>(),
    supabase
      .from("partidos")
      .select("jornada, equipo_local_id, equipo_visitante_id, goles_local, goles_visitante")
      .eq("liga_id", id)
      .eq("estado", "finalizado")
      .returns<PartidoFinalizadoRow[]>(),
    tieneSuscripcionActiva
      ? supabase.from("grupos").select("id, nombre, codigo_invitacion").eq("liga_id", id)
      : null,
  ]);

  const partidos = partidosRes?.data ?? [];
  const saldo = lotesRes?.data ? calcularSaldoDisponible(lotesRes.data) : 0;
  const cargados = cartonesRes?.count ?? 0;
  const misGrupos = gruposRes?.data ?? [];

  const equipos: EquipoRef[] = (equiposRes.data ?? []).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    escudoUrl: e.escudo_url,
  }));
  const finalizados: PartidoFinalizado[] = (finalizadosRes.data ?? []).flatMap((p) =>
    p.goles_local === null || p.goles_visitante === null
      ? []
      : [
          {
            jornada: p.jornada,
            equipoLocalId: p.equipo_local_id,
            equipoVisitanteId: p.equipo_visitante_id,
            golesLocal: p.goles_local,
            golesVisitante: p.goles_visitante,
          },
        ],
  );
  const tabla = finalizados.length > 0 ? calcularTablaPosiciones(equipos, finalizados) : [];

  const mostrarAnterior = pozoAnterior?.liquidada === true;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <LigaHero
        ligaId={id}
        nombre={liga.nombre}
        jornada={jornadaActiva}
        estadoJornada={estadoJornada}
        horaCierre={activa?.hora_cierre ?? null}
        pozoTotal={pozo?.pozo_total ?? null}
        membresia={membresia?.estado_suscripcion ?? null}
        saldo={saldo}
        cargados={cargados}
      />

      {liga.descripcion && <p className="-mt-4 text-sm text-ink-600">{liga.descripcion}</p>}

      {!tieneSuscripcionActiva && <InicioComoSeJuega />}

      {membresia?.estado_suscripcion === "pendiente" && (
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink-900">Tu suscripción</p>
            <MarcadorEstado estado="pendiente" />
          </div>
          <p className="rounded-lg bg-amber-500/10 p-4 text-sm text-amber-700">
            Ya recibimos tu comprobante y lo estamos revisando. En cuanto lo confirmemos, tu
            suscripción pasa a <strong>activa</strong> y vas a poder cargar tus pronósticos y
            crear o unirte a subgrupos.
          </p>
        </Card>
      )}

      {membresia?.estado_suscripcion === "inactiva" && (
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink-900">Tu suscripción</p>
            <MarcadorEstado estado="inactiva" />
          </div>
          <p className="rounded-lg bg-coral-500/10 p-4 text-sm text-coral-700">
            Tu suscripción está inactiva. Elegí un plan de nuevo y subí el comprobante para
            reactivarla.
          </p>
        </Card>
      )}

      {jornadaActiva !== null && partidos.length > 0 && (
        <InicioPartidos ligaId={id} jornada={jornadaActiva} partidos={partidos} />
      )}

      {mostrarAnterior && pozoAnterior && jornadaActiva !== null && (
        <Card className="flex items-center gap-4 p-5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-400/25 text-pitch-700"
            aria-hidden="true"
          >
            <Trophy className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
              FECHA {jornadaActiva - 1} · RESULTADO
            </p>
            {pozoAnterior.cantidad_ganadores === 0 ? (
              <p className="text-sm text-ink-900">
                <strong>Sin ganadores.</strong> Los {formatearPesos(pozoAnterior.pozo_total)} del
                pozo se acumularon a esta fecha.
              </p>
            ) : (
              <p className="text-sm text-ink-900">
                <strong>{formatearPesos(pozoAnterior.pozo_total)}</strong> repartidos entre{" "}
                {pozoAnterior.cantidad_ganadores}{" "}
                {pozoAnterior.cantidad_ganadores === 1 ? "prode ganador" : "prodes ganadores"}.
              </p>
            )}
          </div>
        </Card>
      )}

      {tabla.length > 0 && <InicioTablaResumen ligaId={id} filas={tabla} />}

      {tieneSuscripcionActiva && (
        <section className="flex flex-col gap-3">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
              SUBGRUPOS
            </p>
            <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">
              Jugá con tus amigos
            </h2>
          </div>

          {misGrupos.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {misGrupos.map((grupo) => (
                <li key={grupo.id}>
                  <Link href={`/grupos/${grupo.id}`}>
                    <Card className="flex items-center justify-between gap-4 p-5 transition-colors hover:border-pitch-500">
                      <p className="font-medium text-ink-900">{grupo.nombre}</p>
                      <MarcadorCodigo codigo={grupo.codigo_invitacion} />
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="p-5 text-sm text-ink-600">
              Todavía no estás en ningún subgrupo.
            </Card>
          )}

          <Link
            href={`/ligas/${id}/planes#subgrupos`}
            className="text-sm font-medium text-pitch-700 hover:underline"
          >
            Crear o unirme a un subgrupo →
          </Link>
        </section>
      )}

      {tieneSuscripcionActiva && <InicioComoSeJuega />}
    </div>
  );
}
