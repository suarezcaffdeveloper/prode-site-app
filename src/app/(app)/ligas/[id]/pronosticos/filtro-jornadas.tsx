import Link from "next/link";

// Chips de fecha/jornada: siempre incluye la jornada activa (con el punto
// verde y "(Actual)") y las jornadas anteriores ya completas, nunca una
// jornada futura todavía no jugable (ver jornadasDisponibles en page.tsx).
export function FiltroJornadas({
  ligaId,
  jornadas,
  jornadaActual,
  jornadaSeleccionada,
}: {
  ligaId: string;
  jornadas: number[];
  jornadaActual: number | null;
  jornadaSeleccionada: number;
}) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-6">
      <p className="font-mono text-[10px] font-semibold tracking-[0.22em] text-ink-400 lg:pt-3.5 lg:text-[11px] lg:tracking-[0.3em]">
        FECHA / JORNADA
      </p>
      <div
        className="-mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-1 lg:flex-wrap lg:gap-2.5 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {jornadas.map((jornada) => {
          const esActual = jornada === jornadaActual;
          const esSeleccionada = jornada === jornadaSeleccionada;
          return (
            <Link
              key={jornada}
              href={`/ligas/${ligaId}/pronosticos?jornada=${jornada}`}
              className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-all lg:h-11 lg:px-5 lg:hover:-translate-y-0.5 ${
                esSeleccionada
                  ? "border-pitch-700 bg-pitch-700 text-chalk-0 lg:shadow-[0_8px_20px_rgba(20,83,45,0.3)]"
                  : "border-line-strong bg-chalk-0 text-ink-600 hover:border-pitch-500 lg:hover:shadow-[0_8px_20px_rgba(16,36,26,0.08)]"
              }`}
            >
              {esActual && (
                <span className="h-1.5 w-1.5 rounded-full bg-lime-400" aria-hidden="true" />
              )}
              Fecha {jornada}
              {esActual ? " (Actual)" : ""}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
