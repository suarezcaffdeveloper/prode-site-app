"use client";

import { useState, type CSSProperties } from "react";
import { Minus, Plus, Trophy } from "lucide-react";
import { PLANES } from "@/lib/planes";
import { formatearPesos, repartirPozo } from "@/lib/pozo";
import { useEnVista, useNumeroAnimado } from "./hooks";

const MIN_PRODES = 10;
const MAX_PRODES = 1000;
const PORCENTAJE_POZO = 0.8;

export function CalculadoraPozo() {
  const indiceRecomendado = Math.max(
    0,
    PLANES.findIndex((plan) => plan.recomendado),
  );
  const [prodes, setProdes] = useState(200);
  const [indicePlan, setIndicePlan] = useState(indiceRecomendado);
  const [ganadores, setGanadores] = useState(1);
  const { ref, enVista } = useEnVista<HTMLDivElement>(0.35);

  const plan = PLANES[indicePlan];
  const precioPorProde = plan.precio / plan.cantidadCreditos;
  const recaudado = prodes * precioPorProde;
  const pozo = Math.round(recaudado * PORCENTAJE_POZO * 100) / 100;
  const plataforma = Math.round((recaudado - pozo) * 100) / 100;
  const { montoPorGanador } = repartirPozo(pozo, ganadores);

  const pozoAnimado = useNumeroAnimado(pozo, 600);
  const porGanadorAnimado = useNumeroAnimado(montoPorGanador, 600);
  const recaudadoAnimado = useNumeroAnimado(recaudado, 600);
  const plataformaAnimada = useNumeroAnimado(plataforma, 600);

  const relleno = ((prodes - MIN_PRODES) / (MAX_PRODES - MIN_PRODES)) * 100;

  return (
    <div
      ref={ref}
      className="grid overflow-hidden rounded-3xl bg-chalk-0 shadow-[0_40px_100px_rgba(0,0,0,0.4)] lg:grid-cols-[1fr_1.05fr]"
    >
      <div className="flex flex-col gap-8 p-7 sm:p-9">
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="cantidad-prodes" className="text-sm font-semibold text-ink-900">
              Prodes jugados en la fecha
            </label>
            <span className="font-display text-3xl font-bold tabular-nums text-pitch-700">
              {prodes.toLocaleString("es-AR")}
            </span>
          </div>
          <input
            id="cantidad-prodes"
            type="range"
            min={MIN_PRODES}
            max={MAX_PRODES}
            step={10}
            value={prodes}
            onChange={(evento) => setProdes(Number(evento.target.value))}
            className="range-prode"
            style={{ "--fill": `${relleno}%` } as CSSProperties}
          />
          <div className="flex justify-between font-mono text-[10px] font-semibold tracking-widest text-ink-400">
            <span>{MIN_PRODES}</span>
            <span>{MAX_PRODES.toLocaleString("es-AR")}</span>
          </div>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold text-ink-900">Plan con el que juegan</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PLANES.map((opcion, i) => {
              const seleccionado = i === indicePlan;
              return (
                <button
                  key={opcion.slug}
                  type="button"
                  onClick={() => setIndicePlan(i)}
                  aria-pressed={seleccionado}
                  className={`rounded-xl border px-3 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                    seleccionado
                      ? "border-pitch-700 bg-pitch-900 text-chalk-0 shadow-lg"
                      : "border-line-strong bg-chalk-0 text-ink-900 hover:border-pitch-500"
                  }`}
                >
                  <span className="block text-xs font-semibold">{opcion.nombre}</span>
                  <span
                    className={`block font-display text-base font-bold tabular-nums ${
                      seleccionado ? "text-lime-300" : "text-pitch-700"
                    }`}
                  >
                    {formatearPesos(opcion.precio / opcion.cantidadCreditos)}
                    <span className="text-[11px] font-medium opacity-70"> / prode</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-900">Prodes ganadores</p>
            <p className="text-xs text-ink-600">Cuántos aciertan todos los marcadores</p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-line-strong p-1">
            <button
              type="button"
              onClick={() => setGanadores((g) => Math.max(1, g - 1))}
              disabled={ganadores <= 1}
              aria-label="Menos ganadores"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-chalk-100 disabled:opacity-30"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center font-display text-lg font-bold tabular-nums" aria-live="polite">
              {ganadores}
            </span>
            <button
              type="button"
              onClick={() => setGanadores((g) => Math.min(10, g + 1))}
              disabled={ganadores >= 10}
              aria-label="Más ganadores"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-chalk-100 disabled:opacity-30"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex flex-col justify-between gap-8 overflow-hidden bg-pitch-900 p-7 text-chalk-0 sm:p-9">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 animate-drift rounded-full bg-lime-400/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-2">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest text-chalk-100/60">
            <Trophy className="h-4 w-4 text-lime-400" aria-hidden="true" />
            POZO DE LA FECHA
          </p>
          <p
            className="font-display text-5xl font-bold leading-none tabular-nums text-lime-300 sm:text-6xl"
            aria-live="polite"
          >
            {formatearPesos(Math.round(pozoAnimado))}
          </p>
          <p className="text-sm text-chalk-100/70">
            Cada prode ganador se lleva{" "}
            <strong className="font-semibold text-chalk-0">
              {formatearPesos(Math.round(porGanadorAnimado))}
            </strong>
            {ganadores > 1 ? ` (el pozo entre ${ganadores})` : ""}.
          </p>
        </div>

        <div className="relative flex flex-col gap-3">
          <div className="flex h-3 overflow-hidden rounded-full bg-chalk-0/10">
            <div
              className="h-full bg-lime-400 transition-[width] duration-[1400ms] ease-out"
              style={{ width: enVista ? "80%" : "0%" }}
            />
            <div
              className="h-full bg-chalk-0/30 transition-[width] duration-[1400ms] ease-out"
              style={{ width: enVista ? "20%" : "0%" }}
            />
          </div>
          <dl className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <dt className="font-mono font-semibold tracking-widest text-chalk-100/50">RECAUDADO</dt>
              <dd className="font-display text-base font-bold tabular-nums">
                {formatearPesos(Math.round(recaudadoAnimado))}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 font-mono font-semibold tracking-widest text-chalk-100/50">
                <span className="h-2 w-2 rounded-full bg-lime-400" aria-hidden="true" />
                POZO 80%
              </dt>
              <dd className="font-display text-base font-bold tabular-nums text-lime-300">
                {formatearPesos(Math.round(pozoAnimado))}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 font-mono font-semibold tracking-widest text-chalk-100/50">
                <span className="h-2 w-2 rounded-full bg-chalk-0/40" aria-hidden="true" />
                PLATAFORMA 20%
              </dt>
              <dd className="font-display text-base font-bold tabular-nums">
                {formatearPesos(Math.round(plataformaAnimada))}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
