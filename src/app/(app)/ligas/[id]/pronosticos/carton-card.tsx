"use client";

import { useState, useTransition } from "react";
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
}: {
  numero: number;
  partidos: PartidoRef[];
  prediccionesIniciales: Record<string, { golesLocal: number; golesVisitante: number }>;
  editable: boolean;
  actualizarCarton: (predicciones: Prediccion[]) => Promise<{ error?: string } | void>;
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

  return (
    <Card className="flex flex-col gap-3 p-5">
      <p className="font-mono text-[13px] font-bold tracking-wide text-pitch-600">
        Tu prode #{numero} jugado
      </p>

      <div className="flex flex-col gap-2.5">
        {partidos.map((partido) => {
          const valor = valores[partido.id] ?? { local: "", visitante: "" };
          return (
            <div key={partido.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
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
                    className="h-9 w-12 rounded-md border border-line-strong bg-chalk-0 text-center text-sm text-ink-900 disabled:opacity-60"
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
                    className="h-9 w-12 rounded-md border border-line-strong bg-chalk-0 text-center text-sm text-ink-900 disabled:opacity-60"
                  />
                </div>
              ) : (
                <MarcadorPronostico
                  golesLocal={Number(valor.local)}
                  golesVisitante={Number(valor.visitante)}
                  acertado={
                    partido.estado === "finalizado" &&
                    partido.goles_local === Number(valor.local) &&
                    partido.goles_visitante === Number(valor.visitante)
                  }
                />
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
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-coral-700">
          {error}
        </p>
      )}

      {editable && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={editando ? guardar : () => setEditando(true)}
            disabled={pending}
            className="text-xs font-semibold text-pitch-700 hover:underline disabled:opacity-50"
          >
            {editando ? "Guardar resultados" : "Editar predicción"}
          </button>
          {editando && (
            <button
              type="button"
              onClick={cancelar}
              disabled={pending}
              className="text-xs font-semibold text-ink-600 hover:underline disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
