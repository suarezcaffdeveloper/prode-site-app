// Tabla de posiciones y estadísticas de equipos de una liga (SPEC 08).
// Funciones puras, sin I/O: reciben equipos y partidos ya finalizados y
// derivan todo en memoria en cada request.

export type EquipoRef = { id: string; nombre: string; escudoUrl: string | null };

export type PartidoFinalizado = {
  jornada: number;
  equipoLocalId: string;
  equipoVisitanteId: string;
  golesLocal: number;
  golesVisitante: number;
};

export type Resultado = "G" | "E" | "P";

export type FilaTabla = {
  equipo: EquipoRef;
  pos: number;
  pts: number;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
};

export type EntradaRanking = {
  equipo: EquipoRef;
  pos: number;
  valor: number;
  detalle: string | null;
};

export type Racha = {
  ranking: EntradaRanking[];
  record: { valor: number; equipos: EquipoRef[] } | null;
};

export type FormaEquipo = {
  equipo: EquipoRef;
  pos: number;
  resultados: Resultado[];
};

export type EstadisticasLiga = {
  partidosFinalizados: number;
  jornadasConResultados: number;
  ataqueDefensa: {
    masConvierte: EntradaRanking[];
    menosRecibidos: EntradaRanking[];
    vallasInvictas: EntradaRanking[];
    sinConvertir: EntradaRanking[];
  };
  rachas: {
    ganadora: Racha;
    invicta: Racha;
    sinGanar: Racha;
    derrotas: Racha;
  };
  localVisitante: {
    mejorLocal: EntradaRanking[];
    mejorVisitante: EntradaRanking[];
    diferencia: EntradaRanking[];
  };
  tendencias: {
    masEmpata: EntradaRanking[];
    masGoles: EntradaRanking[];
    ambosConvierten: EntradaRanking[];
    forma: FormaEquipo[];
  };
};

const TOP_RANKING = 3;
const PARTIDOS_FORMA = 5;

type Acumulado = {
  equipo: EquipoRef;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  pjLocal: number;
  ptsLocal: number;
  pjVisitante: number;
  ptsVisitante: number;
  vallasInvictas: number;
  sinConvertir: number;
  tresOMasGoles: number;
  ambosConvierten: number;
  resultados: Resultado[];
};

function compararNombre(a: EquipoRef, b: EquipoRef): number {
  return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
}

function registrar(
  acumulado: Acumulado,
  golesFavor: number,
  golesContra: number,
  esLocal: boolean,
) {
  const resultado: Resultado =
    golesFavor > golesContra ? "G" : golesFavor === golesContra ? "E" : "P";
  const puntos = resultado === "G" ? 3 : resultado === "E" ? 1 : 0;

  acumulado.pj += 1;
  acumulado.gf += golesFavor;
  acumulado.gc += golesContra;
  if (resultado === "G") acumulado.pg += 1;
  else if (resultado === "E") acumulado.pe += 1;
  else acumulado.pp += 1;

  if (esLocal) {
    acumulado.pjLocal += 1;
    acumulado.ptsLocal += puntos;
  } else {
    acumulado.pjVisitante += 1;
    acumulado.ptsVisitante += puntos;
  }

  if (golesContra === 0) acumulado.vallasInvictas += 1;
  if (golesFavor === 0) acumulado.sinConvertir += 1;
  if (golesFavor + golesContra >= 3) acumulado.tresOMasGoles += 1;
  if (golesFavor >= 1 && golesContra >= 1) acumulado.ambosConvierten += 1;

  acumulado.resultados.push(resultado);
}

