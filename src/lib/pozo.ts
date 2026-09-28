import type { SupabaseClient } from "@supabase/supabase-js";

export type PozoJornada = {
  recaudado: number;
  cantidad_cartones: number;
  pozo_jornada: number;
  pozo_acumulado_entrante: number;
  pozo_total: number;
  liquidada: boolean;
  cantidad_ganadores: number;
};

export function formatearPesos(monto: number): string {
  const entero = Number.isInteger(monto);
  return monto.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: entero ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function repartirPozo(
  pozoTotal: number,
  ganadores: number,
): { montoPorGanador: number; resto: number; acumuladoSaliente: number } {
  const centavos = Math.round(pozoTotal * 100);
  if (ganadores <= 0) {
    return { montoPorGanador: 0, resto: 0, acumuladoSaliente: centavos / 100 };
  }
  const porGanador = Math.floor(centavos / ganadores);
  return {
    montoPorGanador: porGanador / 100,
    resto: (centavos - porGanador * ganadores) / 100,
    acumuladoSaliente: 0,
  };
}

export async function obtenerPozoJornada(
  supabase: SupabaseClient,
  ligaId: string,
  jornada: number,
): Promise<PozoJornada | null> {
  const { data } = await supabase.rpc("pozo_jornada", {
    p_liga_id: ligaId,
    p_jornada: jornada,
  });
  return (data as PozoJornada[] | null)?.[0] ?? null;
}
