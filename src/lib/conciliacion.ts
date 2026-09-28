// Reglas determinísticas que deciden si un comprobante + un movimiento de la
// cuenta de Mercado Pago justifican acreditar los prodes (SPEC 12). Es una
// función pura, sin acceso a red ni a la base: la IA solo aporta la extracción
// del comprobante y jamás decide si se aprueba.

// --- Umbrales y tolerancias ---------------------------------------------------
export const UMBRAL_CONFIANZA = 0.8;
export const TOLERANCIA_FECHA_CON_HORA_MIN = 15;
export const TOLERANCIA_INICIO_SOLICITUD_MIN = 5;
export const SIMILITUD_MINIMA_NOMBRE = 0.8;
export const TOLERANCIA_MONTO = 0.005;
// Argentina no aplica horario de verano: el offset es fijo.
const OFFSET_ARGENTINA = "-03:00";

// --- Tipos --------------------------------------------------------------------
export type ExtraccionComprobante = {
  es_comprobante: boolean;
  legible: boolean;
  monto: number | null;
  moneda: string | null;
  fecha: string | null; // YYYY-MM-DD, hora local de Argentina
  hora: string | null; // HH:mm, hora local de Argentina
  remitente_nombre: string | null;
  remitente_documento: string | null;
  destinatario_nombre: string | null;
  destinatario_alias: string | null;
  destinatario_cbu: string | null;
  numero_operacion: string | null;
  banco_o_billetera: string | null;
  senales_sospechosas: string[];
  confianza: number;
};

export type SolicitudParaConciliar = {
  monto_a_transferir: number;
  created_at: string;
  expira_en: string;
};

export type MovimientoParaConciliar = {
  monto: number;
  direccion: "ingreso" | "egreso";
  estado_mp: string;
  fecha_acreditacion: string;
  pagador_nombre: string | null;
  pagador_documento: string | null;
  numero_operacion: string | null;
  consumido: boolean;
};

export type CuentaDestino = { alias: string; cbu: string; titular: string };

export type OpcionesConciliacion = {
  cuenta: CuentaDestino;
  exigirRemitente: boolean;
  duplicado: boolean; // hash de imagen o n.º de operación ya usados en otra solicitud
};

export type CodigoRegla = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8" | "R9";

export type ResultadoRegla = {
  codigo: CodigoRegla;
  nombre: string;
  ok: boolean;
  detalle: string;
  // La regla no pudo evaluarse todavía porque falta el movimiento en la cuenta.
  espera?: boolean;
};

export type ResultadoConciliacion = {
  aprobar: boolean;
  reglas: ResultadoRegla[];
  motivos: string[];
  // Todo lo que no depende del movimiento pasó: solo falta que la plata figure
  // en la cuenta (puede tardar unos minutos).
  esperandoMovimiento: boolean;
};

// --- Utilidades ---------------------------------------------------------------
export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function tokens(valor: string): string[] {
  return normalizarTexto(valor)
    .split(" ")
    .filter((token) => token.length > 0);
}

// Un token "coincide" si es igual o si uno es una inicial/abreviatura del otro
// ("J" ~ "Juan"). Los nombres de MP y de los bancos no siempre vienen completos
// ni en el mismo orden, así que se compara por conjunto de tokens.
function tokensCoinciden(a: string, b: string): boolean {
  if (a === b) return true;
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  return corto.length <= 2 && largo.startsWith(corto);
}

export function similitudNombres(a: string, b: string): number {
  const tokensA = tokens(a);
  const tokensB = tokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const [menor, mayor] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  const disponibles = [...mayor];
  let coincidencias = 0;

  for (const token of menor) {
    const indice = disponibles.findIndex((candidato) => tokensCoinciden(token, candidato));
    if (indice >= 0) {
      coincidencias += 1;
      disponibles.splice(indice, 1);
    }
  }

  return coincidencias / menor.length;
}

