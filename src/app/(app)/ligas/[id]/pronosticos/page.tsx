import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import { MarcadorResultado } from "@/components/ui/marcador";
import { calcularSaldoDisponible } from "@/lib/creditos";
import { formatearPesos, obtenerPozoJornada } from "@/lib/pozo";
import { crearCarton, actualizarCarton } from "./actions";
import { NuevoCartonForm } from "./nuevo-carton-form";
import { CartonCard } from "./carton-card";
import { CuentaRegresivaCierre } from "./cuenta-regresiva";
import { FiltroJornadas } from "./filtro-jornadas";

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

type CartonConPronosticos = {
  id: string;
  created_at: string;
  pronosticos: {
    partido_id: string;
    goles_local_prediccion: number;
    goles_visitante_prediccion: number;
  }[];
};

export default async function PronosticosLigaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jornada?: string }>;
}) {
  const { id } = await params;
  const { jornada: jornadaParam } = await searchParams;
  const supabase = await createClient();

  const { data: liga, error: ligaError } = await supabase
    .from("ligas")
    .select("id, nombre, activa")
    .eq("id", id)
    .single();

  if (ligaError) throw new Error(`No se pudo cargar la liga ${id}: ${ligaError.message}`);
  if (!liga || !liga.activa) notFound();

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

  const { data: activaData } = await supabase.rpc("jornada_activa", { p_liga_id: id });
  const activa =
    (activaData as { jornada: number; hora_cierre: string | null }[] | null)?.[0] ?? null;
  const jornadaActual = activa?.jornada ?? null;

  const estadoJornadaActiva = !activa
    ? "sin_jornada"
    : activa.hora_cierre === null
      ? "bloqueada"
      : new Date(activa.hora_cierre) <= new Date()
        ? "cerrada"
        : "abierta";

  const partidosPorJornada = new Map<number, Partido[]>();
  if (tieneSuscripcionActiva) {
    const { data: todosPartidos } = await supabase
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

    for (const partido of todosPartidos ?? []) {
      const grupo = partidosPorJornada.get(partido.jornada) ?? [];
      grupo.push(partido);
      partidosPorJornada.set(partido.jornada, grupo);
    }
  }

  // El filtro ofrece todas las fechas con fixture cargado, anteriores o
  // posteriores a la activa: para una fecha que no es la activa, cada
  // partido se muestra con su resultado si ya se jugó, o como pendiente si
  // todavía no (ver el bloque de "Resultados" más abajo).
  const jornadasDisponibles = [...partidosPorJornada.keys()].sort((a, b) => a - b);

  const jornadaParamNum = Number(jornadaParam);
  const jornadaSeleccionada = jornadasDisponibles.includes(jornadaParamNum)
    ? jornadaParamNum
    : (jornadaActual ?? jornadasDisponibles.at(-1) ?? null);

  const esActivaSeleccionada =
    jornadaSeleccionada !== null && jornadaSeleccionada === jornadaActual;
  const partidosSeleccionados =
    jornadaSeleccionada !== null ? (partidosPorJornada.get(jornadaSeleccionada) ?? []) : [];

  let saldo = 0;
  let cartones: CartonConPronosticos[] = [];

  if (tieneSuscripcionActiva && jornadaSeleccionada !== null) {
    if (esActivaSeleccionada) {
      const { data: lotes } = await supabase
        .from("creditos_lotes")
        .select("cantidad_total, cantidad_usada, expira_en")
        .eq("usuario_id", user!.id)
        .eq("liga_id", id);
      saldo = calcularSaldoDisponible(lotes ?? []);
    }

    const { data: cartonesData } = await supabase
      .from("cartones")
      .select(
        "id, created_at, pronosticos (partido_id, goles_local_prediccion, goles_visitante_prediccion)",
      )
      .eq("liga_id", id)
      .eq("jornada", jornadaSeleccionada)
      .eq("usuario_id", user!.id)
      .order("created_at", { ascending: true })
      .returns<CartonConPronosticos[]>();
    cartones = cartonesData ?? [];
  }

  const pozo =
    tieneSuscripcionActiva && jornadaSeleccionada !== null
      ? await obtenerPozoJornada(supabase, id, jornadaSeleccionada)
      : null;

  const partidoIds = partidosSeleccionados.map((p) => p.id);
  const cargados = cartones.length;
  const totalPosibles = saldo + cargados;
  const hayFinalizados = partidosSeleccionados.some((p) => p.estado === "finalizado");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {liga.nombre.toUpperCase()}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Tus prodes
        </h1>
        <Link
          href={`/ligas/${id}/partidos`}
          className="mt-2 inline-block text-sm font-medium text-pitch-700 hover:underline"
        >
          Ver fixture completo →
        </Link>
      </div>

      {!tieneSuscripcionActiva ? (
        <Card className="p-6">
          <p className="rounded-lg bg-amber-500/10 p-4 text-sm text-amber-700">
            Necesitás una suscripción activa en esta liga para cargar pronósticos.{" "}
            <Link href={`/ligas/${id}`} className="font-medium underline">
              Elegir un plan →
            </Link>
          </p>
        </Card>
      ) : jornadaSeleccionada === null ? (
        <Card className="p-6">
          <p className="rounded-lg bg-chalk-100 p-4 text-sm text-ink-600">
            Todavía no hay ninguna jornada habilitada para pronosticar en esta liga.
          </p>
        </Card>
      ) : (
        <>
          <FiltroJornadas
            ligaId={id}
            jornadas={jornadasDisponibles}
            jornadaActual={jornadaActual}
            jornadaSeleccionada={jornadaSeleccionada}
          />

          <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest ${
                  !esActivaSeleccionada
                    ? "bg-chalk-100 text-ink-600"
                    : estadoJornadaActiva === "abierta"
                      ? "bg-lime-400/25 text-pitch-700"
                      : estadoJornadaActiva === "bloqueada"
                        ? "bg-coral-500/10 text-coral-700"
                        : "bg-chalk-100 text-ink-600"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    !esActivaSeleccionada
                      ? "bg-ink-400"
                      : estadoJornadaActiva === "abierta"
                        ? "bg-lime-400"
                        : estadoJornadaActiva === "bloqueada"
                          ? "bg-coral-500"
                          : "bg-ink-400"
                  }`}
                  aria-hidden="true"
                />
                JORNADA {jornadaSeleccionada} ·{" "}
                {!esActivaSeleccionada
                  ? hayFinalizados
                    ? "JUGADA"
                    : "PRÓXIMA"
                  : estadoJornadaActiva === "abierta"
                    ? "ABIERTA"
                    : estadoJornadaActiva === "bloqueada"
                      ? "BLOQUEADA"
                      : "CERRADA"}
              </span>

              {esActivaSeleccionada && estadoJornadaActiva === "abierta" && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-lime-400/25 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest text-pitch-700">
                  <ClipboardList className="h-3 w-3" aria-hidden="true" />
                  {saldo} restantes
                </span>
              )}
            </div>

            {esActivaSeleccionada && estadoJornadaActiva === "abierta" && activa?.hora_cierre && (
              <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5">
                <CuentaRegresivaCierre horaCierre={activa.hora_cierre} />
                <div className="flex flex-col items-end text-right">
                  {pozo && (
                    <>
                      <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                        POZO PARA EL GANADOR
                      </span>
                      <span className="font-display text-xl font-bold leading-tight text-pitch-700">
                        {formatearPesos(pozo.pozo_total)}
                      </span>
                    </>
                  )}
                  <span className="text-[11px] font-medium text-ink-400">
                    {cargados} de {totalPosibles} cargados
                  </span>
                </div>
              </div>
            )}

            {pozo && !(esActivaSeleccionada && estadoJornadaActiva === "abierta") && (
              <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
                <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                  {pozo.liquidada ? "POZO REPARTIDO" : "POZO PARA EL GANADOR"}
                </span>
                <div className="flex flex-col items-end text-right">
                  <span className="font-display text-xl font-bold leading-tight text-pitch-700">
                    {formatearPesos(pozo.pozo_total)}
                  </span>
                  {pozo.liquidada && (
                    <span className="text-[11px] font-medium text-ink-400">
                      {pozo.cantidad_ganadores === 0
                        ? "Sin ganadores: el pozo pasa a la próxima jornada"
                        : `${pozo.cantidad_ganadores} ${
                            pozo.cantidad_ganadores === 1 ? "prode ganador" : "prodes ganadores"
                          }`}
                    </span>
                  )}
                </div>
              </div>
            )}

            {pozo && !pozo.liquidada && pozo.pozo_acumulado_entrante > 0 && (
              <p className="text-[11px] font-medium text-ink-400">
                Incluye {formatearPesos(pozo.pozo_acumulado_entrante)} acumulados de la jornada
                anterior.
              </p>
            )}

            {esActivaSeleccionada && estadoJornadaActiva === "bloqueada" && (
              <p className="rounded-lg bg-coral-500/10 p-4 text-sm text-coral-700">
                La jornada {jornadaSeleccionada} está bloqueada: todavía falta cargar el horario de
                algún partido. Podés revisar el fixture completo mientras tanto.
              </p>
            )}

            {esActivaSeleccionada && estadoJornadaActiva === "cerrada" && (
              <p className="rounded-lg bg-chalk-100 p-4 text-sm text-ink-600">
                La jornada {jornadaSeleccionada} está cerrada. Estamos esperando que se carguen
                todos los resultados para habilitar la próxima jornada.
              </p>
            )}
          </Card>

          {esActivaSeleccionada && estadoJornadaActiva === "abierta" && (
            <Card className="p-6">
              <p className="mb-3 text-sm font-semibold text-ink-900">Cargar este prode</p>
              <NuevoCartonForm
                partidos={partidosSeleccionados}
                action={crearCarton.bind(null, id, jornadaSeleccionada, partidoIds)}
                deshabilitado={saldo === 0}
                motivoDeshabilitado={
                  saldo === 0 ? "No te quedan prodes disponibles para esta liga." : undefined
                }
              />
            </Card>
          )}

          {!esActivaSeleccionada && (
            <Card className="flex flex-col gap-4 p-6">
              <p className="text-sm font-semibold text-ink-900">
                {hayFinalizados ? "Resultados" : "Partidos de esta fecha"}
              </p>
              <div className="flex flex-col gap-2.5">
                {partidosSeleccionados.map((partido) => (
                  <div
                    key={partido.id}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
                  >
                    <div className="flex min-w-0 items-center justify-end gap-1.5">
                      <Escudo
                        url={partido.equipo_local.escudo_url}
                        nombre={partido.equipo_local.nombre}
                        className="h-6 w-6 shrink-0 text-[10px]"
                      />
                      <p className="min-w-0 flex-1 truncate text-right text-sm font-medium text-ink-900">
                        {partido.equipo_local.nombre}
                      </p>
                    </div>
                    {partido.estado === "finalizado" ? (
                      <MarcadorResultado
                        golesLocal={partido.goles_local ?? 0}
                        golesVisitante={partido.goles_visitante ?? 0}
                      />
                    ) : (
                      <span className="rounded-md bg-chalk-100 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-ink-400">
                        vs
                      </span>
                    )}
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                        {partido.equipo_visitante.nombre}
                      </p>
                      <Escudo
                        url={partido.equipo_visitante.escudo_url}
                        nombre={partido.equipo_visitante.nombre}
                        className="h-6 w-6 shrink-0 text-[10px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex items-center gap-2.5">
            <p className="whitespace-nowrap text-sm font-semibold text-ink-600">
              Tus prodes para esta fecha
            </p>
            <div className="h-px flex-1 bg-line-strong" />
          </div>

          {cartones.length > 0 ? (
            <div className="flex flex-col gap-4">
              {cartones.map((carton, indice) => {
                const predicciones: Record<string, { golesLocal: number; golesVisitante: number }> =
                  {};
                for (const pronostico of carton.pronosticos) {
                  predicciones[pronostico.partido_id] = {
                    golesLocal: pronostico.goles_local_prediccion,
                    golesVisitante: pronostico.goles_visitante_prediccion,
                  };
                }
                return (
                  <CartonCard
                    key={carton.id}
                    numero={indice + 1}
                    partidos={partidosSeleccionados}
                    prediccionesIniciales={predicciones}
                    editable={esActivaSeleccionada && estadoJornadaActiva === "abierta"}
                    actualizarCarton={actualizarCarton.bind(null, id, carton.id)}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-ink-600">
              Todavía no cargaste ningún prode para esta fecha.
            </p>
          )}
        </>
      )}
    </div>
  );
}
