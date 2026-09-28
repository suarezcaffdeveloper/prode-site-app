import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Cliente mínimo de la API de Mercado Pago para leer los movimientos de la
// cuenta dedicada al prode (SPEC 12). Solo lectura; sin dependencias nuevas.
//
// IMPORTANTE (spike de SPEC 12, paso 0): la forma exacta en que Mercado Pago
// informa el remitente de una transferencia recibida por alias/CVU (nombre,
// documento) no está confirmada en la documentación. `normalizarPago` prueba
// varias ubicaciones conocidas y guarda el payload completo en `raw` para
// poder ajustar el mapeo con datos reales sin volver a consultar la API.

const API = "https://api.mercadopago.com";

export type MovimientoNormalizado = {
  mp_id: string;
  direccion: "ingreso" | "egreso";
  tipo: string | null;
  estado_mp: string;
  monto: number;
  moneda: string;
  fecha_acreditacion: string;
  pagador_nombre: string | null;
  pagador_documento: string | null;
  numero_operacion: string | null;
  alerta: "devuelto" | "contracargo" | null;
  raw: unknown;
};

type Objeto = Record<string, unknown>;

function objeto(valor: unknown): Objeto {
  return typeof valor === "object" && valor !== null ? (valor as Objeto) : {};
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string" && valor.trim() !== "") return valor.trim();
  if (typeof valor === "number") return String(valor);
  return null;
}

function tokenMp(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Falta configurar MP_ACCESS_TOKEN.");
  return token;
}

async function pedir(ruta: string): Promise<unknown> {
  const respuesta = await fetch(`${API}${ruta}`, {
    headers: { Authorization: `Bearer ${tokenMp()}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!respuesta.ok) {
    throw new Error(`Mercado Pago respondió ${respuesta.status} en ${ruta.split("?")[0]}.`);
  }
  return respuesta.json();
}

export function normalizarPago(pago: unknown): MovimientoNormalizado | null {
  const datos = objeto(pago);
  const id = texto(datos.id);
  const monto = typeof datos.transaction_amount === "number" ? datos.transaction_amount : null;
  const fecha = texto(datos.date_approved) ?? texto(datos.date_created);
  if (!id || monto === null || monto <= 0 || !fecha || Number.isNaN(Date.parse(fecha))) {
    return null;
  }

  const payer = objeto(datos.payer);
  const infoAdicional = objeto(objeto(datos.additional_info).payer);
  const bancoPagador = objeto(
    objeto(objeto(objeto(datos.point_of_interaction).transaction_data).bank_info).payer,
  );

  const nombrePayer = [texto(payer.first_name), texto(payer.last_name)].filter(Boolean).join(" ");
  const nombreAdicional = [texto(infoAdicional.first_name), texto(infoAdicional.last_name)]
    .filter(Boolean)
    .join(" ");
  const nombre =
    texto(bancoPagador.long_name) ??
    (nombrePayer || null) ??
    (nombreAdicional || null) ??
    texto(objeto(objeto(datos.card).cardholder).name);

  const documento =
    texto(objeto(payer.identification).number) ??
    texto(objeto(objeto(objeto(datos.card).cardholder).identification).number);

  // Si tenemos el id de usuario de la cuenta cobradora, un pago cuyo cobrador
  // es otro es un egreso (la cuenta es la que pagó).
  const cuentaId = process.env.MP_USER_ID;
  const cobrador = texto(datos.collector_id);
  const direccion: "ingreso" | "egreso" =
    cuentaId && cobrador && cobrador !== cuentaId ? "egreso" : "ingreso";

  const estado = texto(datos.status) ?? "unknown";

  return {
    mp_id: id,
    direccion,
    tipo: texto(datos.payment_type_id) ?? texto(datos.operation_type),
    estado_mp: estado,
    monto,
    moneda: texto(datos.currency_id) ?? "ARS",
    fecha_acreditacion: new Date(fecha).toISOString(),
    pagador_nombre: nombre,
    pagador_documento: documento,
    // El número de operación de un pago de Mercado Pago es su id.
    numero_operacion: id,
    alerta: estado === "refunded" ? "devuelto" : estado === "charged_back" ? "contracargo" : null,
    raw: pago,
  };
}

export async function obtenerPago(id: string): Promise<MovimientoNormalizado | null> {
  try {
    return normalizarPago(await pedir(`/v1/payments/${encodeURIComponent(id)}`));
  } catch (error) {
    // Un id inexistente (por ejemplo el aviso de prueba del panel de MP) no es
    // un error a reintentar.
    if (error instanceof Error && error.message.includes("respondió 404")) return null;
    throw error;
  }
}

// Pagos recientes de la cuenta. Sirve como red de seguridad cuando el webhook
// no llegó (o llegó después que el comprobante).
export async function buscarPagosRecientes(desde: Date): Promise<MovimientoNormalizado[]> {
  const params = new URLSearchParams({
    sort: "date_created",
    criteria: "desc",
    range: "date_created",
    begin_date: desde.toISOString(),
    end_date: new Date().toISOString(),
    limit: "100",
  });

  const respuesta = objeto(await pedir(`/v1/payments/search?${params.toString()}`));
  const resultados = Array.isArray(respuesta.results) ? respuesta.results : [];

  return resultados
    .map((pago) => normalizarPago(pago))
    .filter((movimiento): movimiento is MovimientoNormalizado => movimiento !== null);
}

// Valida el header x-signature del webhook (HMAC-SHA256 del "manifest" con el
// secreto de la aplicación). https://www.mercadopago.com.ar/developers
export function validarFirmaWebhook(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto || !params.xSignature) return false;

  let ts: string | null = null;
  let v1: string | null = null;
  for (const parte of params.xSignature.split(",")) {
    const [clave, valor] = parte.split("=").map((s) => s.trim());
    if (clave === "ts") ts = valor ?? null;
    if (clave === "v1") v1 = valor ?? null;
  }
  if (!ts || !v1) return false;

  const id = params.dataId && /^[a-z0-9]+$/i.test(params.dataId)
    ? params.dataId.toLowerCase()
    : params.dataId;

  let manifest = "";
  if (id) manifest += `id:${id};`;
  if (params.xRequestId) manifest += `request-id:${params.xRequestId};`;
  manifest += `ts:${ts};`;

  const esperado = createHmac("sha256", secreto).update(manifest).digest("hex");

  const bufferEsperado = Buffer.from(esperado, "hex");
  const bufferRecibido = Buffer.from(v1, "hex");
  return (
    bufferEsperado.length === bufferRecibido.length &&
    timingSafeEqual(bufferEsperado, bufferRecibido)
  );
}
