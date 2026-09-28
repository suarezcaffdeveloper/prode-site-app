// Conversión entre el ISO que guarda la base y el formato que espera/devuelve
// un <input type="datetime-local">. Compartido entre el form completo de
// partido y la edición inline de horario (FilaCruce) para no duplicarlo.

export function aInputDatetimeLocal(iso?: string | null) {
  if (!iso) return "";
  const fecha = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(
    fecha.getHours(),
  )}:${pad(fecha.getMinutes())}`;
}

export function deInputDatetimeLocal(valor: string): string | null {
  if (!valor.trim()) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toISOString();
}
