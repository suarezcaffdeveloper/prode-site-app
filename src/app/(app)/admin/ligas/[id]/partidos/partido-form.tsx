"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type State = { error?: string };

type Equipo = { id: string; nombre: string };

function aInputDatetimeLocal(iso?: string | null) {
  if (!iso) return "";
  const fecha = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(
    fecha.getHours(),
  )}:${pad(fecha.getMinutes())}`;
}

export function PartidoForm({
  action,
  submitLabel,
  equipos,
  defaultValues,
  mostrarResultado,
}: {
  action: (prevState: State, formData: FormData) => Promise<State>;
  submitLabel: string;
  equipos: Equipo[];
  defaultValues?: {
    jornada?: number;
    equipoLocalId?: string;
    equipoVisitanteId?: string;
    fechaHora?: string | null;
    golesLocal?: number | null;
    golesVisitante?: number | null;
  };
  mostrarResultado?: boolean;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="equipo_local_id" className="text-sm font-medium text-ink-900">
            Equipo local
          </label>
          <select
            id="equipo_local_id"
            name="equipo_local_id"
            required
            defaultValue={defaultValues?.equipoLocalId ?? ""}
            className="rounded-lg border border-line-strong bg-chalk-0 px-3.5 py-2.5 text-sm text-ink-900"
          >
            <option value="" disabled>
              Elegir equipo
            </option>
            {equipos.map((equipo) => (
              <option key={equipo.id} value={equipo.id}>
                {equipo.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="equipo_visitante_id" className="text-sm font-medium text-ink-900">
            Equipo visitante
          </label>
          <select
            id="equipo_visitante_id"
            name="equipo_visitante_id"
            required
            defaultValue={defaultValues?.equipoVisitanteId ?? ""}
            className="rounded-lg border border-line-strong bg-chalk-0 px-3.5 py-2.5 text-sm text-ink-900"
          >
            <option value="" disabled>
              Elegir equipo
            </option>
            {equipos.map((equipo) => (
              <option key={equipo.id} value={equipo.id}>
                {equipo.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Jornada"
          name="jornada"
          type="number"
          min={1}
          step={1}
          required
          defaultValue={defaultValues?.jornada}
        />
        <Field
          label="Fecha y hora"
          name="fecha_hora"
          type="datetime-local"
          hint="Opcional"
          defaultValue={aInputDatetimeLocal(defaultValues?.fechaHora)}
        />
      </div>

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
      <Button type="submit" loading={pending} className="mt-1 self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
