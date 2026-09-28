"use client";

import { useEffect, useState } from "react";
import { usePrefiereMovimientoReducido } from "./hooks";

export function TextoRotativo({ palabras, intervalo = 2600 }: { palabras: string[]; intervalo?: number }) {
  const [indice, setIndice] = useState(0);
  const reducido = usePrefiereMovimientoReducido();

  useEffect(() => {
    if (reducido) return;
    const id = setInterval(() => setIndice((actual) => (actual + 1) % palabras.length), intervalo);
    return () => clearInterval(id);
  }, [palabras.length, intervalo, reducido]);

  return (
    <span className="inline-grid">
      {palabras.map((palabra, i) => (
        <span
          key={palabra}
          aria-hidden={i !== indice}
          className={`col-start-1 row-start-1 transition-all duration-500 ease-out ${
            i === indice ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {palabra}
        </span>
      ))}
    </span>
  );
}
