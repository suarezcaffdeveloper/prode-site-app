"use client";

import { useNumeroAnimado } from "@/components/landing/hooks";
import { formatearPesos } from "@/lib/pozo";

// Cuenta desde 0 hasta el pozo al montar; con movimiento reducido salta directo.
export function PozoAnimado({ monto, className = "" }: { monto: number; className?: string }) {
  const valor = useNumeroAnimado(monto, 1400, 0);
  const mostrado = Math.abs(valor - monto) < 0.5 ? monto : Math.round(valor);

  return <span className={`tabular-nums ${className}`}>{formatearPesos(mostrado)}</span>;
}
