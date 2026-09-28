import { Card } from "@/components/ui/card";
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
}: {
  titulo: string;
  subtitulo?: string;
  ranking: EntradaRanking[];
  formatoValor?: (valor: number) => string;
  record?: Racha["record"];
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">{titulo}</h3>
        {subtitulo && <p className="mt-0.5 text-xs text-ink-400">{subtitulo}</p>}
      </div>

      {ranking.length === 0 ? (
        <p className="py-2 text-xs text-ink-400">Sin datos suficientes todavía.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {ranking.map((entrada) => (
            <li key={entrada.equipo.id} className="flex items-center gap-3">
              <span
                className={`w-4 shrink-0 text-center font-mono text-xs tabular-nums ${
                  entrada.pos === 1 ? "font-bold text-pitch-600" : "text-ink-400"
                }`}
              >
                {entrada.pos}
              </span>
              <Escudo
                url={entrada.equipo.escudoUrl}
                nombre={entrada.equipo.nombre}
                className="h-7 w-7 text-[11px]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink-900">
                  {entrada.equipo.nombre}
                </p>
                {entrada.detalle && (
                  <p className="truncate text-[11px] text-ink-400">{entrada.detalle}</p>
                )}
              </div>
              <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-ink-900">
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
  );
}

function RecordRacha({ valor, equipos }: { valor: number; equipos: EquipoRef[] }) {
  return (
    <div className="flex items-center gap-2 border-t border-line pt-3 text-xs text-ink-600">
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
