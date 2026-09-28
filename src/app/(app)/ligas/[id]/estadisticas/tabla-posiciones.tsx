import { Card } from "@/components/ui/card";
import { Escudo } from "@/components/ui/escudo";
import { Reveal } from "@/components/landing/reveal";
import type { FilaTabla, FormaEquipo, Resultado } from "@/lib/estadisticas";

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

const PUNTO_RESULTADO: Record<Resultado, { clase: string; nombre: string }> = {
  G: { clase: "bg-pitch-500", nombre: "Ganó" },
  E: { clase: "bg-ink-400/60", nombre: "Empató" },
  P: { clase: "bg-coral-500", nombre: "Perdió" },
};

// Escritorio: 1° con medalla lima, 2° y 3° en gris verdoso.
function claseMedalla(pos: number): string {
  if (pos === 1) return "lg:bg-lime-400 lg:text-pitch-900";
  if (pos <= 3) return "lg:bg-chalk-100 lg:text-pitch-700";
  return "";
}

const celdaBase =
  "px-3 py-3 text-right text-[13px] tabular-nums text-ink-600 lg:px-4 lg:py-4 lg:text-[15px]";
const encabezadoBase =
  "px-3 py-2.5 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400 lg:px-4 lg:py-3.5 lg:text-[11px] lg:text-chalk-0/70";

export function TablaPosiciones({
  filas,
  forma = [],
}: {
  filas: FilaTabla[];
  forma?: FormaEquipo[];
}) {
  const formaPorEquipo = new Map(forma.map((f) => [f.equipo.id, f.resultados]));

  return (
    <div className="flex flex-col gap-3">
      <Reveal soloEscritorio>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">Tabla de posiciones</caption>
              <thead>
                <tr className="border-b border-line bg-chalk-50 lg:border-b-0 lg:bg-pitch-900">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 w-10 min-w-10 bg-chalk-50 px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400 lg:static lg:w-16 lg:bg-transparent lg:px-4 lg:py-3.5 lg:text-[11px] lg:text-chalk-0/70"
                  >
                    Pos
                  </th>
                  <th
                    scope="col"
                    className="sticky left-10 z-10 min-w-40 border-r border-line bg-chalk-50 px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400 sm:border-r-0 lg:static lg:bg-transparent lg:px-4 lg:py-3.5 lg:text-[11px] lg:text-chalk-0/70"
                  >
                    Equipo
                  </th>
                  {COLUMNAS.map((columna) => (
                    <th
                      key={columna}
                      scope="col"
                      className={`${encabezadoBase} ${columna === "Pts" ? "lg:text-lime-300" : ""}`}
                    >
                      {columna}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className={`${encabezadoBase} hidden lg:table-cell lg:text-center`}
                  >
                    Forma
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => {
                  const resultados = formaPorEquipo.get(fila.equipo.id) ?? [];
                  return (
                    <tr
                      key={fila.equipo.id}
                      className={`border-b border-line last:border-b-0 lg:transition-colors lg:hover:bg-chalk-50 ${
                        fila.pos === 1 ? "lg:bg-lime-400/10 lg:hover:bg-lime-400/15" : ""
                      }`}
                    >
                      <td
                        className={`sticky left-0 z-10 w-10 min-w-10 bg-chalk-0 px-3 py-3 text-left font-mono text-[13px] tabular-nums lg:static lg:bg-transparent lg:px-4 lg:py-4 ${
                          fila.pos === 1 ? "font-bold text-pitch-700" : "text-ink-400"
                        }`}
                      >
                        <span
                          className={`lg:inline-flex lg:h-8 lg:w-8 lg:items-center lg:justify-center lg:rounded-full lg:text-sm lg:font-bold ${claseMedalla(fila.pos)}`}
                        >
                          {fila.pos}
                        </span>
                      </td>
                      <th
                        scope="row"
                        className="sticky left-10 z-10 min-w-40 border-r border-line bg-chalk-0 px-3 py-3 text-left font-normal sm:border-r-0 lg:static lg:bg-transparent lg:px-4 lg:py-4"
                      >
                        <div className="flex items-center gap-2.5 lg:gap-3.5">
                          <Escudo
                            url={fila.equipo.escudoUrl}
                            nombre={fila.equipo.nombre}
                            className="h-6 w-6 text-[10px] lg:h-10 lg:w-10 lg:text-base"
                          />
                          <span className="max-w-32 truncate text-[13px] font-medium text-ink-900 sm:max-w-none lg:text-base">
                            {fila.equipo.nombre}
                          </span>
                        </div>
                      </th>
                      <td
                        className={`${celdaBase} font-bold text-ink-900 lg:font-display lg:text-xl`}
                      >
                        {fila.pts}
                      </td>
                      <td className={celdaBase}>{fila.pj}</td>
                      <td className={celdaBase}>{fila.pg}</td>
                      <td className={celdaBase}>{fila.pe}</td>
                      <td className={celdaBase}>{fila.pp}</td>
                      <td className={celdaBase}>{fila.gf}</td>
                      <td className={celdaBase}>{fila.gc}</td>
                      <td className={`${celdaBase} font-medium ${claseDiferencia(fila.dg)}`}>
                        {formatearDiferencia(fila.dg)}
                      </td>
                      <td className="hidden px-4 py-4 lg:table-cell">
                        <div className="flex items-center justify-center gap-1.5">
                          {resultados.length === 0 ? (
                            <span className="text-ink-400">—</span>
                          ) : (
                            resultados.map((resultado, i) => (
                              <span
                                key={i}
                                title={PUNTO_RESULTADO[resultado].nombre}
                                className={`h-2.5 w-2.5 rounded-full ${PUNTO_RESULTADO[resultado].clase} ${
                                  i === resultados.length - 1 ? "ring-2 ring-offset-1 ring-line-strong" : ""
                                }`}
                              />
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>

      <p className="text-[11px] leading-relaxed text-ink-400 lg:text-xs">
        Pts puntos · PJ jugados · PG ganados · PE empatados · PP perdidos · GF goles a favor ·
        GC goles en contra · DG diferencia de gol. Ganar suma 3, empatar 1.
        <span className="hidden lg:inline">
          {" "}
          Forma: últimos 5 partidos, del más antiguo al más reciente (el último, con anillo).
        </span>
      </p>
    </div>
  );
}
