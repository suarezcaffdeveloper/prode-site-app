// Puntaje del ranking de subgrupos (SPEC 10). Funciones puras, sin I/O.
// El pozo (SPEC 09) usa otra regla (todo exacto o nada) y no depende de esto.

export const PUNTOS_EXACTO = 3;
export const PUNTOS_SIGNO = 1;
export const BONUS_JORNADA_PERFECTA = 5;

// Mismo margen que jornada_activa() / hora_cierre_jornada() en la base.
const MARGEN_CIERRE_MS = 30 * 60 * 1000;

export type Marcador = { golesLocal: number; golesVisitante: number };

export type MiembroGrupo = {
  usuarioId: string;
  nombre: string;
  unidoEn: string;
  esCreador: boolean;
  activo: boolean;
};

export type PartidoPuntuable = {
  id: string;
  jornada: number;
  fechaHora: string | null;
  finalizado: boolean;
  golesLocal: number | null;
  golesVisitante: number | null;
};

export type PronosticoGrupo = {
  usuarioId: string;
  jornada: number;
  cartonId: string;
  partidoId: string;
  golesLocal: number;
  golesVisitante: number;
};

export type PuntosPartido = 0 | 1 | 3;

export type PartidoDetalle = {
  partidoId: string;
  prediccion: Marcador | null;
  real: Marcador | null;
  puntos: PuntosPartido | null; // null: partido sin resultado todavía
};

export type EstadoMiembroJornada = "puntuado" | "sin_carton" | "previo_ingreso";

export type FilaDetalle = {
  usuarioId: string;
  nombre: string;
  activo: boolean;
  estado: EstadoMiembroJornada;
  cartonId: string | null;
  pts: number;
  exactos: number;
  signos: number;
  perfecta: boolean;
  partidos: PartidoDetalle[];
};

export type DetalleJornada = {
  jornada: number;
  cerrada: boolean;
  completa: boolean; // todos los partidos finalizados
  filas: FilaDetalle[];
};

export type FilaGrupo = {
  usuarioId: string;
  nombre: string;
  pos: number | null; // null: miembro inactivo, fuera del ranking
  pts: number;
  exactos: number;
  signos: number;
  perfectas: number;
  jornadasJugadas: number;
  activo: boolean;
  esCreador: boolean;
};

function signo(golesLocal: number, golesVisitante: number): -1 | 0 | 1 {
  if (golesLocal > golesVisitante) return 1;
  if (golesLocal < golesVisitante) return -1;
  return 0;
}

export function puntosPartido(prediccion: Marcador, real: Marcador): PuntosPartido {
  if (
    prediccion.golesLocal === real.golesLocal &&
    prediccion.golesVisitante === real.golesVisitante
  ) {
    return PUNTOS_EXACTO;
  }
  if (
    signo(prediccion.golesLocal, prediccion.golesVisitante) ===
    signo(real.golesLocal, real.golesVisitante)
  ) {
    return PUNTOS_SIGNO;
  }
  return 0;
}

// Cierre de una jornada: 30 minutos antes del primer partido, o null si a algún
// partido le falta el horario (o la jornada no tiene partidos).
export function horaCierreJornada(partidos: PartidoPuntuable[]): number | null {
  if (partidos.length === 0) return null;
  let primero = Infinity;
  for (const partido of partidos) {
    if (!partido.fechaHora) return null;
    primero = Math.min(primero, new Date(partido.fechaHora).getTime());
  }
  return primero - MARGEN_CIERRE_MS;
}

function agruparPorJornada(partidos: PartidoPuntuable[]): Map<number, PartidoPuntuable[]> {
  const porJornada = new Map<number, PartidoPuntuable[]>();
  for (const partido of partidos) {
    const lista = porJornada.get(partido.jornada) ?? [];
    lista.push(partido);
    porJornada.set(partido.jornada, lista);
  }
  return porJornada;
}

type ResultadoCarton = {
  pts: number;
  exactos: number;
  signos: number;
  perfecta: boolean;
  jugada: boolean;
  partidos: PartidoDetalle[];
};

// Puntúa el cartón de un miembro contra los partidos de una jornada.
function evaluarCarton(
  partidosJornada: PartidoPuntuable[],
  predicciones: Map<string, Marcador>,
): ResultadoCarton {
  let pts = 0;
  let exactos = 0;
  let signos = 0;
  let jugada = false;
  let todosExactos = partidosJornada.length > 0;
  const partidos: PartidoDetalle[] = [];

  for (const partido of partidosJornada) {
    const prediccion = predicciones.get(partido.id) ?? null;
    const real =
      partido.finalizado && partido.golesLocal !== null && partido.golesVisitante !== null
        ? { golesLocal: partido.golesLocal, golesVisitante: partido.golesVisitante }
        : null;

    let puntos: PuntosPartido | null = null;
    if (real) {
      jugada = true;
      puntos = prediccion ? puntosPartido(prediccion, real) : 0;
      pts += puntos;
      if (puntos === PUNTOS_EXACTO) exactos += 1;
      if (puntos === PUNTOS_SIGNO) signos += 1;
    }

    if (puntos !== PUNTOS_EXACTO) todosExactos = false;
    partidos.push({ partidoId: partido.id, prediccion, real, puntos });
  }

  // Todos los partidos finalizados y todos exactos (un partido pendiente
  // deja `puntos` en null, así que nunca alcanza el bonus).
  const perfecta = todosExactos;
  if (perfecta) pts += BONUS_JORNADA_PERFECTA;

  return { pts, exactos, signos, perfecta, jugada, partidos };
}

