import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import type { FormaEquipo, Resultado } from "@/lib/estadisticas";

const ESTILO_RESULTADO: Record<Resultado, string> = {
  G: "bg-pitch-500/10 text-pitch-700",
  E: "bg-chalk-100 text-ink-600",
  P: "bg-coral-500/10 text-coral-700",
};

const NOMBRE_RESULTADO: Record<Resultado, string> = {
  G: "Ganó",
  E: "Empató",
  P: "Perdió",
};

export function FormaReciente({ forma }: { forma: FormaEquipo[] }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">Forma reciente</h3>
        <p className="mt-0.5 text-xs text-ink-400">
          Últimos 5 partidos de cada equipo, del más antiguo al más reciente.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
        {forma.map((item) => (
          <li key={item.equipo.id} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-center font-mono text-xs tabular-nums text-ink-400">
              {item.pos}
            </span>
            <Escudo
              url={item.equipo.escudoUrl}
              nombre={item.equipo.nombre}
              className="h-7 w-7 text-[11px]"
            />
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-900">
              {item.equipo.nombre}
            </p>
            <div className="flex shrink-0 gap-1">
              {item.resultados.map((resultado, i) => (
                <span
                  key={i}
                  title={NOMBRE_RESULTADO[resultado]}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-bold ${ESTILO_RESULTADO[resultado]}`}
                >
                  {resultado}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
