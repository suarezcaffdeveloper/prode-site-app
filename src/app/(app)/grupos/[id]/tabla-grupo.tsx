import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/landing/reveal";
import {
  BONUS_JORNADA_PERFECTA,
  PUNTOS_EXACTO,
  PUNTOS_SIGNO,
  type FilaGrupo,
} from "@/lib/puntos-grupo";

// Escritorio: 1° con medalla lima, 2° y 3° en gris verdoso (igual que la tabla de equipos).
function claseMedalla(pos: number): string {
  if (pos === 1) return "lg:bg-lime-400 lg:text-pitch-900";
  if (pos <= 3) return "lg:bg-chalk-100 lg:text-pitch-700";
  return "";
}

const celdaBase =
  "px-3 py-3 text-right text-[13px] tabular-nums text-ink-600 lg:px-4 lg:py-4 lg:text-[15px]";
const encabezadoBase =
  "px-3 py-2.5 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400 lg:px-4 lg:py-3.5 lg:text-[11px] lg:text-chalk-0/70";

export function TablaGrupo({
  filas,
  usuarioActualId,
}: {
  filas: FilaGrupo[];
  usuarioActualId: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Reveal soloEscritorio>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">Tabla de posiciones del subgrupo</caption>
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
                    Jugador
                  </th>
                  <th scope="col" className={`${encabezadoBase} lg:text-lime-300`}>
                    Pts
                  </th>
                  <th scope="col" className={encabezadoBase}>
                    Fechas
                  </th>
                  <th scope="col" className={encabezadoBase}>
                    Exactos
                  </th>
                  <th scope="col" className={encabezadoBase}>
                    Signo
                  </th>
                  <th scope="col" className={encabezadoBase}>
                    Perfectas
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => {
                  const esYo = fila.usuarioId === usuarioActualId;
                  const lider = fila.pos === 1 && fila.jornadasJugadas > 0;
                  return (
                    <tr
                      key={fila.usuarioId}
                      className={`border-b border-line last:border-b-0 lg:transition-colors lg:hover:bg-chalk-50 ${
                        esYo
                          ? "bg-chalk-100 lg:bg-lime-400/10 lg:hover:bg-lime-400/15"
                          : lider
                            ? "lg:bg-lime-400/10 lg:hover:bg-lime-400/15"
                            : ""
                      } ${fila.activo ? "" : "opacity-55"}`}
                    >
                      <td
                        className={`sticky left-0 z-10 w-10 min-w-10 px-3 py-3 text-left font-mono text-[13px] tabular-nums lg:static lg:bg-transparent lg:px-4 lg:py-4 ${
                          esYo ? "bg-chalk-100" : "bg-chalk-0"
                        } ${lider ? "font-bold text-pitch-700" : "text-ink-400"}`}
                      >
                        <span
                          className={`lg:inline-flex lg:h-8 lg:w-8 lg:items-center lg:justify-center lg:rounded-full lg:text-sm lg:font-bold ${
                            fila.pos ? claseMedalla(fila.pos) : ""
                          }`}
                        >
                          {fila.pos ?? "—"}
                        </span>
                      </td>
                      <th
                        scope="row"
                        className={`sticky left-10 z-10 min-w-40 border-r border-line px-3 py-3 text-left font-normal sm:border-r-0 lg:static lg:bg-transparent lg:px-4 lg:py-4 ${
                          esYo ? "bg-chalk-100" : "bg-chalk-0"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="max-w-36 truncate text-[13px] font-medium text-ink-900 sm:max-w-none lg:text-base">
                            {fila.nombre}
                            {esYo && (
                              <span className="ml-2 font-mono text-[10px] font-semibold tracking-widest text-pitch-600">
                                VOS
                              </span>
                            )}
                          </span>
                          {!fila.activo && (
                            <span className="text-[11px] text-ink-400">
                              Inactivo · fuera del ranking
                            </span>
                          )}
                        </div>
                      </th>
                      <td
                        className={`${celdaBase} font-bold text-ink-900 lg:font-display lg:text-xl`}
                      >
                        {fila.pts}
                      </td>
                      <td className={celdaBase}>{fila.jornadasJugadas}</td>
                      <td className={celdaBase}>{fila.exactos}</td>
                      <td className={celdaBase}>{fila.signos}</td>
                      <td className={celdaBase}>{fila.perfectas}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>

      <p className="text-[11px] leading-relaxed text-ink-400 lg:text-xs">
        Pts puntos · Fechas en las que jugaste · Exactos marcadores acertados ({PUNTOS_EXACTO} pts
        c/u) · Signo ganador o empate sin el marcador ({PUNTOS_SIGNO} pt c/u) · Perfectas fechas con
        todos los marcadores exactos (+{BONUS_JORNADA_PERFECTA} pts). Desempata: puntos, exactos,
        perfectas y nombre.
      </p>
    </div>
  );
}
