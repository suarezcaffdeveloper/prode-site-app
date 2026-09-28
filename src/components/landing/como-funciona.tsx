"use client";

import { useState } from "react";
import { Minus, Plus, Trophy } from "lucide-react";
import { Escudo } from "@/components/ui/escudo";
import { PLANES } from "@/lib/planes";
import { formatearPesos } from "@/lib/pozo";
import { useNumeroAnimado, usePrefiereMovimientoReducido } from "./hooks";

const DURACION_PASO_MS = 6000;

const PASOS = [
  {
    titulo: "Elegí tu plan",
    texto:
      "Comprá un prode suelto o suscribite a un plan mensual con varios prodes. Cuantos más prodes, más chances por fecha, y el precio por prode baja.",
  },
  {
    titulo: "Cargá tus marcadores",
    texto:
      "Pronosticá el resultado exacto de cada partido de la fecha. Podés editar tu prode hasta 30 minutos antes del primer partido.",
  },
  {
    titulo: "Acertá todo y ganá el pozo",
    texto:
      "Si clavás el marcador de todos los partidos, ganás. Si hay varios ganadores el pozo se reparte en partes iguales; si nadie acierta, se acumula a la fecha siguiente.",
  },
];

function VisualPlanes({ activo }: { activo: boolean }) {
  return (
    <div key={activo ? "on" : "off"} className="flex w-full max-w-xs flex-col gap-3">
      {PLANES.map((plan, i) => (
        <div
          key={plan.slug}
          className={`flex animate-pop-in items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-transform duration-300 hover:-translate-y-0.5 ${
            plan.recomendado
              ? "border-lime-400 bg-lime-400/15 text-chalk-0"
              : "border-chalk-0/15 bg-chalk-0/5 text-chalk-100/80"
          }`}
          style={{ animationDelay: `${i * 110}ms` }}
        >
          <div>
            <p className="text-sm font-semibold">{plan.nombre}</p>
            {plan.recomendado && (
              <p className="font-mono text-[10px] font-semibold tracking-widest text-lime-300">
                RECOMENDADO
              </p>
            )}
          </div>
          <p className="font-display text-lg font-bold tabular-nums">{formatearPesos(plan.precio)}</p>
        </div>
      ))}
    </div>
  );
}

const MARCADORES: [number, number][] = [
  [2, 1],
  [0, 0],
  [1, 3],
];
const EQUIPOS = [
  ["Deportivo Norte", "Atlético Sur"],
  ["Club Central", "Unión Este"],
  ["Real Puerto", "Sporting Oeste"],
];

