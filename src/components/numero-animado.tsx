"use client";

import { useNumeroAnimado } from "@/components/landing/hooks";

// Cuenta desde 0 hasta el valor al montar; con movimiento reducido salta directo.
export function NumeroAnimado({
  valor,
  decimales = 0,
  className = "",
}: {
  valor: number;
  decimales?: number;
  className?: string;
}) {
  const animado = useNumeroAnimado(valor, 1400, 0);
  const mostrado = Math.abs(animado - valor) < 0.5 / 10 ** decimales ? valor : animado;

  return (
    <span className={`tabular-nums ${className}`}>
      {mostrado.toLocaleString("es-AR", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      })}
    </span>
  );
}
