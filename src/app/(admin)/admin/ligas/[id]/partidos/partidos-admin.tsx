"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Pencil,
  Play,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { Escudo } from "@/components/ui/escudo";
import { Card } from "@/components/ui/card";
import { MarcadorActiva, MarcadorResultado } from "@/components/ui/marcador";
import { aInputDatetimeLocal, deInputDatetimeLocal } from "@/lib/fecha-hora-input";
import type { FilaFixtureCruda, PartidoExistenteBatch } from "@/lib/fixture-batch";
import { PartidoForm } from "./partido-form";
import { CargaMasivaModal } from "./carga-masiva-modal";
import type {
  ResultadoCargaMasiva,
  ResultadoGuardadoResultados,
  ResultadoPartidoInput,
} from "./actions";

type EquipoRef = { id: string; nombre: string; escudo_url: string | null };

type PartidoRef = {
  id: string;
  estado: "pendiente" | "finalizado";
  fechaHora: string | null;
  golesLocal: number | null;
  golesVisitante: number | null;
  local: EquipoRef;
  visitante: EquipoRef;
};

type JornadaData = {
  numero: number;
  partidos: PartidoRef[];
};

type GolesInput = { local: string; visitante: string };

type ModoEdicion = { tipo: "horarios" | "resultados"; jornada: number };

type Aviso = { id: number; mensaje: string };

const DURACION_AVISO_MS = 6000;

function faltaHorario(jornada: JornadaData) {
  return jornada.partidos.length > 0 && jornada.partidos.some((p) => !p.fechaHora);
}

function ChipFaltaHorario() {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md bg-coral-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest text-coral-700"
      title="Mientras falte un horario, la jornada queda bloqueada para pronosticar"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-coral-500" aria-hidden="true" />
      FALTA HORARIO
    </span>
  );
}

