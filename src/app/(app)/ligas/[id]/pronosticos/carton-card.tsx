"use client";

import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import { MarcadorPronostico } from "@/components/ui/marcador";

type EquipoRef = { id: string; nombre: string; escudo_url: string | null };

type PartidoRef = {
  id: string;
  equipo_local: EquipoRef;
  equipo_visitante: EquipoRef;
  estado: "pendiente" | "finalizado";
  goles_local: number | null;
  goles_visitante: number | null;
};

type Prediccion = { partido_id: string; goles_local: number; goles_visitante: number };

export function CartonCard({
  numero,
  partidos,
  prediccionesIniciales,
  editable,
  actualizarCarton,
  subgrupo,
}: {
  numero: number;
  partidos: PartidoRef[];
  prediccionesIniciales: Record<string, { golesLocal: number; golesVisitante: number }>;
  editable: boolean;
  actualizarCarton: (predicciones: Prediccion[]) => Promise<{ error?: string } | void>;
  // Solo si el usuario está en algún subgrupo de la liga y tiene más de un
  // cartón en la jornada: cuál de ellos compite en el ranking del subgrupo.
  subgrupo?: { compite: boolean; elegir: () => Promise<{ error?: string }> };
}) {
  const [valores, setValores] = useState(() => {
    const inicial: Record<string, { local: string; visitante: string }> = {};
    for (const partido of partidos) {
      const prediccion = prediccionesIniciales[partido.id];
      inicial[partido.id] = {
        local: prediccion?.golesLocal.toString() ?? "",
        visitante: prediccion?.golesVisitante.toString() ?? "",
      };
    }
    return inicial;
  });
  // Último estado guardado: a esto vuelve el prode si se cancela la edición.
  const [guardados, setGuardados] = useState(valores);
  const [error, setError] = useState<string>();
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();

  function guardar() {
    const predicciones: Prediccion[] = [];
    for (const partido of partidos) {
      const valor = valores[partido.id];
      const golesLocal = Number(valor?.local);
      const golesVisitante = Number(valor?.visitante);
      if (
        !valor?.local.trim() ||
        !valor?.visitante.trim() ||
        !Number.isInteger(golesLocal) ||
        golesLocal < 0 ||
        !Number.isInteger(golesVisitante) ||
        golesVisitante < 0
      ) {
        setError("Cargá un resultado para cada partido.");
        return;
      }
      predicciones.push({
        partido_id: partido.id,
        goles_local: golesLocal,
        goles_visitante: golesVisitante,
      });
    }

    setError(undefined);
    startTransition(async () => {
      const resultado = await actualizarCarton(predicciones);
      if (resultado?.error) {
        setError(resultado.error);
        return;
      }
      setGuardados(valores);
      setEditando(false);
    });
  }

  function cancelar() {
    setValores(guardados);
    setError(undefined);
    setEditando(false);
  }

  function elegirParaSubgrupos() {
    if (!subgrupo) return;
    setError(undefined);
    startTransition(async () => {
      const resultado = await subgrupo.elegir();
      if (resultado?.error) setError(resultado.error);
    });
  }

  const finalizados = partidos.filter((p) => p.estado === "finalizado");
  const aciertos = finalizados.filter(
    (p) =>
      p.goles_local === Number(guardados[p.id]?.local) &&
      p.goles_visitante === Number(guardados[p.id]?.visitante),
  ).length;

  const claseInput =
    "h-9 w-12 rounded-md border border-line-strong bg-chalk-0 text-center text-sm text-ink-900 disabled:opacity-60 lg:h-10 lg:w-14 lg:rounded-lg lg:font-display lg:text-lg lg:font-bold lg:text-pitch-700 lg:[appearance:textfield] lg:[&::-webkit-inner-spin-button]:appearance-none lg:[&::-webkit-outer-spin-button]:appearance-none lg:focus:border-pitch-500 lg:focus:outline-none lg:focus:ring-4 lg:focus:ring-lime-400/30";

  return (
    <Card
      className={`flex flex-col gap-3 p-5 lg:gap-0 lg:overflow-hidden lg:p-0 lg:transition-all lg:duration-300 lg:hover:border-pitch-500 ${
        editando ? "lg:border-pitch-500" : "lg:hover:-translate-y-1 lg:hover:shadow-[0_16px_36px_rgba(16,36,26,0.10)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3 lg:bg-pitch-900 lg:px-5 lg:py-3.5">
        <p className="font-mono text-[13px] font-bold tracking-wide text-pitch-600 lg:uppercase lg:tracking-[0.2em] lg:text-lime-300">
          Tu prode #{numero} jugado
        </p>
        <span className="hidden items-center gap-2 font-mono text-[11px] font-semibold tracking-widest text-chalk-0/80 lg:inline-flex">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              finalizados.length > 0
                ? aciertos === finalizados.length
                  ? "bg-lime-400"
                  : "bg-chalk-0/50"
                : editable
                  ? "animate-pulse bg-lime-400"
                  : "bg-amber-500"
            }`}
            aria-hidden="true"
          />
          {finalizados.length > 0
            ? `${aciertos} DE ${finalizados.length} ACERTADOS`
            : editando
              ? "EDITANDO"
              : editable
                ? "EN JUEGO"
                : "CERRADO"}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 lg:gap-0.5 lg:p-3">
        {partidos.map((partido) => {
          const valor = valores[partido.id] ?? { local: "", visitante: "" };
          const acertado =
            partido.estado === "finalizado" &&
            partido.goles_local === Number(valor.local) &&
            partido.goles_visitante === Number(valor.visitante);
          return (
            <div
              key={partido.id}
              className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 lg:gap-3 lg:rounded-xl lg:px-3 lg:py-2.5 lg:transition-colors ${
                acertado ? "lg:bg-lime-400/15" : "lg:hover:bg-chalk-50"
              }`}
            >
              <div className="flex min-w-0 items-center justify-end gap-1.5 lg:gap-2.5">
                <Escudo
                  url={partido.equipo_local.escudo_url}
                  nombre={partido.equipo_local.nombre}
                  className="h-6 w-6 shrink-0 text-[10px] lg:h-9 lg:w-9 lg:text-sm"
                />
                <p className="min-w-0 flex-1 truncate text-right text-sm font-medium text-ink-900 lg:text-[15px]">
                  {partido.equipo_local.nombre}
                </p>
              </div>

              {editable && editando ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={valor.local}
                    disabled={pending}
                    onChange={(e) =>
                      setValores((prev) => ({
                        ...prev,
                        [partido.id]: { ...prev[partido.id], local: e.target.value },
                      }))
                    }
                    aria-label={`Goles de ${partido.equipo_local.nombre}`}
                    className={claseInput}
                  />
                  <span className="text-ink-400">–</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={valor.visitante}
                    disabled={pending}
                    onChange={(e) =>
                      setValores((prev) => ({
                        ...prev,
                        [partido.id]: { ...prev[partido.id], visitante: e.target.value },
                      }))
                    }
                    aria-label={`Goles de ${partido.equipo_visitante.nombre}`}
                    className={claseInput}
                  />
                </div>
              ) : (
                <MarcadorPronostico
                  golesLocal={Number(valor.local)}
                  golesVisitante={Number(valor.visitante)}
                  acertado={acertado}
                />
              )}

              <div className="flex min-w-0 items-center gap-1.5 lg:gap-2.5">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 lg:text-[15px]">
                  {partido.equipo_visitante.nombre}
                </p>
                <Escudo
                  url={partido.equipo_visitante.escudo_url}
                  nombre={partido.equipo_visitante.nombre}
                  className="h-6 w-6 shrink-0 text-[10px] lg:h-9 lg:w-9 lg:text-sm"
                />
              </div>
            </div>
          );
        })}
      </div>

      {subgrupo && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 lg:mx-3 lg:mb-2 ${
            subgrupo.compite ? "bg-lime-400/20" : "bg-chalk-50"
          }`}
        >
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              subgrupo.compite ? "text-pitch-700" : "text-ink-600"
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {subgrupo.compite
              ? "Compite en tus subgrupos"
              : "Solo juega por el pozo, no suma en tus subgrupos"}
          </span>
          {!subgrupo.compite && editable && (
            <button
              type="button"
              onClick={elegirParaSubgrupos}
              disabled={pending}
              className="text-xs font-semibold text-pitch-700 hover:underline disabled:opacity-50"
            >
              Usar en mis subgrupos
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-coral-700 lg:px-5 lg:pb-3">
          {error}
        </p>
      )}

      {editable && (
        <div className="flex items-center gap-4 lg:gap-3 lg:border-t lg:border-line lg:bg-chalk-50 lg:px-5 lg:py-3">
          <button
            type="button"
            onClick={editando ? guardar : () => setEditando(true)}
            disabled={pending}
            className={`text-xs font-semibold hover:underline disabled:opacity-50 lg:rounded-full lg:px-4 lg:py-1.5 lg:text-sm lg:transition-all lg:hover:no-underline ${
              editando
                ? "text-pitch-700 lg:bg-pitch-700 lg:text-chalk-0 lg:hover:bg-pitch-600"
                : "text-pitch-700 lg:border lg:border-line-strong lg:bg-chalk-0 lg:hover:border-pitch-500"
            }`}
          >
            {editando ? "Guardar resultados" : "Editar predicción"}
          </button>
          {editando && (
            <button
              type="button"
              onClick={cancelar}
              disabled={pending}
              className="text-xs font-semibold text-ink-600 hover:underline disabled:opacity-50 lg:rounded-full lg:px-3 lg:py-1.5 lg:text-sm lg:hover:bg-chalk-100 lg:hover:no-underline"
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
