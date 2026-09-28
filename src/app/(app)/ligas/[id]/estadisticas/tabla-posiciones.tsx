import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import type { FilaTabla } from "@/lib/estadisticas";

const COLUMNAS = ["Pts", "PJ", "PG", "PE", "PP", "GF", "GC", "DG"] as const;

function formatearDiferencia(dg: number): string {
  if (dg > 0) return `+${dg}`;
  return String(dg);
}

function claseDiferencia(dg: number): string {
  if (dg > 0) return "text-pitch-600";
  if (dg < 0) return "text-coral-500";
  return "text-ink-400";
}

const celdaBase = "px-3 py-3 text-right text-[13px] tabular-nums text-ink-600";
const encabezadoBase =
  "px-3 py-2.5 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400";

export function TablaPosiciones({ filas }: { filas: FilaTabla[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">Tabla de posiciones</caption>
            <thead>
              <tr className="border-b border-line bg-chalk-50">
                <th
                  scope="col"
                  className="sticky left-0 z-10 w-10 min-w-10 bg-chalk-50 px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400"
                >
                  Pos
                </th>
                <th
                  scope="col"
                  className="sticky left-10 z-10 min-w-40 border-r border-line bg-chalk-50 px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400 sm:border-r-0"
                >
                  Equipo
                </th>
                {COLUMNAS.map((columna) => (
                  <th key={columna} scope="col" className={encabezadoBase}>
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.equipo.id} className="border-b border-line last:border-b-0">
                  <td
                    className={`sticky left-0 z-10 w-10 min-w-10 bg-chalk-0 px-3 py-3 text-left font-mono text-[13px] tabular-nums ${
                      fila.pos === 1 ? "font-bold text-pitch-700" : "text-ink-400"
                    }`}
                  >
                    {fila.pos}
                  </td>
                  <th
                    scope="row"
                    className="sticky left-10 z-10 min-w-40 border-r border-line bg-chalk-0 px-3 py-3 text-left font-normal sm:border-r-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <Escudo
                        url={fila.equipo.escudoUrl}
                        nombre={fila.equipo.nombre}
                        className="h-6 w-6 text-[10px]"
                      />
                      <span className="max-w-32 truncate text-[13px] font-medium text-ink-900 sm:max-w-none">
                        {fila.equipo.nombre}
                      </span>
                    </div>
                  </th>
                  <td className={`${celdaBase} font-bold text-ink-900`}>{fila.pts}</td>
                  <td className={celdaBase}>{fila.pj}</td>
                  <td className={celdaBase}>{fila.pg}</td>
                  <td className={celdaBase}>{fila.pe}</td>
                  <td className={celdaBase}>{fila.pp}</td>
                  <td className={celdaBase}>{fila.gf}</td>
                  <td className={celdaBase}>{fila.gc}</td>
                  <td className={`${celdaBase} font-medium ${claseDiferencia(fila.dg)}`}>
                    {formatearDiferencia(fila.dg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[11px] leading-relaxed text-ink-400">
        Pts puntos · PJ jugados · PG ganados · PE empatados · PP perdidos · GF goles a favor ·
        GC goles en contra · DG diferencia de gol. Ganar suma 3, empatar 1.
      </p>
    </div>
  );
}
