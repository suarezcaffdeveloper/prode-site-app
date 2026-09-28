import { calcularTotalJornadas } from "@/lib/fixture";

export type EquipoBatch = { id: string; nombre: string };

export type PartidoExistenteBatch = {
  jornada: number;
  equipoLocalId: string;
  equipoVisitanteId: string;
};

export type FilaFixtureCruda = {
  fila: number;
  jornada: string;
  equipoLocal: string;
  equipoVisitante: string;
};

export type FilaFixtureResuelta = {
  fila: number;
  jornada: number;
  equipoLocalId: string;
  equipoVisitanteId: string;
};

export type ErrorFilaFixture = { fila: number; mensaje: string };

function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

function claveCruce(idA: string, idB: string): string {
  return [idA, idB].sort().join("|");
}

// Valida un lote completo de filas de fixture en un solo recorrido en memoria,
// sin queries a la DB: recibe los equipos y partidos ya cargados de la liga
// (traídos una sola vez por el caller) y detecta tanto conflictos contra esos
// datos existentes como conflictos entre filas del propio archivo, acumulando
// estado a medida que procesa las filas en orden. Misma regla de negocio que
// `validarEquipoNoRepiteEnJornada`/`validarCruceNoRepetido` en
// admin/ligas/[id]/partidos/actions.ts (spec 03) — no se comparte código
// porque esas funciones consultan la DB por partido y acá se necesita un
// único fetch más un loop en memoria (ver spec 07, Decisions).
export function validarLoteFixture(
  filas: FilaFixtureCruda[],
  equipos: EquipoBatch[],
  partidosExistentes: PartidoExistenteBatch[],
): { erroresPorFila: ErrorFilaFixture[]; filasResueltas: FilaFixtureResuelta[] } {
  const totalJornadas = calcularTotalJornadas(equipos.length);

  const equiposPorNombre = new Map<string, { id: string; nombre: string }>();
  for (const equipo of equipos) {
    equiposPorNombre.set(normalizarNombre(equipo.nombre), { id: equipo.id, nombre: equipo.nombre });
  }

  type Origen = { tipo: "db"; jornada: number } | { tipo: "archivo"; fila: number };

  const ocupacionPorJornada = new Map<number, Map<string, Origen>>();
  const cruces = new Map<string, Origen>();

  function ocupar(jornada: number, equipoId: string, origen: Origen) {
    const ocupados = ocupacionPorJornada.get(jornada) ?? new Map<string, Origen>();
    ocupados.set(equipoId, origen);
    ocupacionPorJornada.set(jornada, ocupados);
  }

  function describirOrigen(origen: Origen): string {
    return origen.tipo === "db"
      ? `ya está cargado en la jornada ${origen.jornada}`
      : `aparece en la fila ${origen.fila} de este archivo`;
  }

  for (const partido of partidosExistentes) {
    const origen: Origen = { tipo: "db", jornada: partido.jornada };
    ocupar(partido.jornada, partido.equipoLocalId, origen);
    ocupar(partido.jornada, partido.equipoVisitanteId, origen);
    cruces.set(claveCruce(partido.equipoLocalId, partido.equipoVisitanteId), origen);
  }

  const erroresPorFila: ErrorFilaFixture[] = [];
  const filasResueltas: FilaFixtureResuelta[] = [];

  for (const fila of filas) {
    const jornadaRaw = fila.jornada.trim();
    const equipoLocalRaw = fila.equipoLocal.trim();
    const equipoVisitanteRaw = fila.equipoVisitante.trim();

    if (!jornadaRaw || !equipoLocalRaw || !equipoVisitanteRaw) {
      erroresPorFila.push({
        fila: fila.fila,
        mensaje: "Faltan datos en la fila: se necesita jornada, equipo local y equipo visitante.",
      });
      continue;
    }

    const jornada = Number(jornadaRaw);
    if (!Number.isInteger(jornada) || jornada < 1) {
      erroresPorFila.push({
        fila: fila.fila,
        mensaje: `La jornada "${jornadaRaw}" debe ser un número entero mayor o igual a 1.`,
      });
      continue;
    }

    if (jornada > totalJornadas) {
      erroresPorFila.push({
        fila: fila.fila,
        mensaje:
          totalJornadas === 0
            ? "Todavía no hay equipos suficientes para calcular las jornadas de esta liga."
            : `La liga tiene ${totalJornadas} jornada${totalJornadas === 1 ? "" : "s"} posible${
                totalJornadas === 1 ? "" : "s"
              } como máximo, y esta fila declara la jornada ${jornada}.`,
      });
      continue;
    }

    if (normalizarNombre(equipoLocalRaw) === normalizarNombre(equipoVisitanteRaw)) {
      erroresPorFila.push({
        fila: fila.fila,
        mensaje: "El equipo local y el visitante no pueden ser el mismo.",
      });
      continue;
    }

    const equipoLocal = equiposPorNombre.get(normalizarNombre(equipoLocalRaw));
    if (!equipoLocal) {
      erroresPorFila.push({
        fila: fila.fila,
        mensaje: `No encontramos el equipo "${equipoLocalRaw}" en esta liga.`,
      });
      continue;
    }

    const equipoVisitante = equiposPorNombre.get(normalizarNombre(equipoVisitanteRaw));
    if (!equipoVisitante) {
      erroresPorFila.push({
        fila: fila.fila,
        mensaje: `No encontramos el equipo "${equipoVisitanteRaw}" en esta liga.`,
      });
      continue;
    }

    const ocupadosJornada = ocupacionPorJornada.get(jornada);
    const origenLocal = ocupadosJornada?.get(equipoLocal.id);
    if (origenLocal) {
      erroresPorFila.push({
        fila: fila.fila,
        mensaje: `${equipoLocal.nombre} ya tiene un partido cargado en la jornada ${jornada} (${describirOrigen(origenLocal)}).`,
      });
      continue;
    }
    const origenVisitante = ocupadosJornada?.get(equipoVisitante.id);
    if (origenVisitante) {
      erroresPorFila.push({
        fila: fila.fila,
        mensaje: `${equipoVisitante.nombre} ya tiene un partido cargado en la jornada ${jornada} (${describirOrigen(origenVisitante)}).`,
      });
      continue;
    }

    const clave = claveCruce(equipoLocal.id, equipoVisitante.id);
    const origenCruce = cruces.get(clave);
    if (origenCruce) {
      erroresPorFila.push({
        fila: fila.fila,
        mensaje: `${equipoLocal.nombre} ya jugó contra ${equipoVisitante.nombre}: ${describirOrigen(origenCruce)}.`,
      });
      continue;
    }

    const origen: Origen = { tipo: "archivo", fila: fila.fila };
    ocupar(jornada, equipoLocal.id, origen);
    ocupar(jornada, equipoVisitante.id, origen);
    cruces.set(clave, origen);

    filasResueltas.push({
      fila: fila.fila,
      jornada,
      equipoLocalId: equipoLocal.id,
      equipoVisitanteId: equipoVisitante.id,
    });
  }

  return { erroresPorFila, filasResueltas };
}
