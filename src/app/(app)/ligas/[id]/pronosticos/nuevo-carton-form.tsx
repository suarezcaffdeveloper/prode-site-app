"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Escudo } from "@/components/ui/escudo";
import { Button } from "@/components/ui/button";
import { formatearFechaPartido } from "@/lib/fecha-partido";

type State = { error?: string };

type EquipoRef = { id: string; nombre: string; escudo_url: string | null };

type PartidoRef = {
  id: string;
  fecha_hora?: string | null;
  equipo_local: EquipoRef;
  equipo_visitante: EquipoRef;
};

// Escritorio: inputs grandes, sin flechitas del navegador y con foco lima.
const claseInput =
  "h-9 w-12 rounded-md border border-line-strong bg-chalk-0 text-center text-sm text-ink-900 disabled:opacity-60 lg:h-14 lg:w-16 lg:rounded-xl lg:font-display lg:text-2xl lg:font-bold lg:text-pitch-700 lg:transition-all lg:[appearance:textfield] lg:[&::-webkit-inner-spin-button]:appearance-none lg:[&::-webkit-outer-spin-button]:appearance-none lg:focus:border-pitch-500 lg:focus:outline-none lg:focus:ring-4 lg:focus:ring-lime-400/30";

const claseNombre =
  "min-w-0 flex-1 truncate text-sm font-medium text-ink-900 lg:line-clamp-2 lg:w-full lg:flex-none lg:whitespace-normal lg:text-base lg:leading-tight lg:text-center";

const claseEscudo =
  "h-6 w-6 shrink-0 text-[10px] lg:h-14 lg:w-14 lg:text-xl lg:transition-transform lg:duration-300 lg:group-focus-within:scale-110";

export function NuevoCartonForm({
  partidos,
  action,
  deshabilitado,
  motivoDeshabilitado,
  enlaceCompra,
}: {
  partidos: PartidoRef[];
  action: (prevState: State, formData: FormData) => Promise<State>;
  deshabilitado: boolean;
  motivoDeshabilitado?: string;
  enlaceCompra?: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});
  // Qué partidos ya tienen los dos goles cargados (alimenta el avance de escritorio).
  const [completos, setCompletos] = useState<Record<string, boolean>>({});

  function actualizarAvance(form: HTMLFormElement) {
    const datos = new FormData(form);
    const siguiente: Record<string, boolean> = {};
    for (const partido of partidos) {
      const local = String(datos.get(`goles_local_${partido.id}`) ?? "").trim();
      const visitante = String(datos.get(`goles_visitante_${partido.id}`) ?? "").trim();
      siguiente[partido.id] = local !== "" && visitante !== "";
    }
    setCompletos(siguiente);
  }

  const cantidadCompletos = Object.values(completos).filter(Boolean).length;
  const porcentaje = partidos.length > 0 ? (cantidadCompletos / partidos.length) * 100 : 0;
  const listo = partidos.length > 0 && cantidadCompletos === partidos.length;

  return (
    <form
      action={formAction}
      onChange={(e) => actualizarAvance(e.currentTarget)}
      onReset={() => setCompletos({})}
      className="flex flex-col gap-4 lg:gap-6"
    >
      <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-4">
        {partidos.map((partido) => {
          const completo = completos[partido.id] === true;
          return (
            <div
              key={partido.id}
              className={`group grid grid-cols-[1fr_auto_1fr] items-center gap-2 lg:gap-x-4 lg:gap-y-5 lg:rounded-2xl lg:border lg:bg-chalk-0 lg:p-6 lg:shadow-[0_1px_2px_rgba(16,36,26,0.04)] lg:transition-all lg:duration-300 lg:focus-within:-translate-y-1 lg:focus-within:border-pitch-500 lg:focus-within:shadow-[0_16px_36px_rgba(16,36,26,0.10)] ${
                completo ? "lg:border-pitch-500/60" : "lg:border-line"
              }`}
            >
              <div className="hidden items-center justify-between gap-3 lg:col-span-3 lg:flex">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-400">
                  {formatearFechaPartido(partido.fecha_hora ?? null)}
                </p>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full bg-lime-400 text-pitch-900 transition-all duration-300 ${
                    completo ? "scale-100 opacity-100" : "scale-50 opacity-0"
                  }`}
                  aria-hidden="true"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              </div>

              <div className="flex min-w-0 items-center justify-end gap-1.5 lg:flex-col lg:justify-center lg:gap-3">
                <Escudo
                  url={partido.equipo_local.escudo_url}
                  nombre={partido.equipo_local.nombre}
                  className={claseEscudo}
                />
                <p className={`text-right ${claseNombre}`}>{partido.equipo_local.nombre}</p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 lg:gap-2.5">
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
                  className={claseInput}
                />
                <span className="text-ink-400 lg:text-xl">–</span>
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
                  className={claseInput}
                />
              </div>

              <div className="flex min-w-0 items-center gap-1.5 lg:flex-col-reverse lg:justify-center lg:gap-3">
                <p className={claseNombre}>{partido.equipo_visitante.nombre}</p>
                <Escudo
                  url={partido.equipo_visitante.escudo_url}
                  nombre={partido.equipo_visitante.nombre}
                  className={claseEscudo}
                />
              </div>
            </div>
          );
        })}
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {state.error}
        </p>
      )}

      {deshabilitado && motivoDeshabilitado && (
        <p className="text-sm text-ink-600">
          {motivoDeshabilitado}{" "}
          {enlaceCompra && (
            <Link href={enlaceCompra} className="font-medium text-pitch-700 underline">
              Comprar más prodes
            </Link>
          )}
        </p>
      )}

      {/* Escritorio: barra pegajosa con el avance y el botón siempre a mano. */}
      <div className="flex flex-col gap-3 lg:sticky lg:bottom-6 lg:z-10 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:rounded-2xl lg:border lg:border-chalk-0/10 lg:bg-pitch-900/95 lg:px-7 lg:py-4 lg:shadow-[0_20px_50px_rgba(11,31,20,0.35)] lg:backdrop-blur">
        <div className="hidden min-w-0 flex-1 flex-col gap-2 lg:flex">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[11px] font-semibold tracking-widest text-chalk-0/70">
              {listo ? "LISTO PARA CARGAR" : "RESULTADOS COMPLETADOS"}
            </span>
            <span className="font-display text-lg font-bold tabular-nums text-chalk-0">
              {cantidadCompletos}
              <span className="text-sm font-medium text-chalk-0/60"> de {partidos.length}</span>
            </span>
          </div>
          <span className="h-1.5 overflow-hidden rounded-full bg-chalk-0/15" aria-hidden="true">
            <span
              className={`block h-full rounded-full transition-[width] duration-500 ${
                listo ? "bg-lime-300" : "bg-lime-400"
              }`}
              style={{ width: `${porcentaje}%` }}
            />
          </span>
        </div>

        <Button
          type="submit"
          disabled={deshabilitado}
          loading={pending}
          className="self-start lg:shrink-0 lg:self-auto lg:rounded-full lg:bg-lime-400 lg:px-8 lg:py-3 lg:text-base lg:text-pitch-900 lg:transition-all lg:hover:-translate-y-0.5 lg:hover:bg-lime-300 lg:hover:shadow-[0_10px_30px_rgba(163,230,53,0.4)] lg:disabled:translate-y-0 lg:disabled:bg-chalk-0/15 lg:disabled:text-chalk-0/40 lg:disabled:shadow-none"
        >
          Cargar este prode
        </Button>
      </div>
    </form>
  );
}