type PrediccionesPorMiembro = Map<
  string,
  Map<number, { cartonId: string; predicciones: Map<string, Marcador> }>
>;

function indexarPronosticos(pronosticos: PronosticoGrupo[]): PrediccionesPorMiembro {
  const indice: PrediccionesPorMiembro = new Map();
  for (const pronostico of pronosticos) {
    const porJornada = indice.get(pronostico.usuarioId) ?? new Map();
    const carton = porJornada.get(pronostico.jornada) ?? {
      cartonId: pronostico.cartonId,
      predicciones: new Map<string, Marcador>(),
    };
    carton.predicciones.set(pronostico.partidoId, {
      golesLocal: pronostico.golesLocal,
      golesVisitante: pronostico.golesVisitante,
    });
    porJornada.set(pronostico.jornada, carton);
    indice.set(pronostico.usuarioId, porJornada);
  }
  return indice;
}

function compararNombre(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

export function calcularTablaGrupo(
  miembros: MiembroGrupo[],
  pronosticos: PronosticoGrupo[],
  partidos: PartidoPuntuable[],
): FilaGrupo[] {
  const partidosPorJornada = agruparPorJornada(partidos);
  const indice = indexarPronosticos(pronosticos);

  const filas: FilaGrupo[] = miembros.map((miembro) => {
    const fila: FilaGrupo = {
      usuarioId: miembro.usuarioId,
      nombre: miembro.nombre,
      pos: null,
      pts: 0,
      exactos: 0,
      signos: 0,
      perfectas: 0,
      jornadasJugadas: 0,
      activo: miembro.activo,
      esCreador: miembro.esCreador,
    };

    for (const [jornada, carton] of indice.get(miembro.usuarioId) ?? []) {
      const resultado = evaluarCarton(partidosPorJornada.get(jornada) ?? [], carton.predicciones);
      if (!resultado.jugada) continue;
      fila.pts += resultado.pts;
      fila.exactos += resultado.exactos;
      fila.signos += resultado.signos;
      fila.jornadasJugadas += 1;
      if (resultado.perfecta) fila.perfectas += 1;
    }

    return fila;
  });

  const activos = filas
    .filter((f) => f.activo)
    .sort(
      (a, b) =>
        b.pts - a.pts ||
        b.exactos - a.exactos ||
        b.perfectas - a.perfectas ||
        compararNombre(a.nombre, b.nombre),
    );
  activos.forEach((fila, i) => {
    fila.pos = i + 1;
  });

  const inactivos = filas
    .filter((f) => !f.activo)
    .sort((a, b) => compararNombre(a.nombre, b.nombre));

  return [...activos, ...inactivos];
}

export function calcularDetalleJornada(
  jornada: number,
  miembros: MiembroGrupo[],
  pronosticos: PronosticoGrupo[],
  partidos: PartidoPuntuable[],
  ahora: number = Date.now(),
): DetalleJornada {
  const partidosJornada = partidos.filter((p) => p.jornada === jornada);
  const cierre = horaCierreJornada(partidosJornada);
  const cerrada = cierre !== null && cierre <= ahora;
  const completa = partidosJornada.length > 0 && partidosJornada.every((p) => p.finalizado);
  const indice = indexarPronosticos(pronosticos);

  const filas: FilaDetalle[] = miembros.map((miembro) => {
    const base = {
      usuarioId: miembro.usuarioId,
      nombre: miembro.nombre,
      activo: miembro.activo,
      cartonId: null,
      pts: 0,
      exactos: 0,
      signos: 0,
      perfecta: false,
      partidos: [],
    };

    const carton = indice.get(miembro.usuarioId)?.get(jornada);
    if (!carton) {
      const previo = cierre !== null && cierre < new Date(miembro.unidoEn).getTime();
      return { ...base, estado: previo ? "previo_ingreso" : "sin_carton" } satisfies FilaDetalle;
    }

    const resultado = evaluarCarton(partidosJornada, carton.predicciones);
    return {
      ...base,
      estado: "puntuado",
      cartonId: carton.cartonId,
      pts: resultado.pts,
      exactos: resultado.exactos,
      signos: resultado.signos,
      perfecta: resultado.perfecta,
      partidos: resultado.partidos,
    } satisfies FilaDetalle;
  });

  const orden = (f: FilaDetalle) => (f.activo ? 0 : 1);
  filas.sort(
    (a, b) =>
      orden(a) - orden(b) ||
      b.pts - a.pts ||
      b.exactos - a.exactos ||
      compararNombre(a.nombre, b.nombre),
  );

  return { jornada, cerrada, completa, filas };
}