// Los documentos suelen venir enmascarados ("20-****123-4" o "***456"): se
// comparan los dígitos que ambos lados muestran, alineados por el final.
function documentosCompatibles(a: string, b: string): boolean {
  const digitosA = soloDigitos(a);
  const digitosB = soloDigitos(b);
  const largo = Math.min(digitosA.length, digitosB.length);
  if (largo < 3) return true; // no hay dígitos suficientes para contradecir
  return digitosA.slice(-largo) === digitosB.slice(-largo);
}

export function fechaDeExtraccion(extraccion: ExtraccionComprobante): {
  fecha: Date;
  tieneHora: boolean;
} | null {
  if (!extraccion.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(extraccion.fecha)) return null;

  const tieneHora = !!extraccion.hora && /^\d{2}:\d{2}$/.test(extraccion.hora);
  const fecha = new Date(
    `${extraccion.fecha}T${tieneHora ? extraccion.hora : "00:00"}:00${OFFSET_ARGENTINA}`,
  );
  if (Number.isNaN(fecha.getTime())) return null;

  return { fecha, tieneHora };
}

// YYYY-MM-DD en hora de Argentina de una fecha absoluta.
function diaEnArgentina(fecha: Date): string {
  return new Date(fecha.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function montosIguales(a: number, b: number): boolean {
  return Math.abs(a - b) < TOLERANCIA_MONTO;
}

function normalizarAlias(valor: string): string {
  return valor.toLowerCase().replace(/[^a-z0-9.]/g, "");
}

// --- Reglas -------------------------------------------------------------------
export function conciliar(
  solicitud: SolicitudParaConciliar,
  extraccion: ExtraccionComprobante,
  movimiento: MovimientoParaConciliar | null,
  opciones: OpcionesConciliacion,
): ResultadoConciliacion {
  const reglas: ResultadoRegla[] = [];

  // R1 — Es un comprobante legible y confiable.
  const r1Ok =
    extraccion.es_comprobante &&
    extraccion.legible &&
    extraccion.confianza >= UMBRAL_CONFIANZA &&
    extraccion.senales_sospechosas.length === 0;
  reglas.push({
    codigo: "R1",
    nombre: "Es un comprobante legible",
    ok: r1Ok,
    detalle: !extraccion.es_comprobante
      ? "La imagen no parece un comprobante de transferencia."
      : !extraccion.legible
        ? "El comprobante no se lee con claridad."
        : extraccion.confianza < UMBRAL_CONFIANZA
          ? `Confianza de lectura baja (${extraccion.confianza.toFixed(2)}).`
          : extraccion.senales_sospechosas.length > 0
            ? `Señales sospechosas: ${extraccion.senales_sospechosas.join("; ")}.`
            : "Comprobante legible.",
  });

  // R2 — El monto del comprobante es el de la solicitud, al centavo.
  const r2Ok =
    extraccion.monto !== null && montosIguales(extraccion.monto, solicitud.monto_a_transferir);
  reglas.push({
    codigo: "R2",
    nombre: "Monto del comprobante",
    ok: r2Ok,
    detalle:
      extraccion.monto === null
        ? "El comprobante no muestra un monto."
        : r2Ok
          ? `Coincide con el monto pedido (${solicitud.monto_a_transferir.toFixed(2)}).`
          : `El comprobante dice ${extraccion.monto.toFixed(2)} y se pidió ${solicitud.monto_a_transferir.toFixed(2)}.`,
  });

  // R6 — El destinatario es la cuenta del prode.
  const { cuenta } = opciones;
  const aliasOk =
    !!extraccion.destinatario_alias &&
    normalizarAlias(extraccion.destinatario_alias) === normalizarAlias(cuenta.alias);
  // El CBU puede venir completo o solo con los últimos dígitos visibles.
  const digitosCbu = extraccion.destinatario_cbu ? soloDigitos(extraccion.destinatario_cbu) : "";
  const cbuOk = digitosCbu.length >= 6 && soloDigitos(cuenta.cbu).endsWith(digitosCbu);
  const titularOk =
    !!extraccion.destinatario_nombre &&
    similitudNombres(extraccion.destinatario_nombre, cuenta.titular) >= SIMILITUD_MINIMA_NOMBRE;
  const r6Ok = aliasOk || cbuOk || titularOk;
  reglas.push({
    codigo: "R6",
    nombre: "Destinatario",
    ok: r6Ok,
    detalle: r6Ok
      ? "El destinatario es la cuenta del prode."
      : "El destinatario del comprobante no coincide con la cuenta del prode.",
  });

  // R8 — No es un comprobante ya usado.
  reglas.push({
    codigo: "R8",
    nombre: "Comprobante no duplicado",
    ok: !opciones.duplicado,
    detalle: opciones.duplicado
      ? "La imagen o el número de operación ya se usaron en otra solicitud."
      : "No se usó antes.",
  });

  // Reglas que dependen del movimiento en la cuenta de Mercado Pago.
  const sinMovimiento = movimiento === null;
  const esperaDetalle = "Todavía no figura el movimiento en la cuenta de Mercado Pago.";

  // R3 — Ingreso real, acreditado, con el monto exacto y sin consumir.
  const movimientoValido =
    movimiento !== null &&
    movimiento.direccion === "ingreso" &&
    movimiento.estado_mp === "approved" &&
    !movimiento.consumido &&
    montosIguales(movimiento.monto, solicitud.monto_a_transferir);
  reglas.push({
    codigo: "R3",
    nombre: "Ingreso en la cuenta",
    ok: movimientoValido,
    espera: sinMovimiento,
    detalle: sinMovimiento
      ? esperaDetalle
      : movimientoValido
        ? "Hay un ingreso acreditado con ese monto exacto."
        : "El movimiento encontrado no es un ingreso acreditado, disponible y con el monto pedido.",
  });

  // R4 — La fecha del comprobante coincide con la acreditación.
  const fechaComprobante = fechaDeExtraccion(extraccion);
  let r4Ok = false;
  let r4Detalle = esperaDetalle;
  if (movimiento) {
    const acreditacion = new Date(movimiento.fecha_acreditacion);
    if (!fechaComprobante) {
      r4Detalle = "El comprobante no muestra una fecha legible.";
    } else if (
      acreditacion.getTime() <
      new Date(solicitud.created_at).getTime() - TOLERANCIA_INICIO_SOLICITUD_MIN * 60_000
    ) {
      r4Detalle = "El ingreso es anterior a la creación de la solicitud.";
    } else if (fechaComprobante.tieneHora) {
      const diferenciaMin =
        Math.abs(fechaComprobante.fecha.getTime() - acreditacion.getTime()) / 60_000;
      r4Ok = diferenciaMin <= TOLERANCIA_FECHA_CON_HORA_MIN;
      r4Detalle = r4Ok
        ? "La fecha y hora del comprobante coinciden con la acreditación."
        : `El comprobante y la acreditación difieren en ${Math.round(diferenciaMin)} minutos.`;
    } else {
      r4Ok = diaEnArgentina(fechaComprobante.fecha) === diaEnArgentina(acreditacion);
      r4Detalle = r4Ok
        ? "El día del comprobante coincide con la acreditación."
        : "El día del comprobante no coincide con la acreditación.";
    }
  }
  reglas.push({
    codigo: "R4",
    nombre: "Fecha",
    ok: r4Ok,
    espera: sinMovimiento,
    detalle: r4Detalle,
  });

  // R5 — El remitente del comprobante es el pagador en Mercado Pago.
  let r5Ok = false;
  let r5Detalle = esperaDetalle;
  if (movimiento) {
    const nombreMp = movimiento.pagador_nombre?.trim() || null;
    const nombreComprobante = extraccion.remitente_nombre?.trim() || null;

    if (!nombreMp && !movimiento.pagador_documento) {
      r5Ok = !opciones.exigirRemitente;
      r5Detalle = r5Ok
        ? "Omitida: Mercado Pago no informa el remitente de esta transferencia."
        : "Mercado Pago no informa el remitente de esta transferencia.";
    } else if (!nombreComprobante && !extraccion.remitente_documento) {
      r5Detalle = "El comprobante no muestra el remitente.";
    } else {
      const nombreOk =
        nombreMp && nombreComprobante
          ? similitudNombres(nombreMp, nombreComprobante) >= SIMILITUD_MINIMA_NOMBRE
          : true;
      const documentoOk =
        movimiento.pagador_documento && extraccion.remitente_documento
          ? documentosCompatibles(movimiento.pagador_documento, extraccion.remitente_documento)
          : true;
      r5Ok = nombreOk && documentoOk;
      r5Detalle = r5Ok
        ? "El remitente coincide con el pagador en Mercado Pago."
        : !nombreOk
          ? `El remitente (${nombreComprobante}) no coincide con el pagador (${nombreMp}).`
          : "El documento del remitente no coincide con el del pagador.";
    }
  }
  reglas.push({
    codigo: "R5",
    nombre: "Remitente",
    ok: r5Ok,
    espera: sinMovimiento,
    detalle: r5Detalle,
  });

  // R7 — Número de operación (si ambos lo tienen deben coincidir).
  let r7Ok = false;
  let r7Detalle = esperaDetalle;
  if (movimiento) {
    const operacionComprobante = extraccion.numero_operacion
      ? soloDigitos(extraccion.numero_operacion)
      : "";
    const operacionMp = movimiento.numero_operacion ? soloDigitos(movimiento.numero_operacion) : "";
    if (operacionComprobante && operacionMp) {
      const coincide = operacionComprobante === operacionMp;
      // El número de operación de Mercado Pago es el id de su pago. Un
      // comprobante emitido por otro banco muestra el id de ese banco, que no
      // tiene por qué coincidir: solo se exige cuando el comprobante es de MP.
      const emitidoPorMp = normalizarTexto(extraccion.banco_o_billetera ?? "").includes(
        "mercado pago",
      );
      r7Ok = coincide || !emitidoPorMp;
      r7Detalle = coincide
        ? "El número de operación coincide."
        : emitidoPorMp
          ? "El número de operación del comprobante no coincide con el de Mercado Pago."
          : "El número de operación es el del banco emisor y no se puede contrastar: no penaliza.";
    } else {
      r7Ok = true;
      r7Detalle = "Sin número de operación en alguna de las dos partes: no penaliza.";
    }
  }
  reglas.push({
    codigo: "R7",
    nombre: "Número de operación",
    ok: r7Ok,
    espera: sinMovimiento,
    detalle: r7Detalle,
  });

  // R9 — La acreditación ocurrió mientras la solicitud estaba vigente.
  let r9Ok = false;
  let r9Detalle = esperaDetalle;
  if (movimiento) {
    const acreditacion = new Date(movimiento.fecha_acreditacion);
    r9Ok = acreditacion.getTime() <= new Date(solicitud.expira_en).getTime();
    r9Detalle = r9Ok
      ? "La acreditación ocurrió dentro de la vigencia de la solicitud."
      : "La acreditación ocurrió después de que venciera la solicitud.";
  }
  reglas.push({
    codigo: "R9",
    nombre: "Vigencia",
    ok: r9Ok,
    espera: sinMovimiento,
    detalle: r9Detalle,
  });

  reglas.sort((a, b) => a.codigo.localeCompare(b.codigo));

  const fallidas = reglas.filter((regla) => !regla.ok);

  return {
    aprobar: fallidas.length === 0,
    reglas,
    motivos: fallidas.map((regla) => `${regla.codigo}: ${regla.detalle}`),
    esperandoMovimiento: sinMovimiento && fallidas.every((regla) => regla.espera === true),
  };
}
