import { readSheet } from "read-excel-file/browser";
import { MAX_FILAS_CARGA_MASIVA } from "@/lib/fixture";
import type { FilaFixtureCruda } from "@/lib/fixture-batch";

export const MAX_TAMANO_ARCHIVO_BYTES = 5 * 1024 * 1024;

export type ResultadoParseoExcel = { ok: true; filas: FilaFixtureCruda[] } | { ok: false; error: string };

const ALIAS_COLUMNAS = {
  jornada: ["jornada"],
  equipoLocal: ["equipo local", "equipolocal", "local"],
  equipoVisitante: ["equipo visitante", "equipovisitante", "visitante"],
};

// Cuántas filas iniciales se revisan buscando el encabezado, para tolerar un
// título o filas en blanco antes de la fila real de columnas (caso común al
// exportar/armar el Excel a mano).
const LIMITE_BUSQUEDA_HEADER = 20;

type HeaderEncontrado = {
  indiceFila: number;
  indiceJornada: number;
  indiceLocal: number;
  indiceVisitante: number;
};

function normalizarHeader(valor: unknown): string {
  return String(valor ?? "").trim().toLowerCase();
}

function encontrarFilaHeader(filasCrudas: unknown[][]): HeaderEncontrado | null {
  const limite = Math.min(filasCrudas.length, LIMITE_BUSQUEDA_HEADER);
  for (let i = 0; i < limite; i++) {
    const headers = filasCrudas[i].map(normalizarHeader);
    const indiceJornada = headers.findIndex((h) => ALIAS_COLUMNAS.jornada.includes(h));
    const indiceLocal = headers.findIndex((h) => ALIAS_COLUMNAS.equipoLocal.includes(h));
    const indiceVisitante = headers.findIndex((h) => ALIAS_COLUMNAS.equipoVisitante.includes(h));
    if (indiceJornada !== -1 && indiceLocal !== -1 && indiceVisitante !== -1) {
      return { indiceFila: i, indiceJornada, indiceLocal, indiceVisitante };
    }
  }
  return null;
}

function celda(valor: unknown): string {
  if (valor === undefined || valor === null) return "";
  if (valor instanceof Date) return valor.toISOString();
  return String(valor).trim();
}

// Parser mínimo de CSV (RFC4180: comas, campos entre comillas dobles con
// comillas escapadas como "") — alcanza para el formato simple de 3 columnas
// de esta feature, sin necesidad de sumar otra dependencia solo para CSV.
function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let dentroDeComillas = false;
  const normalizado = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalizado.length; i++) {
    const c = normalizado[i];
    if (dentroDeComillas) {
      if (c === '"') {
        if (normalizado[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroDeComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      dentroDeComillas = true;
    } else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas.filter((f) => !(f.length === 1 && f[0].trim() === ""));
}

export async function parsearFixtureExcel(archivo: File): Promise<ResultadoParseoExcel> {
  if (archivo.size > MAX_TAMANO_ARCHIVO_BYTES) {
    return { ok: false, error: "El archivo supera el tamaño máximo permitido (5 MB)." };
  }

  const nombre = archivo.name.toLowerCase();
  let filasCrudas: unknown[][];

  if (nombre.endsWith(".csv")) {
    filasCrudas = parsearCsv(await archivo.text());
  } else if (nombre.endsWith(".xlsx")) {
    try {
      filasCrudas = await readSheet(archivo);
    } catch {
      return { ok: false, error: "No pudimos leer el archivo. Verificá que sea un .xlsx válido." };
    }
  } else {
    return { ok: false, error: "Formato no soportado. Subí un archivo .xlsx o .csv." };
  }

  if (filasCrudas.length === 0) {
    return { ok: false, error: "El archivo no tiene filas." };
  }

  const header = encontrarFilaHeader(filasCrudas);
  if (!header) {
    return {
      ok: false,
      error: `No encontramos una fila de encabezados con las columnas "Jornada", "Equipo Local" y "Equipo Visitante" entre las primeras ${LIMITE_BUSQUEDA_HEADER} filas del archivo.`,
    };
  }

  const filas: FilaFixtureCruda[] = [];
  for (let i = header.indiceFila + 1; i < filasCrudas.length; i++) {
    const fila = filasCrudas[i];
    const jornada = celda(fila[header.indiceJornada]);
    const equipoLocal = celda(fila[header.indiceLocal]);
    const equipoVisitante = celda(fila[header.indiceVisitante]);
    if (!jornada && !equipoLocal && !equipoVisitante) continue; // fila en blanco: se ignora en silencio
    filas.push({ fila: i + 1, jornada, equipoLocal, equipoVisitante });
  }

  if (filas.length === 0) {
    return { ok: false, error: "El archivo no tiene filas de datos." };
  }
  if (filas.length > MAX_FILAS_CARGA_MASIVA) {
    return {
      ok: false,
      error: `El archivo tiene ${filas.length} filas de datos; el máximo soportado es ${MAX_FILAS_CARGA_MASIVA}.`,
    };
  }

  return { ok: true, filas };
}