function formatearFechaHora(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Botón de acción de cada jornada. Mismo lenguaje que el resto del admin:
// primario en verde sólido, secundario con borde, ambos con ícono + texto.
function BotonAccion({
  variante = "secundario",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" }) {
  const estilos =
    variante === "primario"
      ? "border-transparent bg-pitch-700 text-chalk-0 hover:bg-pitch-600"
      : "border-line-strong bg-chalk-0 text-ink-900 hover:border-pitch-700 hover:text-pitch-700";
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold tracking-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${estilos} ${className}`}
      {...props}
    />
  );
}

const INPUT_GOL =
  "h-9 w-11 rounded-md border border-line-strong bg-chalk-0 text-center text-sm font-semibold tabular-nums text-ink-900 [appearance:textfield] focus-visible:border-pitch-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-500/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// Una sola fila por partido, con grilla de columnas fijas para que horario,
// equipos, marcador y acciones queden alineados entre partidos. En mobile el
// horario pasa a su propia línea sobre los equipos.
function FilaCruce({
  ligaId,
  partido,
  indice,
  horario,
  resultado,
  error,
}: {
  ligaId: string;
  partido: PartidoRef;
  indice: number;
  horario?: { valor: string; onChange: (valor: string) => void };
  resultado?: { valor: GolesInput; onChange: (valor: GolesInput) => void };
  error?: string;
}) {
  const finalizado = partido.estado === "finalizado";
  const nombrePartido = `${partido.local.nombre} vs ${partido.visitante.nombre}`;
  const columnas = horario
    ? "grid-cols-[1fr_auto_1fr_2.25rem] sm:grid-cols-[11rem_1fr_auto_1fr_2.25rem]"
    : "grid-cols-[1fr_auto_1fr_2.25rem] sm:grid-cols-[7.5rem_1fr_auto_1fr_2.25rem]";

  return (
    <div
      className={`grid items-center gap-x-3 gap-y-2 px-5 py-3 text-sm transition-colors hover:bg-chalk-50 ${columnas} ${
        indice >= 1 ? "border-t border-line" : ""
      }`}
    >
      <div className="col-span-full sm:col-span-1">
        {horario ? (
          <input
            type="datetime-local"
            value={horario.valor}
            onChange={(e) => horario.onChange(e.target.value)}
            aria-label={`Horario de ${nombrePartido}`}
            className="h-9 w-full rounded-md border border-line-strong bg-chalk-0 px-2 text-xs text-ink-900 focus-visible:border-pitch-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-500/30"
          />
        ) : partido.fechaHora ? (
          <span className="text-xs font-medium tabular-nums text-ink-600">
            {formatearFechaHora(partido.fechaHora)}
          </span>
        ) : (
          <span className="text-xs font-semibold text-coral-700">Sin horario</span>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2">
        <p className="min-w-0 truncate text-right font-medium text-ink-900">{partido.local.nombre}</p>
        <Escudo url={partido.local.escudo_url} nombre={partido.local.nombre} className="h-7 w-7 shrink-0 text-[10px]" />
      </div>

      <div className="flex w-28 items-center justify-center">
        {resultado ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={resultado.valor.local}
              onChange={(e) => resultado.onChange({ ...resultado.valor, local: e.target.value })}
              aria-label={`Goles de ${partido.local.nombre}`}
              className={INPUT_GOL}
            />
            <span className="text-ink-400">–</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={resultado.valor.visitante}
              onChange={(e) => resultado.onChange({ ...resultado.valor, visitante: e.target.value })}
              aria-label={`Goles de ${partido.visitante.nombre}`}
              className={INPUT_GOL}
            />
          </div>
        ) : finalizado && partido.golesLocal !== null && partido.golesVisitante !== null ? (
          <MarcadorResultado golesLocal={partido.golesLocal} golesVisitante={partido.golesVisitante} />
        ) : (
          <span className="text-xs font-medium text-ink-400">vs</span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <Escudo url={partido.visitante.escudo_url} nombre={partido.visitante.nombre} className="h-7 w-7 shrink-0 text-[10px]" />
        <p className="min-w-0 truncate font-medium text-ink-900">{partido.visitante.nombre}</p>
      </div>

      <Link
        href={`/admin/ligas/${ligaId}/partidos/${partido.id}/editar`}
        aria-label={`Editar equipos, jornada o borrar ${nombrePartido}`}
        title="Editar equipos o jornada, o borrar el partido"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-chalk-0 text-ink-600 transition-colors hover:border-pitch-700 hover:text-pitch-700"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Link>

      {error && (
        <p role="alert" className="col-span-full text-xs font-medium text-coral-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function PartidosAdmin({
  ligaId,
  ligaNombre,
  equipos,
  jornadas,
  jornadaAbiertaInicial,
  jornadaActiva,
  jornadasLiquidadas,
  jornadasDisponibles,
  ocupacionPorJornada,
  totalJornadas,
  partidosExistentes,
  crearPartidoAction,
  guardarResultadosAction,
  guardarHorarioAction,
  activarJornadaAction,
  cargarFixtureMasivoAction,
}: {
  ligaId: string;
  ligaNombre: string;
  equipos: { id: string; nombre: string }[];
  jornadas: JornadaData[];
  jornadaAbiertaInicial: number | null;
  jornadaActiva: number | null;
  jornadasLiquidadas: number[];
  jornadasDisponibles: number[];
  ocupacionPorJornada: Record<number, string[]>;
  totalJornadas: number;
  partidosExistentes: PartidoExistenteBatch[];
  crearPartidoAction: (
    prevState: { error?: string; exito?: string },
    formData: FormData,
  ) => Promise<{ error?: string; exito?: string }>;
  guardarResultadosAction: (
    resultados: ResultadoPartidoInput[],
  ) => Promise<ResultadoGuardadoResultados>;
  guardarHorarioAction: (
    partidoId: string,
    fechaHora: string | null,
  ) => Promise<{ error?: string } | void>;
  activarJornadaAction: (jornada: number) => Promise<{ error?: string } | void>;
  cargarFixtureMasivoAction: (filas: FilaFixtureCruda[]) => Promise<ResultadoCargaMasiva>;
}) {
  const [abiertas, setAbiertas] = useState<Set<number>>(
    () => new Set(jornadaAbiertaInicial ? [jornadaAbiertaInicial] : []),
  );
  const [cargaMasivaAbierta, setCargaMasivaAbierta] = useState(false);
  const [activandoJornada, setActivandoJornada] = useState<number | null>(null);
  const [errorActivacion, setErrorActivacion] = useState<string>();
  const [pendingActivacion, startActivacion] = useTransition();

  const [aviso, setAviso] = useState<Aviso | null>(null);

  function mostrarAviso(mensaje: string) {
    setAviso({ id: Date.now(), mensaje });
  }

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
    return () => clearTimeout(timer);
  }, [aviso]);

  function abrirJornada(numero: number) {
    setAbiertas((prev) => (prev.has(numero) ? prev : new Set(prev).add(numero)));
  }

  function toggleJornada(numero: number) {
    setAbiertas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(numero)) siguiente.delete(numero);
      else siguiente.add(numero);
      return siguiente;
    });
  }

  function activar(numero: number) {
    setErrorActivacion(undefined);
    setActivandoJornada(numero);
    startActivacion(async () => {
      const resultado = await activarJornadaAction(numero);
      if (resultado?.error) {
        setErrorActivacion(resultado.error);
      } else {
        abrirJornada(numero);
      }
      setActivandoJornada(null);
    });
  }

  // Edición masiva de una jornada: todos los partidos muestran a la vez sus
  // inputs (horarios o resultados) con un único botón de guardado, para no
  // repetir "abrir -> editar -> guardar" partido por partido. Solo una
  // jornada y un modo a la vez.
  const [edicion, setEdicion] = useState<ModoEdicion | null>(null);
  const [horarios, setHorarios] = useState<Record<string, string>>({});
  const [resultados, setResultados] = useState<Record<string, GolesInput>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorEdicion, setErrorEdicion] = useState<string>();
  const [pendingGuardado, startGuardado] = useTransition();

  function cancelarEdicion() {
    setEdicion(null);
    setHorarios({});
    setResultados({});
    setErrores({});
    setErrorEdicion(undefined);
  }

  function empezarEdicion(jornada: JornadaData, tipo: ModoEdicion["tipo"]) {
    setErrores({});
    setErrorEdicion(undefined);
    if (tipo === "horarios") {
      setHorarios(
        Object.fromEntries(jornada.partidos.map((p) => [p.id, aInputDatetimeLocal(p.fechaHora)])),
      );
    } else {
      setResultados(
        Object.fromEntries(
          jornada.partidos.map((p) => [
            p.id,
            { local: p.golesLocal?.toString() ?? "", visitante: p.golesVisitante?.toString() ?? "" },
          ]),
        ),
      );
    }
    abrirJornada(jornada.numero);
    setEdicion({ tipo, jornada: jornada.numero });
  }

  function guardarHorarios(jornada: JornadaData) {
    setErrores({});
    setErrorEdicion(undefined);
    startGuardado(async () => {
      const respuestas = await Promise.all(
        jornada.partidos.map(async (partido) => {
          const resultado = await guardarHorarioAction(
            partido.id,
            deInputDatetimeLocal(horarios[partido.id] ?? ""),
          );
          return [partido.id, resultado?.error] as const;
        }),
      );
      const fallidos = Object.fromEntries(
        respuestas.filter(([, error]) => error).map(([id, error]) => [id, error as string]),
      );
      if (Object.keys(fallidos).length > 0) {
        setErrores(fallidos);
      } else {
        cancelarEdicion();
        mostrarAviso(`Horarios de la jornada ${jornada.numero} guardados correctamente.`);
      }
    });
  }

  function guardarResultados(jornada: JornadaData) {
    const erroresLocales: Record<string, string> = {};
    const aGuardar: ResultadoPartidoInput[] = [];

    for (const partido of jornada.partidos) {
      const goles = resultados[partido.id];
      const local = goles?.local.trim() ?? "";
      const visitante = goles?.visitante.trim() ?? "";
      if (!local && !visitante) continue;
      if (!local || !visitante) {
        erroresLocales[partido.id] = "Ingresá los goles de los dos equipos.";
        continue;
      }
      const golesLocal = Number(local);
      const golesVisitante = Number(visitante);
      if (
        !Number.isInteger(golesLocal) ||
        golesLocal < 0 ||
        !Number.isInteger(golesVisitante) ||
        golesVisitante < 0
      ) {
        erroresLocales[partido.id] = "Los goles deben ser números enteros mayores o iguales a 0.";
        continue;
      }
      aGuardar.push({ partidoId: partido.id, golesLocal, golesVisitante });
    }

    setErrorEdicion(undefined);
    if (Object.keys(erroresLocales).length > 0) {
      setErrores(erroresLocales);
      return;
    }
    if (aGuardar.length === 0) {
      setErrores({});
      setErrorEdicion("Ingresá al menos un resultado para guardar.");
      return;
    }

    setErrores({});
    startGuardado(async () => {
      const respuesta = await guardarResultadosAction(aGuardar);
      if (respuesta.error) {
        setErrorEdicion(respuesta.error);
      } else if (respuesta.erroresPorPartido) {
        setErrores(respuesta.erroresPorPartido);
      } else {
        cancelarEdicion();
        mostrarAviso(
          `Resultados de la jornada ${jornada.numero} guardados correctamente (${aGuardar.length} ${
            aGuardar.length === 1 ? "partido" : "partidos"
          }).`,
        );
      }
    });
  }

  function guardarEdicion(jornada: JornadaData) {
    if (edicion?.tipo === "horarios") guardarHorarios(jornada);
    else guardarResultados(jornada);
  }

  const totalPartidos = jornadas.reduce((suma, j) => suma + j.partidos.length, 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/ligas"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-pitch-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Todas las ligas
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
              {ligaNombre.toUpperCase()}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Partidos</h1>
            <p className="mt-1 text-sm text-ink-600">
              {totalJornadas === 0
                ? "Cargá al menos dos equipos para armar el fixture."
                : `${totalJornadas} ${totalJornadas === 1 ? "jornada" : "jornadas"} · ${totalPartidos} ${
                    totalPartidos === 1 ? "partido cargado" : "partidos cargados"
                  }`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setCargaMasivaAbierta(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-chalk-0 px-4 py-2 text-sm font-semibold tracking-tight text-ink-900 transition-colors hover:border-pitch-700 hover:text-pitch-700"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Carga masiva
            </button>
            <Link
              href={`/admin/ligas/${ligaId}/equipos`}
              className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-chalk-0 px-4 py-2 text-sm font-semibold tracking-tight text-ink-900 transition-colors hover:border-pitch-700 hover:text-pitch-700"
            >
              Ir a equipos
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {aviso && (
        <div
          key={aviso.id}
          role="status"
          className="sticky top-3 z-30 flex items-start gap-3 rounded-xl border border-pitch-500/40 bg-lime-300 px-4 py-3 text-sm font-semibold text-pitch-900 shadow-md"
        >
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pitch-700 text-chalk-0"
            aria-hidden="true"
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <p className="min-w-0 flex-1">{aviso.mensaje}</p>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Cerrar aviso"
            className="shrink-0 text-pitch-900/60 transition-colors hover:text-pitch-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <CargaMasivaModal
        open={cargaMasivaAbierta}
        onClose={() => setCargaMasivaAbierta(false)}
        ligaId={ligaId}
        equipos={equipos}
        partidosExistentes={partidosExistentes}
        cargarFixtureMasivoAction={cargarFixtureMasivoAction}
      />

      {errorActivacion && (
        <p role="alert" className="rounded-lg bg-coral-500/10 p-4 text-sm font-medium text-coral-700">
          {errorActivacion}
        </p>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Panel de carga: siempre visible a la derecha y fijo al hacer scroll. */}
        <Card className="p-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
          <div className="mb-5 flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pitch-700 text-chalk-0"
              aria-hidden="true"
            >
              <Plus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight text-ink-900">
                Nuevo partido
              </h2>
              <p className="text-xs text-ink-600">Se suma a la jornada elegida.</p>
            </div>
          </div>
          {equipos.length < 2 ? (
            <p className="text-sm text-ink-600">
              Necesitás al menos dos equipos cargados para armar un partido.{" "}
              <Link href={`/admin/ligas/${ligaId}/equipos`} className="font-medium text-pitch-700 hover:underline">
                Cargar equipos
              </Link>
            </p>
          ) : jornadasDisponibles.length === 0 ? (
            <p className="text-sm text-ink-600">
              Ya se cargaron partidos en todas las jornadas posibles ({totalJornadas} de {totalJornadas}). No se
              pueden cargar más partidos en esta liga.
            </p>
          ) : (
            <PartidoForm
              compacto
              action={crearPartidoAction}
              submitLabel="Crear partido"
              equipos={equipos}
              jornadasDisponibles={jornadasDisponibles}
              ocupacionPorJornada={ocupacionPorJornada}
              onExito={mostrarAviso}
            />
          )}
        </Card>

        <div className="lg:col-start-1 lg:row-start-1">
          {totalJornadas === 0 ? (
            <Card className="flex flex-col items-center gap-1 border-dashed p-16 text-center">
              <p className="font-display text-lg font-semibold text-ink-900">Todavía no hay fixture</p>
              <p className="text-sm text-ink-600">
                Cargá al menos dos equipos para ver las jornadas de esta liga.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {jornadas.map((jornada) => {
                const abierta = abiertas.has(jornada.numero);
                const esActiva = jornada.numero === jornadaActiva;
                const liquidada = jornadasLiquidadas.includes(jornada.numero);
                const editandoAca = edicion?.jornada === jornada.numero;
                const editandoHorarios = editandoAca && edicion?.tipo === "horarios";
                const editandoResultados = editandoAca && edicion?.tipo === "resultados";
                const cantidad = jornada.partidos.length;
                const activandoEsta = pendingActivacion && activandoJornada === jornada.numero;

                return (
                  <section
                    key={jornada.numero}
                    aria-label={`Jornada ${jornada.numero}`}
                    className={`overflow-hidden rounded-2xl bg-chalk-0 shadow-[0_1px_2px_rgba(16,36,26,0.04)] ${
                      esActiva ? "border-2 border-pitch-700" : "border border-line"
                    }`}
                  >
                    <div
                      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 ${
                        esActiva ? "bg-pitch-700/5" : "bg-chalk-50"
                      } ${abierta ? "border-b border-line" : ""}`}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                        <button
                          type="button"
                          onClick={() => toggleJornada(jornada.numero)}
                          aria-expanded={abierta}
                          className="flex items-center gap-2 text-left"
                        >
                          <ChevronRight
                            className={`h-4 w-4 text-ink-400 transition-transform ${
                              abierta ? "rotate-90" : ""
                            }`}
                            aria-hidden="true"
                          />
                          <span className="font-display text-lg font-bold text-ink-900">
                            Jornada {jornada.numero}
                          </span>
                        </button>
                        <span className="text-xs text-ink-600">
                          {cantidad === 0 ? "Sin partidos" : `${cantidad} ${cantidad === 1 ? "partido" : "partidos"}`}
                        </span>
                        {esActiva && <MarcadorActiva activa />}
                        {faltaHorario(jornada) && <ChipFaltaHorario />}
                        {liquidada && (
                          <Link
                            href={`/admin/ligas/${ligaId}/ganadores?jornada=${jornada.numero}`}
                            title="Jornada liquidada: los partidos no se pueden editar"
                            className="inline-flex items-center gap-2 rounded-md bg-lime-400/25 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest text-pitch-700 hover:bg-lime-400/40"
                          >
                            LIQUIDADA · VER GANADORES
                          </Link>
                        )}
                      </div>

                      {cantidad > 0 && !liquidada && (
                        <div className="flex flex-wrap items-center gap-2">
                          {editandoAca ? (
                            <>
                              <BotonAccion
                                variante="primario"
                                onClick={() => guardarEdicion(jornada)}
                                disabled={pendingGuardado}
                              >
                                <Check className="h-4 w-4" aria-hidden="true" />
                                {pendingGuardado
                                  ? "Guardando…"
                                  : editandoHorarios
                                    ? "Guardar horarios"
                                    : "Guardar resultados"}
                              </BotonAccion>
                              <BotonAccion onClick={cancelarEdicion} disabled={pendingGuardado}>
                                Cancelar
                              </BotonAccion>
                            </>
                          ) : (
                            <>
                              <BotonAccion onClick={() => empezarEdicion(jornada, "horarios")}>
                                <Clock className="h-4 w-4" aria-hidden="true" />
                                Editar horarios
                              </BotonAccion>
                              <BotonAccion
                                variante={esActiva ? "primario" : "secundario"}
                                onClick={() => empezarEdicion(jornada, "resultados")}
                              >
                                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                                Cargar resultados
                              </BotonAccion>
                              {!esActiva && (
                                <BotonAccion onClick={() => activar(jornada.numero)} disabled={activandoEsta}>
                                  <Play className="h-4 w-4" aria-hidden="true" />
                                  {activandoEsta ? "Activando…" : "Activar"}
                                </BotonAccion>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {abierta && (
                      <div className="flex flex-col">
                        {cantidad === 0 ? (
                          <p className="px-5 py-4 text-sm text-ink-600">
                            Sin partidos cargados todavía en esta jornada.
                          </p>
                        ) : (
                          jornada.partidos.map((partido, indice) => (
                            <FilaCruce
                              key={partido.id}
                              ligaId={ligaId}
                              partido={partido}
                              indice={indice}
                              horario={
                                editandoHorarios
                                  ? {
                                      valor: horarios[partido.id] ?? "",
                                      onChange: (valor) =>
                                        setHorarios((prev) => ({ ...prev, [partido.id]: valor })),
                                    }
                                  : undefined
                              }
                              resultado={
                                editandoResultados
                                  ? {
                                      valor: resultados[partido.id] ?? { local: "", visitante: "" },
                                      onChange: (valor) =>
                                        setResultados((prev) => ({ ...prev, [partido.id]: valor })),
                                    }
                                  : undefined
                              }
                              error={editandoAca ? errores[partido.id] : undefined}
                            />
                          ))
                        )}

                        {editandoAca && (
                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-chalk-50 px-5 py-3">
                            <p
                              role={errorEdicion ? "alert" : undefined}
                              className={`text-xs ${errorEdicion ? "font-medium text-coral-700" : "text-ink-600"}`}
                            >
                              {errorEdicion ??
                                (editandoResultados
                                  ? "Los partidos sin goles quedan como estaban."
                                  : "Dejá un horario vacío para quitarlo.")}
                            </p>
                            <div className="flex gap-2">
                              <BotonAccion onClick={cancelarEdicion} disabled={pendingGuardado}>
                                Cancelar
                              </BotonAccion>
                              <BotonAccion
                                variante="primario"
                                onClick={() => guardarEdicion(jornada)}
                                disabled={pendingGuardado}
                              >
                                <Check className="h-4 w-4" aria-hidden="true" />
                                {pendingGuardado
                                  ? "Guardando…"
                                  : editandoHorarios
                                    ? "Guardar horarios"
                                    : "Guardar resultados"}
                              </BotonAccion>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
