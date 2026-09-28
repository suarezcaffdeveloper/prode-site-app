// Replica en TS el cálculo de saldo disponible de SPEC 04 (ver
// consumir_credito() en la migración): suma cantidad_total - cantidad_usada
// de los lotes que todavía no vencieron, para mostrar el mismo número tanto
// en el admin como en la pantalla de pronósticos sin repetir la query SQL.

export interface LoteCredito {
  cantidad_total: number;
  cantidad_usada: number;
  expira_en: string | null;
}

export function calcularSaldoDisponible(lotes: LoteCredito[]): number {
  const ahora = Date.now();
  return lotes.reduce((total, lote) => {
    const vigente = !lote.expira_en || new Date(lote.expira_en).getTime() > ahora;
    return vigente ? total + (lote.cantidad_total - lote.cantidad_usada) : total;
  }, 0);
}