// Un único recorrido, con los partidos ordenados por jornada (SPEC 03
// garantiza que un equipo juega como máximo una vez por jornada, así que el
// orden cronológico de cada equipo es inequívoco).
function acumular(
  equipos: EquipoRef[],
  partidos: PartidoFinalizado[],
): Map<string, Acumulado> {
  const mapa = new Map<string, Acumulado>();
  for (const equipo of equipos) {
    mapa.set(equipo.id, {
      equipo,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      pjLocal: 0,
      ptsLocal: 0,
      pjVisitante: 0,
      ptsVisitante: 0,
      vallasInvictas: 0,
      sinConvertir: 0,
      tresOMasGoles: 0,
      ambosConvierten: 0,
      resultados: [],
    });
  }

  const ordenados = [...partidos].sort((a, b) => a.jornada - b.jornada);
  for (const partido of ordenados) {
    const local = mapa.get(partido.equipoLocalId);
    const visitante = mapa.get(partido.equipoVisitanteId);
    if (!local || !visitante) continue;
    registrar(local, partido.golesLocal, partido.golesVisitante, true);
    registrar(visitante, partido.golesVisitante, partido.golesLocal, false);
  }

  return mapa;
}

function armarTabla(acumulados: Map<string, Acumulado>): FilaTabla[] {
  const filas = [...acumulados.values()].map((a) => ({
    equipo: a.equipo,
    pts: a.pg * 3 + a.pe,
    pj: a.pj,
    pg: a.pg,
    pe: a.pe,
    pp: a.pp,
    gf: a.gf,
    gc: a.gc,
    dg: a.gf - a.gc,
  }));

  filas.sort(
    (a, b) =>
      b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || compararNombre(a.equipo, b.equipo),
  );

  return filas.map((fila, i) => ({ ...fila, pos: i + 1 }));
}

export function calcularTablaPosiciones(
  equipos: EquipoRef[],
  partidos: PartidoFinalizado[],
): FilaTabla[] {
  return armarTabla(acumular(equipos, partidos));
}

type Candidato = { equipo: EquipoRef; valor: number; detalle: string | null };

// Ranking con posición compartida en empates (1, 1, 3): se listan todos los
// equipos cuya posición cae dentro del top, aunque sean más de TOP_RANKING.
function rankear(
  candidatos: Candidato[],
  orden: "desc" | "asc",
): EntradaRanking[] {
  const ordenados = [...candidatos].sort(
    (a, b) =>
      (orden === "desc" ? b.valor - a.valor : a.valor - b.valor) ||
      compararNombre(a.equipo, b.equipo),
  );

  const resultado: EntradaRanking[] = [];
  let posActual = 0;
  let valorAnterior: number | null = null;

  ordenados.forEach((candidato, i) => {
    if (candidato.valor !== valorAnterior) {
      posActual = i + 1;
      valorAnterior = candidato.valor;
    }
    if (posActual <= TOP_RANKING) resultado.push({ ...candidato, pos: posActual });
  });

  return resultado;
}

function rankearPositivos(
  acumulados: Acumulado[],
  valorDe: (a: Acumulado) => number,
  detalleDe: (a: Acumulado) => string | null,
  orden: "desc" | "asc" = "desc",
): EntradaRanking[] {
  const candidatos = acumulados
    .filter((a) => a.pj > 0)
    .map((a) => ({ equipo: a.equipo, valor: valorDe(a), detalle: detalleDe(a) }))
    .filter((c) => c.valor > 0);
  return rankear(candidatos, orden);
}

function rachaActual(resultados: Resultado[], cumple: (r: Resultado) => boolean): number {
  let cantidad = 0;
  for (let i = resultados.length - 1; i >= 0 && cumple(resultados[i]); i--) cantidad++;
  return cantidad;
}

function rachaRecord(resultados: Resultado[], cumple: (r: Resultado) => boolean): number {
  let mejor = 0;
  let actual = 0;
  for (const r of resultados) {
    actual = cumple(r) ? actual + 1 : 0;
    if (actual > mejor) mejor = actual;
  }
  return mejor;
}

function armarRacha(acumulados: Acumulado[], cumple: (r: Resultado) => boolean): Racha {
  const candidatos = acumulados
    .map((a) => ({
      equipo: a.equipo,
      valor: rachaActual(a.resultados, cumple),
      detalle: null,
    }))
    .filter((c) => c.valor > 0);

  let maximo = 0;
  for (const a of acumulados) maximo = Math.max(maximo, rachaRecord(a.resultados, cumple));

  return {
    ranking: rankear(candidatos, "desc"),
    record:
      maximo > 0
        ? {
            valor: maximo,
            equipos: acumulados
              .filter((a) => rachaRecord(a.resultados, cumple) === maximo)
              .map((a) => a.equipo)
              .sort(compararNombre),
          }
        : null,
  };
}

