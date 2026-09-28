// "Marcador" — chip con estética de tablero de estadio (LED, monoespaciada,
// tabular-nums). Es el elemento de firma visual del producto: cualquier
// estado o código que el usuario deba leer de un vistazo (suscripción,
// código de invitación) se muestra con este mismo lenguaje, para que un
// dato de "marcador" siempre se reconozca como tal en toda la app.

type Estado = "pendiente" | "activa" | "inactiva";

const estadoConfig: Record<Estado, { label: string; dot: string; text: string }> = {
  pendiente: { label: "PENDIENTE", dot: "bg-amber-500", text: "text-amber-500" },
  activa: { label: "ACTIVA", dot: "bg-lime-400", text: "text-lime-400" },
  inactiva: { label: "INACTIVA", dot: "bg-coral-500", text: "text-coral-500" },
};

export function MarcadorEstado({ estado }: { estado: Estado }) {
  const config = estadoConfig[estado];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md bg-pitch-900 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest tabular-nums"
      role="status"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      <span className={config.text}>{config.label}</span>
    </span>
  );
}

export function MarcadorActiva({ activa }: { activa: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md bg-pitch-900 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest tabular-nums"
      role="status"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${activa ? "bg-lime-400" : "bg-ink-400"}`}
        aria-hidden="true"
      />
      <span className={activa ? "text-lime-400" : "text-ink-400"}>
        {activa ? "ACTIVA" : "INACTIVA"}
      </span>
    </span>
  );
}

export function MarcadorCodigo({ codigo }: { codigo: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-pitch-900 px-3 py-1.5 font-mono text-base font-semibold tracking-[0.3em] text-lime-300 tabular-nums">
      {codigo}
    </span>
  );
}

type EstadoPartido = "pendiente" | "finalizado";

const estadoPartidoConfig: Record<EstadoPartido, { label: string; dot: string; text: string }> = {
  pendiente: { label: "POR JUGAR", dot: "bg-amber-500", text: "text-amber-500" },
  finalizado: { label: "FINAL", dot: "bg-lime-400", text: "text-lime-400" },
};

export function MarcadorPartido({ estado }: { estado: EstadoPartido }) {
  const config = estadoPartidoConfig[estado];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md bg-pitch-900 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest tabular-nums"
      role="status"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      <span className={config.text}>{config.label}</span>
    </span>
  );
}

// Resultado oficial de un partido ya jugado: chip sólido en el verde de
// marca (nunca el negro/verde flúor del viejo tablero de estadio, retirado
// de todo el sistema).
export function MarcadorResultado({
  golesLocal,
  golesVisitante,
}: {
  golesLocal: number;
  golesVisitante: number;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md bg-pitch-700 px-3 py-1.5 font-mono text-base font-bold tabular-nums text-chalk-0">
      <span>{golesLocal}</span>
      <span className="text-chalk-0/50">–</span>
      <span>{golesVisitante}</span>
    </span>
  );
}

// Deliberadamente NO usa el chip sólido de "resultado oficial" de arriba:
// mostrar el propio pronóstico con esa misma estética hacía pensar que
// cargar un prode escribía el resultado real del partido.
export function MarcadorPronostico({
  golesLocal,
  golesVisitante,
  acertado = false,
}: {
  golesLocal: number;
  golesVisitante: number;
  acertado?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1 font-mono text-base font-bold tabular-nums text-pitch-700 ${
        acertado ? "border-pitch-500 bg-lime-400/25" : "border-line-strong bg-chalk-0"
      }`}
      title={
        acertado
          ? "¡Acertaste este resultado!"
          : "Tu pronóstico — no es el resultado oficial del partido"
      }
    >
      <span>{golesLocal}</span>
      <span className="text-ink-400">–</span>
      <span>{golesVisitante}</span>
    </span>
  );
}
