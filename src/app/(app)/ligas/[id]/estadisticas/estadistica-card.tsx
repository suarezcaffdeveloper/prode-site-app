import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/landing/reveal";
import { Escudo } from "@/components/ui/escudo";
import type { EntradaRanking, EquipoRef, Racha } from "@/lib/estadisticas";

const formatoDecimal = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const formatos = {
  entero: (valor: number) => String(valor),
  promedio: (valor: number) => `${formatoDecimal.format(valor)} por PJ`,
  porcentaje: (valor: number) => `${valor}%`,
  puntosPorcentuales: (valor: number) => `${valor} pp`,
  partidos: (valor: number) => `${valor} ${valor === 1 ? "partido" : "partidos"}`,
  racha: (valor: number) => `${valor} ${valor === 1 ? "partido" : "partidos"}`,
};

export function EstadisticaCard({
  titulo,
  subtitulo,
  ranking,
  formatoValor = formatos.entero,
  record,
  retraso = 0,
}: {
  titulo: string;
  subtitulo?: string;
  ranking: EntradaRanking[];
  formatoValor?: (valor: number) => string;
  record?: Racha["record"];
  // Escalona la entrada de las tarjetas de una misma fila (solo escritorio).
  retraso?: number;
}) {
  return (
    <Reveal soloEscritorio variante="scale" retraso={retraso} className="lg:h-full">
      <Card className="flex h-full flex-col gap-4 p-5 lg:gap-0 lg:overflow-hidden lg:p-0 lg:transition-all lg:duration-300 lg:hover:-translate-y-1 lg:hover:border-pitch-500 lg:hover:shadow-[0_16px_36px_rgba(16,36,26,0.10)]">
        <div className="lg:bg-pitch-900 lg:px-5 lg:py-4">
          <h3 className="text-sm font-semibold text-ink-900 lg:text-[15px] lg:text-chalk-0">
            {titulo}
          </h3>
          {subtitulo && (
            <p className="mt-0.5 text-xs text-ink-400 lg:text-chalk-0/60">{subtitulo}</p>
          )}
        </div>

        {ranking.length === 0 ? (
          <p className="py-2 text-xs text-ink-400 lg:px-5 lg:py-6">
            Sin datos suficientes todavía.
          </p>
        ) : (
          <ol className="flex flex-col gap-3 lg:gap-1 lg:p-3">
            {ranking.map((entrada) => (
              <li
                key={entrada.equipo.id}
                className={`flex items-center gap-3 lg:gap-3.5 lg:rounded-xl lg:px-3 lg:py-2.5 lg:transition-colors ${
                  entrada.pos === 1 ? "lg:bg-lime-400/15" : "lg:hover:bg-chalk-50"
                }`}
              >
                <span
                  className={`w-4 shrink-0 text-center font-mono text-xs tabular-nums lg:flex lg:h-6 lg:w-6 lg:items-center lg:justify-center lg:rounded-full lg:text-[11px] ${
                    entrada.pos === 1
                      ? "font-bold text-pitch-600 lg:bg-lime-400 lg:text-pitch-900"
                      : "text-ink-400 lg:bg-chalk-100"
                  }`}
                >
                  {entrada.pos}
                </span>
                <Escudo
                  url={entrada.equipo.escudoUrl}
                  nombre={entrada.equipo.nombre}
                  className={`h-7 w-7 text-[11px] lg:transition-transform lg:duration-300 ${
                    entrada.pos === 1 ? "lg:h-10 lg:w-10 lg:text-base" : "lg:h-8 lg:w-8"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[13px] font-medium text-ink-900 ${
                      entrada.pos === 1 ? "lg:text-[15px] lg:font-semibold" : "lg:text-sm"
                    }`}
                  >
                    {entrada.equipo.nombre}
                  </p>
                  {entrada.detalle && (
                    <p className="truncate text-[11px] text-ink-400 lg:text-xs">
                      {entrada.detalle}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 font-mono text-[13px] font-semibold tabular-nums text-ink-900 ${
                    entrada.pos === 1 ? "lg:text-base lg:font-bold lg:text-pitch-700" : ""
                  }`}
                >
                  {formatoValor(entrada.valor)}
                </span>
              </li>
            ))}
          </ol>
        )}

        {record !== undefined && record !== null && (
          <RecordRacha valor={record.valor} equipos={record.equipos} />
        )}
      </Card>
    </Reveal>
  );
}

function RecordRacha({ valor, equipos }: { valor: number; equipos: EquipoRef[] }) {
  return (
    <div className="flex items-center gap-2 border-t border-line pt-3 text-xs text-ink-600 lg:mt-auto lg:bg-chalk-50 lg:px-5 lg:py-3.5">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400">
        Récord
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Escudo
          url={equipos[0].escudoUrl}
          nombre={equipos[0].nombre}
          className="h-4 w-4 text-[8px]"
        />
        <span className="truncate">
          {equipos.length === 1 ? equipos[0].nombre : `${equipos[0].nombre} y ${equipos.length - 1} más`}
        </span>
      </div>
      <span className="shrink-0 font-mono font-semibold tabular-nums text-ink-900">
        {formatos.racha(valor)}
      </span>
    </div>
  );
}
