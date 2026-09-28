"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const CONSULTA_MOVIMIENTO_REDUCIDO = "(prefers-reduced-motion: reduce)";

function suscribirMovimiento(avisar: () => void) {
  const mq = window.matchMedia(CONSULTA_MOVIMIENTO_REDUCIDO);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}

export function usePrefiereMovimientoReducido(): boolean {
  return useSyncExternalStore(
    suscribirMovimiento,
    () => window.matchMedia(CONSULTA_MOVIMIENTO_REDUCIDO).matches,
    () => false,
  );
}

export function useEnVista<T extends Element>(umbral = 0.3) {
  const ref = useRef<T>(null);
  const [enVista, setEnVista] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setEnVista(true);
          observer.disconnect();
        }
      },
      { threshold: umbral },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [umbral]);

  return { ref, enVista };
}

// Interpola de forma suave entre el valor anterior y el nuevo objetivo.
export function useNumeroAnimado(objetivo: number, duracion = 700, inicial = objetivo): number {
  const reducido = usePrefiereMovimientoReducido();
  const [valor, setValor] = useState(inicial);
  const desde = useRef(inicial);

  useEffect(() => {
    if (reducido) {
      desde.current = objetivo;
      return;
    }
    const inicio = performance.now();
    const origen = desde.current;
    let raf = 0;

    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      const suavizado = 1 - Math.pow(1 - t, 3);
      const actual = origen + (objetivo - origen) * suavizado;
      desde.current = actual;
      setValor(actual);
      if (t < 1) raf = requestAnimationFrame(paso);
    };

    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo, duracion, reducido]);

  return reducido ? objetivo : valor;
}
