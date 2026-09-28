import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatearPesos, obtenerPozoJornada, repartirPozo } from "@/lib/pozo";
import { AccionesGanadores } from "./acciones-ganadores";
import { deshacerLiquidacion, enviarAvisoGanadores, liquidarJornada } from "./actions";

type UsuarioRef = { nombre: string | null };

type GanadorLiquidado = {
  usuario_id: string;
  email: string;
  monto_premio: number;
  avisado_en: string | null;
  aviso_error: string | null;
  usuarios: UsuarioRef | UsuarioRef[] | null;
};

type FilaGanador = {
  usuarioId: string;
  nombre: string | null;
  email: string;
  cartones: number;
  monto: number;
  avisadoEn: string | null;
  avisoError: string | null;
};

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-2.5 text-sm">
      <dt className="text-ink-600">{etiqueta}</dt>
      <dd className="font-semibold tabular-nums text-ink-900">{valor}</dd>
    </div>
  );
}

export default async function GanadoresLigaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jornada?: string }>;
}) {
  const { id } = await params;
  const { jornada: jornadaParam } = await searchParams;
  const supabase = await createClient();

  const { data: liga } = await supabase
    .from("ligas")
    .select("id, nombre, porcentaje_pozo")
    .eq("id", id)
    .single();
  if (!liga) notFound();

  const { data: partidos } = await supabase
    .from("partidos")
    .select("jornada, estado")
    .eq("liga_id", id)
    .returns<{ jornada: number; estado: "pendiente" | "finalizado" }[]>();

  const { data: liquidaciones } = await supabase
    .from("liquidaciones_jornada")
    .select("jornada")
    .eq("liga_id", id)
    .returns<{ jornada: number }[]>();

  const resumenJornadas = new Map<number, { total: number; pendientes: number }>();
  for (const partido of partidos ?? []) {
    const resumen = resumenJornadas.get(partido.jornada) ?? { total: 0, pendientes: 0 };
    resumen.total += 1;
    if (partido.estado !== "finalizado") resumen.pendientes += 1;
    resumenJornadas.set(partido.jornada, resumen);
  }
  const jornadas = [...resumenJornadas.keys()].sort((a, b) => a - b);
  const liquidadas = new Set((liquidaciones ?? []).map((l) => l.jornada));

  if (jornadas.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <Encabezado ligaNombre={liga.nombre} ligaId={id} subtitulo="Todavía no hay jornadas para liquidar." />
        <Card className="flex flex-col items-center gap-1 border-dashed p-16 text-center">
          <p className="font-display text-lg font-semibold text-ink-900">Sin partidos cargados</p>
          <p className="text-sm text-ink-600">
            Cargá el fixture de la liga para poder liquidar jornadas y ver ganadores.
          </p>
        </Card>
      </div>
    );
  }

  const jornadaParamNum = Number(jornadaParam);
  const jornada = jornadas.includes(jornadaParamNum)
    ? jornadaParamNum
    : (jornadas.find((j) => !liquidadas.has(j)) ?? jornadas[jornadas.length - 1]);

  const resumen = resumenJornadas.get(jornada)!;
  const liquidada = liquidadas.has(jornada);
  const previasSinLiquidar = jornadas.filter((j) => j < jornada && !liquidadas.has(j));

  const pozo = await obtenerPozoJornada(supabase, id, jornada);

  let ganadores: FilaGanador[] = [];
  if (liquidada) {
    const { data: liquidacion } = await supabase
      .from("liquidaciones_jornada")
      .select("id")
      .eq("liga_id", id)
      .eq("jornada", jornada)
      .single();

    const { data: filas } = await supabase
      .from("ganadores_jornada")
      .select("usuario_id, email, monto_premio, avisado_en, aviso_error, usuarios(nombre)")
      .eq("liquidacion_id", liquidacion?.id ?? "")
      .returns<GanadorLiquidado[]>();

    const porUsuario = new Map<string, FilaGanador>();
    for (const fila of filas ?? []) {
      const usuario = Array.isArray(fila.usuarios) ? fila.usuarios[0] : fila.usuarios;
      const existente = porUsuario.get(fila.usuario_id);
      if (existente) {
        existente.cartones += 1;
        existente.monto += fila.monto_premio;
        existente.avisadoEn = existente.avisadoEn && fila.avisado_en ? existente.avisadoEn : null;
        existente.avisoError = existente.avisoError ?? fila.aviso_error;
      } else {
        porUsuario.set(fila.usuario_id, {
          usuarioId: fila.usuario_id,
          nombre: usuario?.nombre ?? null,
          email: fila.email,
          cartones: 1,
          monto: fila.monto_premio,
          avisadoEn: fila.avisado_en,
          avisoError: fila.aviso_error,
        });
      }
    }
    ganadores = [...porUsuario.values()].sort((a, b) => a.email.localeCompare(b.email));
  } else {
    const { data: provisorios } = await supabase.rpc("ganadores_provisorios", {
      p_liga_id: id,
      p_jornada: jornada,
    });

    const filas = (provisorios ?? []) as {
      carton_id: string;
      usuario_id: string;
      nombre: string | null;
      email: string;
    }[];
    const { montoPorGanador } = repartirPozo(pozo?.pozo_total ?? 0, filas.length);

    const porUsuario = new Map<string, FilaGanador>();
    for (const fila of filas) {
      const existente = porUsuario.get(fila.usuario_id);
      if (existente) {
        existente.cartones += 1;
        existente.monto += montoPorGanador;
      } else {
        porUsuario.set(fila.usuario_id, {
          usuarioId: fila.usuario_id,
          nombre: fila.nombre,
          email: fila.email,
          cartones: 1,
          monto: montoPorGanador,
          avisadoEn: null,
          avisoError: null,
        });
      }
    }
    ganadores = [...porUsuario.values()];
  }

  const puedeLiquidar =
    !liquidada && resumen.total > 0 && resumen.pendientes === 0 && previasSinLiquidar.length === 0;
  const motivoNoLiquidar =
    resumen.pendientes > 0
      ? `Faltan resultados: ${resumen.pendientes} ${
          resumen.pendientes === 1 ? "partido pendiente" : "partidos pendientes"
        } en esta jornada.`
      : previasSinLiquidar.length > 0
        ? `Liquidá primero ${previasSinLiquidar.length === 1 ? "la jornada" : "las jornadas"} ${previasSinLiquidar.join(", ")}.`
        : undefined;

  const hayAvisados = ganadores.some((g) => g.avisadoEn);
  const hayPendientesDeAviso = ganadores.some((g) => !g.avisadoEn);
  const comision = pozo ? Math.round((pozo.recaudado - pozo.pozo_jornada) * 100) / 100 : 0;
  const totalCartonesGanadores = ganadores.reduce((acc, g) => acc + g.cartones, 0);

  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        ligaNombre={liga.nombre}
        ligaId={id}
        subtitulo={`${liquidadas.size} de ${jornadas.length} ${
          jornadas.length === 1 ? "jornada liquidada" : "jornadas liquidadas"
        }`}
      />

      <nav
        aria-label="Elegir jornada"
        className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-chalk-0 p-1"
      >
        {jornadas.map((j) => {
          const activa = j === jornada;
          return (
            <Link
              key={j}
              href={`/admin/ligas/${id}/ganadores?jornada=${j}`}
              aria-current={activa ? "page" : undefined}
              title={liquidadas.has(j) ? `Jornada ${j} · liquidada` : `Jornada ${j}`}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                activa
                  ? "bg-pitch-700 text-chalk-0"
                  : "text-ink-600 hover:bg-chalk-100 hover:text-pitch-700"
              }`}
            >
              J{j}
              {liquidadas.has(j) && (
                <Check
                  className={`h-3.5 w-3.5 ${activa ? "text-lime-300" : "text-pitch-600"}`}
                  strokeWidth={3}
                  aria-label="liquidada"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Panel de liquidación: pozo y acciones de la jornada, siempre visible. */}
        <Card className="p-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pitch-700 text-chalk-0"
                aria-hidden="true"
              >
                <Trophy className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold leading-tight text-ink-900">
                  Jornada {jornada}
                </h2>
                <p className="text-xs text-ink-600">Pozo y liquidación</p>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest ${
                liquidada ? "bg-lime-400/25 text-pitch-700" : "bg-chalk-100 text-ink-600"
              }`}
            >
              {liquidada ? "LIQUIDADA" : "SIN LIQUIDAR"}
            </span>
          </div>

          {pozo && (
            <div className="mb-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                  POZO TOTAL
                </span>
                <span className="font-display text-3xl font-bold leading-tight tabular-nums text-pitch-700">
                  {formatearPesos(pozo.pozo_total)}
                </span>
              </div>
              <dl className="flex flex-col">
                <FilaDato
                  etiqueta={`Prodes recaudados (${pozo.cantidad_cartones})`}
                  valor={formatearPesos(pozo.recaudado)}
                />
                <FilaDato
                  etiqueta={`Pozo de la jornada (${liga.porcentaje_pozo}%)`}
                  valor={formatearPesos(pozo.pozo_jornada)}
                />
                <FilaDato
                  etiqueta="Acumulado anterior"
                  valor={formatearPesos(pozo.pozo_acumulado_entrante)}
                />
                <FilaDato
                  etiqueta={`Plataforma (${100 - Number(liga.porcentaje_pozo)}%)`}
                  valor={formatearPesos(comision)}
                />
                <FilaDato
                  etiqueta="Por ganador"
                  valor={
                    ganadores.length === 0
                      ? "—"
                      : formatearPesos(
                          liquidada
                            ? ganadores.reduce((acc, g) => acc + g.monto, 0) /
                                Math.max(1, totalCartonesGanadores)
                            : repartirPozo(pozo.pozo_total, totalCartonesGanadores).montoPorGanador,
                        )
                  }
                />
              </dl>
            </div>
          )}

          {!liquidada && previasSinLiquidar.length > 0 && (
            <p className="mb-5 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700">
              Hay jornadas anteriores sin liquidar: el pozo acumulado puede estar incompleto hasta
              que las liquides.
            </p>
          )}

          <AccionesGanadores
            liquidada={liquidada}
            puedeLiquidar={puedeLiquidar}
            motivoNoLiquidar={motivoNoLiquidar}
            hayPendientesDeAviso={hayPendientesDeAviso && ganadores.length > 0}
            hayAvisados={hayAvisados}
            liquidarAction={liquidarJornada.bind(null, id, jornada)}
            deshacerAction={deshacerLiquidacion.bind(null, id, jornada)}
            avisarAction={enviarAvisoGanadores.bind(null, id, jornada)}
          />
        </Card>

        <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">
              {liquidada ? "Ganadores" : "Ganadores provisorios"}
            </h2>
            <span className="text-sm text-ink-600">
              {ganadores.length} {ganadores.length === 1 ? "ganador" : "ganadores"}
            </span>
          </div>

          {ganadores.length === 0 ? (
            <Card className="flex flex-col items-center gap-1 border-dashed p-16 text-center">
              <p className="font-display text-lg font-semibold text-ink-900">Sin ganadores</p>
              <p className="text-sm text-ink-600">
                {resumen.pendientes > 0
                  ? "Todavía no hay ganadores: faltan resultados en esta jornada."
                  : liquidada
                    ? "Nadie acertó todos los resultados: el pozo pasa a la próxima jornada."
                    : "Nadie acertó todos los resultados de esta jornada."}
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {ganadores.map((ganador) => (
                  <li
                    key={ganador.usuarioId}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-chalk-50"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pitch-900 font-display text-lg font-bold text-lime-300"
                        aria-hidden="true"
                      >
                        {(ganador.nombre || ganador.email).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-base font-semibold text-ink-900">
                          {ganador.nombre || ganador.email}
                        </p>
                        <p className="truncate text-sm text-ink-600">
                          {ganador.nombre ? `${ganador.email} · ` : ""}
                          {ganador.cartones}{" "}
                          {ganador.cartones === 1 ? "prode ganador" : "prodes ganadores"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-5">
                      <span className="font-display text-xl font-bold tabular-nums text-pitch-700">
                        {formatearPesos(ganador.monto)}
                      </span>
                      {liquidada && (
                        <span
                          title={ganador.avisoError ?? undefined}
                          className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest ${
                            ganador.avisadoEn
                              ? "bg-lime-400/25 text-pitch-700"
                              : ganador.avisoError
                                ? "bg-coral-500/10 text-coral-700"
                                : "bg-chalk-100 text-ink-600"
                          }`}
                        >
                          {ganador.avisadoEn
                            ? `AVISADO ${new Date(ganador.avisadoEn).toLocaleDateString("es-AR")}`
                            : ganador.avisoError
                              ? "ERROR AL AVISAR"
                              : "SIN AVISAR"}
                        </span>
                      )}
                    </div>
                    {ganador.avisoError && !ganador.avisadoEn && (
                      <p className="w-full text-xs text-coral-700">{ganador.avisoError}</p>
                    )}
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

function Encabezado({
  ligaNombre,
  ligaId,
  subtitulo,
}: {
  ligaNombre: string;
  ligaId: string;
  subtitulo: string;
}) {
  return (
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
            {ligaNombre.toUpperCase()}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Ganadores</h1>
          <p className="mt-1 text-sm text-ink-600">{subtitulo}</p>
        </div>
        <Link
          href={`/admin/ligas/${ligaId}/partidos`}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line-strong bg-chalk-0 px-4 py-2 text-sm font-semibold tracking-tight text-ink-900 transition-colors hover:border-pitch-700 hover:text-pitch-700"
        >
          Ir a partidos
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
