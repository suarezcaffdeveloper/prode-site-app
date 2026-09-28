"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Percent } from "lucide-react";
import { Escudo } from "@/components/ui/escudo";
import { formatearPesos } from "@/lib/pozo";
import { useNumeroAnimado, usePrefiereMovimientoReducido } from "./hooks";

const PARTIDOS = [
  { local: "Deportivo Norte", visitante: "Atlético Sur" },
  { local: "Club Central", visitante: "Unión Este" },
  { local: "Real Puerto", visitante: "Sporting Oeste" },
];

const PRONOSTICOS: [number, number][][] = [
  [[2, 1], [0, 0], [1, 3]],
  [[1, 1], [2, 0], [0, 2]],
  [[3, 1], [1, 2], [2, 2]],
];

const POZO_BASE = 84000;
const APORTE_POR_PRODE = 1200;
const SEGUNDOS_INICIALES = 2 * 3600 + 14 * 60 + 35;

function formatearCuenta(segundos: number) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function HeroCarton() {
  const reducido = usePrefiereMovimientoReducido();
  const [pulso, setPulso] = useState(0);
  const [segundos, setSegundos] = useState(SEGUNDOS_INICIALES);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducido) return;
    const id = setInterval(() => setPulso((p) => p + 1), 3600);
    return () => clearInterval(id);
  }, [reducido]);

  useEffect(() => {
    if (reducido) return;
    const id = setInterval(() => setSegundos((s) => (s > 0 ? s - 1 : SEGUNDOS_INICIALES)), 1000);
    return () => clearInterval(id);
  }, [reducido]);

  const pozo = useNumeroAnimado(POZO_BASE + pulso * APORTE_POR_PRODE, 900);
  const juego = PRONOSTICOS[pulso % PRONOSTICOS.length];

  function inclinar(evento: React.MouseEvent<HTMLDivElement>) {
    const el = contenedor.current;
    if (!el || reducido) return;
    const caja = el.getBoundingClientRect();
    const x = (evento.clientX - caja.left) / caja.width - 0.5;
    const y = (evento.clientY - caja.top) / caja.height - 0.5;
    el.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
  }

  function reposar() {
    if (contenedor.current) contenedor.current.style.transform = "";
  }

  return (
    <div className="relative mx-auto w-full max-w-md [perspective:1200px]">
      <div
        ref={contenedor}
        onMouseMove={inclinar}
        onMouseLeave={reposar}
        className="transition-transform duration-200 ease-out [transform-style:preserve-3d]"
      >
        <div className="relative rounded-3xl bg-chalk-0 p-5 text-ink-900 shadow-[0_30px_80px_rgba(0,0,0,0.55)] ring-1 ring-chalk-0/30">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-md bg-lime-400/25 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest text-pitch-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-lime-400" aria-hidden="true" />
                <span className="relative h-2 w-2 rounded-full bg-lime-400" aria-hidden="true" />
              </span>
              FECHA 12 · ABIERTA
            </span>
            <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
              EJEMPLO
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 border-b border-line pb-3 font-mono text-sm font-bold tabular-nums text-pitch-700">
            <Clock className="h-[15px] w-[15px]" aria-hidden="true" />
            Cierre: {formatearCuenta(segundos)}
          </div>

          <div className="flex flex-col divide-y divide-line">
            {PARTIDOS.map((partido, i) => (
              <div key={partido.local} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3.5">
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <p className="min-w-0 flex-1 truncate text-right text-xs font-medium sm:text-sm">
                    {partido.local}
                  </p>
                  <Escudo nombre={partido.local} className="h-7 w-7 text-[11px]" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    key={`${pulso}-l-${i}`}
                    className="flex h-9 w-9 animate-pop-in items-center justify-center rounded-lg border border-pitch-500 bg-pitch-500/5 font-mono text-lg font-bold tabular-nums text-pitch-700"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    {juego[i][0]}
                  </span>
                  <span className="font-mono text-xs text-ink-400">-</span>
                  <span
                    key={`${pulso}-v-${i}`}
                    className="flex h-9 w-9 animate-pop-in items-center justify-center rounded-lg border border-pitch-500 bg-pitch-500/5 font-mono text-lg font-bold tabular-nums text-pitch-700"
                    style={{ animationDelay: `${i * 90 + 45}ms` }}
                  >
                    {juego[i][1]}
                  </span>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <Escudo nombre={partido.visitante} className="h-7 w-7 text-[11px]" />
                  <p className="min-w-0 flex-1 truncate text-xs font-medium sm:text-sm">
                    {partido.visitante}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-1 flex items-end justify-between gap-3 rounded-2xl bg-pitch-900 p-4">
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-widest text-chalk-100/60">
                POZO PARA EL GANADOR
              </p>
              <p className="font-display text-3xl font-bold leading-tight tabular-nums text-lime-300">
                {formatearPesos(Math.round(pozo))}
              </p>
            </div>
            <span
              key={pulso}
              className={`absolute -top-3 right-3 rounded-full bg-lime-400 px-3 py-1 font-mono text-[11px] font-bold text-pitch-900 shadow-lg ${
                pulso === 0 ? "opacity-0" : "animate-toast"
              }`}
            >
              + {formatearPesos(APORTE_POR_PRODE)} nuevo prode
            </span>
            <span className="text-right font-mono text-[10px] font-semibold tracking-widest text-chalk-100/60">
              SE SUMA CADA
              <br />
              PRODE CARGADO
            </span>
          </div>
        </div>
      </div>

      <div
        className="absolute -left-4 top-24 hidden animate-float items-center gap-2 rounded-2xl bg-chalk-0 px-4 py-2.5 text-sm font-semibold text-ink-900 shadow-[0_16px_40px_rgba(0,0,0,0.35)] sm:flex lg:-left-10"
        aria-hidden="true"
      >
        <CheckCircle2 className="h-5 w-5 text-pitch-600" />
        Marcador exacto
      </div>
      <div
        className="absolute -right-3 -top-5 hidden animate-float-slow items-center gap-2 rounded-2xl bg-lime-400 px-4 py-2.5 text-sm font-bold text-pitch-900 shadow-[0_16px_40px_rgba(0,0,0,0.35)] sm:flex lg:-right-8"
        aria-hidden="true"
      >
        <Percent className="h-4 w-4" />
        80% va al pozo
      </div>
    </div>
  );
}
