"use client";

import { useEnVista, useNumeroAnimado } from "./hooks";

export function Contador({
  hasta,
  prefijo = "",
  sufijo = "",
  duracion = 1400,
}: {
  hasta: number;
  prefijo?: string;
  sufijo?: string;
  duracion?: number;
}) {
  const { ref, enVista } = useEnVista<HTMLSpanElement>(0.5);
  const valor = useNumeroAnimado(enVista ? hasta : 0, duracion, 0);

  return (
    <span ref={ref} className="tabular-nums">
      {prefijo}
      {Math.round(valor).toLocaleString("es-AR")}
      {sufijo}
    </span>
  );
}
