import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import type { FilaTabla } from "@/lib/estadisticas";

const CANTIDAD_FILAS = 5;

const encabezado =
  "px-3 py-2.5 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400";

export function InicioTablaResumen({
  ligaId,
  filas,
}: {
  ligaId: string;
  filas: FilaTabla[];
}) {
  const top = filas.slice(0, CANTIDAD_FILAS);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            POSICIONES
          </p>
          <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">
            Así viene la tabla
          </h2>
        </div>
        <Link
          href={`/ligas/${ligaId}/estadisticas`}
          className="shrink-0 text-sm font-medium text-pitch-700 hover:underline"
        >
          Tabla completa →
        </Link>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full border-collapse">
          <caption className="sr-only">Primeros puestos de la tabla de posiciones</caption>
          <thead>
            <tr className="border-b border-line bg-chalk-50">
              <th
                scope="col"
                className="w-10 px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400"
              >
                Pos
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400"
              >
                Equipo
              </th>
              <th scope="col" className={encabezado}>
                PJ
              </th>
              <th scope="col" className={encabezado}>
                DG
              </th>
              <th scope="col" className={encabezado}>
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {top.map((fila) => (
              <tr key={fila.equipo.id} className="border-b border-line last:border-b-0">
                <td
                  className={`px-3 py-3 text-left font-mono text-[13px] tabular-nums ${
                    fila.pos === 1 ? "font-bold text-pitch-700" : "text-ink-400"
                  }`}
                >
                  {fila.pos}
                </td>
                <th scope="row" className="px-3 py-3 text-left font-normal">
                  <span className="flex min-w-0 items-center gap-2">
                    <Escudo
                      url={fila.equipo.escudoUrl}
                      nombre={fila.equipo.nombre}
                      className="h-6 w-6 text-[10px]"
                    />
                    <span className="truncate text-sm font-medium text-ink-900">
                      {fila.equipo.nombre}
                    </span>
                  </span>
                </th>
                <td className="px-3 py-3 text-right text-[13px] tabular-nums text-ink-600">
                  {fila.pj}
                </td>
                <td className="px-3 py-3 text-right text-[13px] tabular-nums text-ink-600">
                  {fila.dg > 0 ? `+${fila.dg}` : fila.dg}
                </td>
                <td className="px-3 py-3 text-right text-[13px] font-bold tabular-nums text-ink-900">
                  {fila.pts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
