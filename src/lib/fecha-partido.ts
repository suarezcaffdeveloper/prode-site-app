export function formatearFechaPartido(iso: string | null): string {
  if (!iso) return "A confirmar";
  return new Date(iso)
    .toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

const ZONA_AR = "America/Argentina/Buenos_Aires";

// "sáb 24/05" — para mostrar día y hora en líneas separadas.
export function formatearDiaPartido(iso: string): string {
  return new Date(iso)
    .toLocaleString("es-AR", {
      timeZone: ZONA_AR,
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    })
    .replace(",", "");
}

// "15:00"
export function formatearHoraPartido(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: ZONA_AR,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