function goles(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? "gol" : "goles"}`;
}

function puntos(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? "pt" : "pts"}`;
}

function porcentaje(pts: number, partidos: number): number {
  return partidos === 0 ? 0 : Math.round((pts / (partidos * 3)) * 100);
}

export function calcularEstadisticas(
  equipos: EquipoRef[],
  partidos: PartidoFinalizado[],
): EstadisticasLiga {
  const acumulados = acumular(equipos, partidos);
  const lista = [...acumulados.values()];
  const tabla = armarTabla(acumulados);

  const deDe = (a: Acumulado) => `de ${a.pj} PJ`;

  const conLocalYVisita = lista.filter((a) => a.pjLocal > 0 && a.pjVisitante > 0);

  return {
    partidosFinalizados: partidos.length,
    jornadasConResultados: new Set(partidos.map((p) => p.jornada)).size,

    ataqueDefensa: {
      masConvierte: rankearPositivos(
        lista,
        (a) => a.gf / a.pj,
        (a) => `${goles(a.gf)} en ${a.pj} PJ`,
      ),
      // Aquí 0 es el mejor valor posible, no "sin datos": no se filtra por > 0.
      menosRecibidos: rankear(
        lista
          .filter((a) => a.pj > 0)
          .map((a) => ({
            equipo: a.equipo,
            valor: a.gc / a.pj,
            detalle: `${goles(a.gc)} en ${a.pj} PJ`,
          })),
        "asc",
      ),
      vallasInvictas: rankearPositivos(lista, (a) => a.vallasInvictas, deDe),
      sinConvertir: rankearPositivos(lista, (a) => a.sinConvertir, deDe),
    },

    rachas: {
      ganadora: armarRacha(lista, (r) => r === "G"),
      invicta: armarRacha(lista, (r) => r !== "P"),
      sinGanar: armarRacha(lista, (r) => r !== "G"),
      derrotas: armarRacha(lista, (r) => r === "P"),
    },

    localVisitante: {
      mejorLocal: rankear(
        lista
          .filter((a) => a.pjLocal > 0)
          .map((a) => ({
            equipo: a.equipo,
            valor: porcentaje(a.ptsLocal, a.pjLocal),
            detalle: `${puntos(a.ptsLocal)} en ${a.pjLocal} PJ`,
          }))
          .filter((c) => c.valor > 0),
        "desc",
      ),
      mejorVisitante: rankear(
        lista
          .filter((a) => a.pjVisitante > 0)
          .map((a) => ({
            equipo: a.equipo,
            valor: porcentaje(a.ptsVisitante, a.pjVisitante),
            detalle: `${puntos(a.ptsVisitante)} en ${a.pjVisitante} PJ`,
          }))
          .filter((c) => c.valor > 0),
        "desc",
      ),
      diferencia: rankear(
        conLocalYVisita
          .map((a) => {
            const local = porcentaje(a.ptsLocal, a.pjLocal);
            const visitante = porcentaje(a.ptsVisitante, a.pjVisitante);
            return {
              equipo: a.equipo,
              valor: Math.abs(local - visitante),
              detalle: `Local ${local}% · Visitante ${visitante}%`,
            };
          })
          .filter((c) => c.valor > 0),
        "desc",
      ),
    },

    tendencias: {
      masEmpata: rankearPositivos(lista, (a) => a.pe, deDe),
      masGoles: rankearPositivos(lista, (a) => a.tresOMasGoles, deDe),
      ambosConvierten: rankearPositivos(lista, (a) => a.ambosConvierten, deDe),
      forma: tabla
        .filter((fila) => fila.pj > 0)
        .map((fila) => ({
          equipo: fila.equipo,
          pos: fila.pos,
          resultados: (acumulados.get(fila.equipo.id)?.resultados ?? []).slice(
            -PARTIDOS_FORMA,
          ),
        })),
    },
  };
}
