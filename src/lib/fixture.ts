export function calcularTotalJornadas(cantidadEquipos: number): number {
  if (cantidadEquipos < 2) return 0;
  return cantidadEquipos % 2 === 0 ? cantidadEquipos - 1 : cantidadEquipos;
}

export function calcularPartidosPorJornadaCompleta(cantidadEquipos: number): number {
  return Math.floor(cantidadEquipos / 2);
}

// Límites de la carga masiva de fixture por Excel/CSV (spec 07), no de la base de datos.
export const MAX_FILAS_CARGA_MASIVA = 1000;
