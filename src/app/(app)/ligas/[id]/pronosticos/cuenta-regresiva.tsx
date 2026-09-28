"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function formatearFecha(fecha: Date): string {
  return fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearRestante(msRestante: number): string {
  if (msRestante <= 0) return "Cerrando…";
  const totalMinutos = Math.floor(msRestante / 60_000);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas > 0) return `${horas}h ${minutos}m`;
  return `${minutos}m`;
}

// El primer render (servidor y cliente antes de montar) muestra la fecha
// fija para no arriesgar un mismatch de hidratación contra "now()"; recién
// después de montar en el cliente pasa a la cuenta regresiva en vivo.
export function CuentaRegresivaCierre({
  horaCierre,
  variante = "default",
}: {
  horaCierre: string;
  variante?: "default" | "hero";
}) {
  const [montado, setMontado] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const cierre = new Date(horaCierre);

  useEffect(() => {
    setMontado(true);
    const id = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const texto = montado
    ? formatearRestante(cierre.getTime() - ahora)
    : `${formatearFecha(cierre)}hs`;

  if (variante === "hero") {
    return (
      <span className="font-display text-xl font-bold leading-tight tabular-nums text-chalk-0 lg:text-3xl">
        {texto}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums text-pitch-700">
      <Clock className="h-[15px] w-[15px]" aria-hidden="true" />
      Cierre: {texto}
    </span>
  );
}
