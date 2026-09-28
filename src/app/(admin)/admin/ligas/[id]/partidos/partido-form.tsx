"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { aInputDatetimeLocal } from "@/lib/fecha-hora-input";

type State = { error?: string; exito?: string };

type Equipo = { id: string; nombre: string };

export function PartidoForm({
  action,
  submitLabel,
  equipos,
  jornadasDisponibles,
  ocupacionPorJornada,
  defaultValues,
  mostrarResultado,
  onExito,
}: {
  action: (prevState: State, formData: FormData) => Promise<State>;
  submitLabel: string;
  equipos: Equipo[];
  jornadasDisponibles: number[];
  ocupacionPorJornada: Record<number, string[]>;
  defaultValues?: {
    jornada?: number;
    equipoLocalId?: string;
    equipoVisitanteId?: string;
    fechaHora?: string | null;
    golesLocal?: number | null;
    golesVisitante?: number | null;
  };
  mostrarResultado?: boolean;
  // Se llama cuando la acción devuelve `exito` (alta sin redirect): el padre
  // muestra el aviso y este form queda listo para cargar el siguiente partido.
  onExito?: (mensaje: string) => void;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});
  const equipoLocalRef = useRef<HTMLSelectElement>(null);

  const [jornada, setJornada] = useState<number>(
    defaultValues?.jornada ?? jornadasDisponibles[0],
  );
  const [equipoLocalId, setEquipoLocalId] = useState(defaultValues?.equipoLocalId ?? "");
  const [equipoVisitanteId, setEquipoVisitanteId] = useState(
    defaultValues?.equipoVisitanteId ?? "",
  );

  const equiposOcupados = useMemo(
    () => new Set(ocupacionPorJornada[jornada] ?? []),
    [ocupacionPorJornada, jornada],
  );
  const equiposDisponibles = useMemo(
    () => equipos.filter((equipo) => !equiposOcupados.has(equipo.id)),
    [equipos, equiposOcupados],
  );

  useEffect(() => {
    if (equipoLocalId && !equiposDisponibles.some((equipo) => equipo.id === equipoLocalId)) {
      setEquipoLocalId("");
    }
    if (
      equipoVisitanteId &&
      !equiposDisponibles.some((equipo) => equipo.id === equipoVisitanteId)
    ) {
      setEquipoVisitanteId("");
    }
    // Solo debe correr cuando cambia la jornada seleccionada, no en cada
    // render por un cambio de equipo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jornada]);

  // Si al cargar un partido la jornada elegida quedó completa (ya no figura
  // entre las disponibles), pasar a la siguiente en vez de dejar un select
  // apuntando a una opción que no existe.
  useEffect(() => {
    if (jornadasDisponibles.length === 0 || jornadasDisponibles.includes(jornada)) return;
    setJornada(jornadasDisponibles.find((j) => j > jornada) ?? jornadasDisponibles[0]);
  }, [jornadasDisponibles, jornada]);

  // Alta exitosa: avisar al padre, limpiar los equipos (la jornada se
  // mantiene para seguir cargando la misma) y volver al primer campo.
  useEffect(() => {
    if (!state?.exito) return;
    onExito?.(state.exito);
    setEquipoLocalId("");
    setEquipoVisitanteId("");
    equipoLocalRef.current?.focus();
    // `onExito` cambia de identidad en cada render del padre; solo importa
    // reaccionar a un nuevo resultado de la acción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const opcionesLocal = equiposDisponibles.filter((equipo) => equipo.id !== equipoVisitanteId);
  const opcionesVisitante = equiposDisponibles.filter((equipo) => equipo.id !== equipoLocalId);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="jornada" className="text-sm font-medium text-ink-900">
          Jornada
        </label>
        <select
          id="jornada"
          name="jornada"
          required
          value={jornada ?? ""}
          onChange={(e) => setJornada(Number(e.target.value))}
          className="rounded-lg border border-line-strong bg-chalk-0 px-3.5 py-2.5 text-sm text-ink-900"
        >
          {jornadasDisponibles.length === 0 ? (
            <option value="" disabled>
              No hay jornadas disponibles
            </option>
          ) : (
            jornadasDisponibles.map((j) => (
              <option key={j} value={j}>
                Jornada {j}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="equipo_local_id" className="text-sm font-medium text-ink-900">
            Equipo local
          </label>
          <select
            ref={equipoLocalRef}
            id="equipo_local_id"
            name="equipo_local_id"
            required
            value={equipoLocalId}
            onChange={(e) => setEquipoLocalId(e.target.value)}
            className="rounded-lg border border-line-strong bg-chalk-0 px-3.5 py-2.5 text-sm text-ink-900"
          >
            <option value="" disabled>
              Elegir equipo
            </option>
            {opcionesLocal.map((equipo) => (
              <option key={equipo.id} value={equipo.id}>
                {equipo.nombre}
              </option>
            ))}
          </select>
          {equiposDisponibles.length === 0 && (
            <p className="text-xs text-ink-600">
              No quedan equipos libres para esta jornada.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="equipo_visitante_id" className="text-sm font-medium text-ink-900">
            Equipo visitante
          </label>
          <select
            id="equipo_visitante_id"
            name="equipo_visitante_id"
            required
            value={equipoVisitanteId}
            onChange={(e) => setEquipoVisitanteId(e.target.value)}
            className="rounded-lg border border-line-strong bg-chalk-0 px-3.5 py-2.5 text-sm text-ink-900"
          >
            <option value="" disabled>
              Elegir equipo
            </option>
            {opcionesVisitante.map((equipo) => (
              <option key={equipo.id} value={equipo.id}>
                {equipo.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Field
        label="Fecha y hora"
        name="fecha_hora"
        type="datetime-local"
        hint="Opcional"
        defaultValue={aInputDatetimeLocal(defaultValues?.fechaHora)}
      />

      {mostrarResultado && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-line p-4">
          <p className="text-sm font-medium text-ink-900">Resultado</p>
          <p className="mb-2 text-xs text-ink-600">
            Cargá los dos marcadores para pasar el partido a &quot;finalizado&quot;.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Goles local"
              name="goles_local"
              type="number"
              min={0}
              step={1}
              defaultValue={defaultValues?.golesLocal ?? ""}
            />
            <Field
              label="Goles visitante"
              name="goles_visitante"
              type="number"
              min={0}
              step={1}
              defaultValue={defaultValues?.golesVisitante ?? ""}
            />
          </div>
        </div>
      )}

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        loading={pending}
        disabled={jornadasDisponibles.length === 0}
        className="mt-1 self-start"
      >
        {submitLabel}
      </Button>
    </form>
  );
}
