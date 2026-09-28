"use client";

import { useActionState } from "react";
import { Escudo } from "@/components/ui/escudo";
import { Button } from "@/components/ui/button";

type State = { error?: string };

type EquipoRef = { id: string; nombre: string; escudo_url: string | null };

type PartidoRef = {
  id: string;
  equipo_local: EquipoRef;
  equipo_visitante: EquipoRef;
};

export function NuevoCartonForm({
  partidos,
  action,
  deshabilitado,
  motivoDeshabilitado,
}: {
  partidos: PartidoRef[];
  action: (prevState: State, formData: FormData) => Promise<State>;
  deshabilitado: boolean;
  motivoDeshabilitado?: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        {partidos.map((partido) => (
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

            <div className="flex shrink-0 items-center gap-1.5">
              <label className="sr-only" htmlFor={`goles_local_${partido.id}`}>
                Goles de {partido.equipo_local.nombre}
              </label>
              <input
                id={`goles_local_${partido.id}`}
                name={`goles_local_${partido.id}`}
                type="number"
                min={0}
                step={1}
                disabled={deshabilitado || pending}
                className="h-9 w-12 rounded-md border border-line-strong bg-chalk-0 text-center text-sm text-ink-900 disabled:opacity-60"
              />
              <span className="text-ink-400">–</span>
              <label className="sr-only" htmlFor={`goles_visitante_${partido.id}`}>
                Goles de {partido.equipo_visitante.nombre}
              </label>
              <input
                id={`goles_visitante_${partido.id}`}
                name={`goles_visitante_${partido.id}`}
                type="number"
                min={0}
                step={1}
                disabled={deshabilitado || pending}
                className="h-9 w-12 rounded-md border border-line-strong bg-chalk-0 text-center text-sm text-ink-900 disabled:opacity-60"
              />
            </div>

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

      {state.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {state.error}
        </p>
      )}

      {deshabilitado && motivoDeshabilitado && (
        <p className="text-sm text-ink-600">{motivoDeshabilitado}</p>
      )}

      <Button type="submit" disabled={deshabilitado} loading={pending} className="self-start">
        Cargar este prode
      </Button>
    </form>
  );
}
