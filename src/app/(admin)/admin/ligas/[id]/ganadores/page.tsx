import Link from "next/link";
import { notFound } from "next/navigation";
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

function Dato({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
        {etiqueta}
      </span>
      <span
        className={`font-display font-bold tabular-nums ${
          destacado ? "text-2xl text-pitch-700" : "text-lg text-ink-900"
        }`}
      >
        {valor}
      </span>
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
        <Encabezado ligaNombre={liga.nombre} ligaId={id} />
        <Card className="p-8 text-center text-sm text-ink-600">
          Esta liga todavía no tiene partidos cargados.
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

  return (
    <div className="flex flex-col gap-8">
      <Encabezado ligaNombre={liga.nombre} ligaId={id} />

      <div className="flex flex-wrap gap-2">
        {jornadas.map((j) => (
          <Link
            key={j}
            href={`/admin/ligas/${id}/ganadores?jornada=${j}`}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
              j === jornada
                ? "border-pitch-700 bg-pitch-700 text-chalk-0"
                : "border-line-strong bg-chalk-0 text-ink-900 hover:border-pitch-700 hover:text-pitch-700"
            }`}
          >
            J{j}
            {liquidadas.has(j) && (
              <span aria-label="liquidada" title="Liquidada">
                ✓
              </span>
            )}
          </Link>
        ))}
      </div>

      <Card className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-lg font-bold text-ink-900">Jornada {jornada}</p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest ${
              liquidada ? "bg-lime-400/25 text-pitch-700" : "bg-chalk-100 text-ink-600"
            }`}
          >
            {liquidada ? "LIQUIDADA" : "SIN LIQUIDAR"}
          </span>
        </div>

        {pozo && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            <Dato etiqueta={`PRODES (${pozo.cantidad_cartones})`} valor={formatearPesos(pozo.recaudado)} />
            <Dato
              etiqueta={`POZO (${liga.porcentaje_pozo}%)`}
              valor={formatearPesos(pozo.pozo_jornada)}
            />
            <Dato
              etiqueta="ACUMULADO"
              valor={formatearPesos(pozo.pozo_acumulado_entrante)}
            />
            <Dato etiqueta="POZO TOTAL" valor={formatearPesos(pozo.pozo_total)} destacado />
            <Dato
              etiqueta={`PLATAFORMA (${100 - Number(liga.porcentaje_pozo)}%)`}
              valor={formatearPesos(comision)}
            />
            <Dato
              etiqueta="POR GANADOR"
              valor={
                ganadores.length === 0
                  ? "—"
                  : formatearPesos(
                      liquidada
                        ? ganadores.reduce((acc, g) => acc + g.monto, 0) /
                            Math.max(1, ganadores.reduce((acc, g) => acc + g.cartones, 0))
                        : repartirPozo(
                            pozo.pozo_total,
                            ganadores.reduce((acc, g) => acc + g.cartones, 0),
                          ).montoPorGanador,
                    )
              }
            />
          </div>
        )}

        {!liquidada && previasSinLiquidar.length > 0 && (
          <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700">
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

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink-900">
          {liquidada ? "Ganadores" : "Ganadores provisorios"}
        </p>
        {ganadores.length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink-600">
            {resumen.pendientes > 0
              ? "Todavía no hay ganadores: faltan resultados en esta jornada."
              : liquidada
                ? "Nadie acertó todos los resultados: el pozo pasa a la próxima jornada."
                : "Nadie acertó todos los resultados de esta jornada."}
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {ganadores.map((ganador) => (
              <li key={ganador.usuarioId}>
                <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {ganador.nombre || ganador.email}
                    </p>
                    {ganador.nombre && (
                      <p className="truncate text-xs text-ink-400">{ganador.email}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-600">
                      {ganador.cartones} {ganador.cartones === 1 ? "prode ganador" : "prodes ganadores"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-5">
                    <span className="font-display text-lg font-bold tabular-nums text-pitch-700">
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
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Encabezado({ ligaNombre, ligaId }: { ligaNombre: string; ligaId: string }) {
  return (
    <div>
      <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
        {ligaNombre.toUpperCase()}
      </p>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">Ganadores</h1>
      <Link
        href={`/admin/ligas/${ligaId}/partidos`}
        className="mt-1 inline-block text-sm font-medium text-pitch-700 hover:underline"
      >
        Ir a partidos →
      </Link>
    </div>
  );
}