function VisualCarga({ activo }: { activo: boolean }) {
  return (
    <div
      key={activo ? "on" : "off"}
      className="flex w-full max-w-xs flex-col divide-y divide-chalk-0/10 rounded-2xl border border-chalk-0/15 bg-chalk-0/5 px-4"
    >
      {EQUIPOS.map(([local, visitante], i) => (
        <div key={local} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3.5">
          <div className="flex items-center justify-end gap-2">
            <p className="truncate text-xs font-medium text-chalk-0">{local}</p>
            <Escudo nombre={local} className="h-6 w-6 text-[10px]" />
          </div>
          <div className="flex items-center gap-1.5">
            {MARCADORES[i].map((goles, lado) => (
              <span
                key={lado}
                className="flex h-9 w-9 animate-pop-in items-center justify-center rounded-lg bg-chalk-0 font-mono text-lg font-bold text-pitch-700"
                style={{ animationDelay: `${i * 220 + lado * 110}ms` }}
              >
                {goles}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Escudo nombre={visitante} className="h-6 w-6 text-[10px]" />
            <p className="truncate text-xs font-medium text-chalk-0">{visitante}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function VisualPozo({ activo }: { activo: boolean }) {
  const monto = useNumeroAnimado(activo ? 96000 : 0, 1600, 0);
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        {activo && (
          <>
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-lime-400/40" aria-hidden="true" />
            <span
              className="absolute inset-0 animate-pulse-ring rounded-full bg-lime-400/30 [animation-delay:-1.1s]"
              aria-hidden="true"
            />
          </>
        )}
        <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-lime-400 text-pitch-900 shadow-[0_0_60px_rgba(163,230,53,0.45)]">
          <Trophy className="h-11 w-11" aria-hidden="true" />
        </span>
      </div>
      <div>
        <p className="font-mono text-[11px] font-semibold tracking-widest text-chalk-100/60">
          POZO DE LA FECHA
        </p>
        <p className="font-display text-4xl font-bold tabular-nums text-lime-300">
          {formatearPesos(Math.round(monto))}
        </p>
        <p className="mt-1 text-xs text-chalk-100/60">Ejemplo con 100 prodes de $1.200 al pozo</p>
      </div>
    </div>
  );
}

export function ComoFunciona() {
  const [activo, setActivo] = useState(0);
  const [pausado, setPausado] = useState(false);
  const reducido = usePrefiereMovimientoReducido();

  const visuales = [VisualPlanes, VisualCarga, VisualPozo];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <ol
        className="flex flex-col gap-3"
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onFocusCapture={() => setPausado(true)}
        onBlurCapture={() => setPausado(false)}
      >
        {PASOS.map((paso, i) => {
          const esActivo = i === activo;
          return (
            <li key={paso.titulo}>
              <button
                type="button"
                onClick={() => setActivo(i)}
                aria-current={esActivo ? "step" : undefined}
                className={`group relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                  esActivo
                    ? "border-pitch-500 bg-chalk-0 shadow-[0_18px_50px_rgba(20,83,45,0.14)]"
                    : "border-line bg-chalk-0/60 hover:-translate-y-0.5 hover:border-pitch-500/60 hover:bg-chalk-0"
                }`}
              >
                <span className="flex items-start gap-4">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-base font-bold transition-all duration-300 ${
                      esActivo
                        ? "scale-110 bg-pitch-900 text-lime-300"
                        : "bg-chalk-100 text-ink-600 group-hover:bg-pitch-900 group-hover:text-lime-300"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="block flex-1">
                    <span className="block font-display text-lg font-bold tracking-tight text-ink-900">
                      {paso.titulo}
                    </span>
                    <span
                      className={`grid transition-[grid-template-rows,opacity] duration-500 ${
                        esActivo ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <span className="block overflow-hidden text-sm leading-relaxed text-ink-600">
                        <span className="block pt-2">{paso.texto}</span>
                      </span>
                    </span>
                  </span>
                  <span className="mt-1 text-ink-400 transition-colors group-hover:text-pitch-700" aria-hidden="true">
                    {esActivo ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                </span>

                {esActivo && (
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-line" aria-hidden="true">
                    <span
                      key={`${activo}-${reducido}`}
                      className="block h-full bg-lime-400"
                      style={
                        reducido
                          ? { width: "100%" }
                          : {
                              animation: `barra-progreso ${DURACION_PASO_MS}ms linear forwards`,
                              animationPlayState: pausado ? "paused" : "running",
                            }
                      }
                      onAnimationEnd={() => setActivo((a) => (a + 1) % PASOS.length)}
                    />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="relative aspect-[4/3.4] w-full overflow-hidden rounded-3xl bg-pitch-900 shadow-[0_30px_80px_rgba(11,31,20,0.35)] sm:aspect-[16/11] lg:aspect-[4/3.6]">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 animate-drift rounded-full bg-lime-400/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, rgba(245,247,242,0.06) 0, rgba(245,247,242,0.06) 1px, transparent 1px, transparent 56px)",
          }}
          aria-hidden="true"
        />
        {visuales.map((Visual, i) => (
          <div
            key={i}
            aria-hidden={i !== activo}
            className={`absolute inset-0 flex items-center justify-center p-6 transition-all duration-700 ${
              i === activo ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
            }`}
          >
            <Visual activo={i === activo} />
          </div>
        ))}
        <p className="absolute bottom-4 left-5 font-mono text-[10px] font-semibold tracking-widest text-chalk-100/50">
          PASO {activo + 1} / {PASOS.length}
        </p>
      </div>
    </div>
  );
}
