"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Vuelve a pedir los datos del servidor cada tanto: se monta solo mientras un
// pago está verificándose, para que el usuario vea el alta sin recargar.
export function RefrescarPeriodicamente({ cadaMs = 15_000 }: { cadaMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const intervalo = setInterval(() => router.refresh(), cadaMs);
    return () => clearInterval(intervalo);
  }, [router, cadaMs]);

  return null;
}
