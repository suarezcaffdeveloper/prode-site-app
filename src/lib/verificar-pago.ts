import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { detectarImagen } from "@/lib/comprobante-archivo";
import { extraerDatosComprobante } from "@/lib/comprobante-ia";
import {
  conciliar,
  type ExtraccionComprobante,
  type MovimientoParaConciliar,
  type ResultadoConciliacion,
} from "@/lib/conciliacion";
import { buscarPagosRecientes, type MovimientoNormalizado } from "@/lib/mercadopago";
import { exigirRemitente, obtenerDatosCuenta } from "@/lib/pago-config";

// Orquesta la verificación de una solicitud de pago (SPEC 12): lee el
// comprobante con IA (una sola vez, se guarda), busca el movimiento en la
// cuenta de Mercado Pago, aplica las reglas de conciliar() y decide:
// aprobar, seguir esperando el movimiento o derivar a revisión manual.
// Nunca rechaza. Corre con el service role (sin sesión de usuario).

type Admin = ReturnType<typeof createAdminClient>;

// Cuánto se espera a que la plata figure en la cuenta antes de pasar a revisión.
const VENTANA_ESPERA_MOVIMIENTO_MS = 60 * 60 * 1000;
// Cuánto hacia atrás se buscan pagos en Mercado Pago al sincronizar.
const HORAS_SINCRONIZACION = 6;

type SolicitudFila = {
  id: string;
  usuario_id: string;
  estado: string;
  monto_a_transferir: number;
  created_at: string;
  expira_en: string;
  comprobante_path: string | null;
  comprobante_sha256: string | null;
  comprobante_enviado_en: string | null;
  extraccion: ExtraccionComprobante | null;
};

type MovimientoFila = {
  id: string;
  monto: number;
  direccion: "ingreso" | "egreso";
  estado_mp: string;
  fecha_acreditacion: string;
  pagador_nombre: string | null;
  pagador_documento: string | null;
  numero_operacion: string | null;
};

export type EstadoVerificacion =
  | "aprobada"
  | "verificando"
  | "pendiente_admin"
  | "sin_cambios";

async function derivarARevision(
  admin: Admin,
  solicitudId: string,
  motivos: string[],
  extraccion: ExtraccionComprobante | null,
  evaluacion: ResultadoConciliacion | null,
): Promise<EstadoVerificacion> {
  await admin.rpc("marcar_solicitud_en_revision", {
    p_solicitud_id: solicitudId,
    p_motivos: motivos,
    p_extraccion: extraccion,
    p_evaluacion: evaluacion,
  });
  return "pendiente_admin";
}

async function obtenerExtraccion(
  admin: Admin,
  solicitud: SolicitudFila,
): Promise<
  | { ok: true; extraccion: ExtraccionComprobante }
  | { ok: false; motivos: string[] }
> {
  if (solicitud.extraccion) return { ok: true, extraccion: solicitud.extraccion };

  if (!solicitud.comprobante_path) {
    return { ok: false, motivos: ["sin_comprobante"] };
  }

  const { data: archivo, error } = await admin.storage
    .from("comprobantes")
    .download(solicitud.comprobante_path);
  if (error || !archivo) {
    return { ok: false, motivos: ["comprobante_no_disponible"] };
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());
  const imagen = detectarImagen(bytes);
  if (!imagen) {
    return { ok: false, motivos: ["formato_no_soportado"] };
  }

  const resultado = await extraerDatosComprobante(bytes, imagen.mediaType);
  if (!resultado.ok) {
    return { ok: false, motivos: [resultado.motivo, resultado.detalle] };
  }

  // Se guarda apenas se lee: las re-evaluaciones (webhook, cron) no vuelven a
  // llamar al modelo.
  await admin
    .from("solicitudes_pago")
    .update({ extraccion: resultado.extraccion })
    .eq("id", solicitud.id);

  return { ok: true, extraccion: resultado.extraccion };
}

async function buscarMovimientoCandidato(
  admin: Admin,
  montoATransferir: number,
): Promise<MovimientoParaConciliar & { id: string } | null> {
  const { data } = await admin
    .from("movimientos_mp")
    .select(
      "id, monto, direccion, estado_mp, fecha_acreditacion, pagador_nombre, pagador_documento, numero_operacion",
    )
    .eq("direccion", "ingreso")
    .eq("monto", montoATransferir)
    .is("solicitud_id", null)
    .order("fecha_acreditacion", { ascending: false })
    .limit(5)
    .returns<MovimientoFila[]>();

  const candidatos = data ?? [];
  // Si hay varios con el mismo monto exacto, se prefiere uno ya acreditado.
  const elegido = candidatos.find((m) => m.estado_mp === "approved") ?? candidatos[0];
  if (!elegido) return null;

  return { ...elegido, consumido: false };
}

async function esComprobanteDuplicado(
  admin: Admin,
  solicitud: SolicitudFila,
  extraccion: ExtraccionComprobante,
): Promise<boolean> {
  const estadosVigentes = ["verificando", "pendiente_admin", "aprobada"];

  if (solicitud.comprobante_sha256) {
    const { count } = await admin
      .from("solicitudes_pago")
      .select("id", { count: "exact", head: true })
      .neq("id", solicitud.id)
      .in("estado", estadosVigentes)
      .eq("comprobante_sha256", solicitud.comprobante_sha256);
    if ((count ?? 0) > 0) return true;
  }

  // Solo dígitos: el valor sale de la IA y se usa como filtro.
  const operacion = extraccion.numero_operacion?.replace(/\D/g, "") ?? "";
  if (operacion.length >= 6) {
    const { count } = await admin
      .from("solicitudes_pago")
      .select("id", { count: "exact", head: true })
      .neq("id", solicitud.id)
      .in("estado", estadosVigentes)
      .eq("extraccion->>numero_operacion", extraccion.numero_operacion!);
    if ((count ?? 0) > 0) return true;
  }

  return false;
}

export async function verificarSolicitud(
  admin: Admin,
  solicitudId: string,
): Promise<EstadoVerificacion> {
  const { data: solicitud } = await admin
    .from("solicitudes_pago")
    .select(
      "id, usuario_id, estado, monto_a_transferir, created_at, expira_en, comprobante_path, comprobante_sha256, comprobante_enviado_en, extraccion",
    )
    .eq("id", solicitudId)
    .maybeSingle<SolicitudFila>();

  if (!solicitud || solicitud.estado !== "verificando") return "sin_cambios";

  const lectura = await obtenerExtraccion(admin, solicitud);
  if (!lectura.ok) {
    return derivarARevision(admin, solicitud.id, lectura.motivos, null, null);
  }
  const { extraccion } = lectura;

  const cuenta = obtenerDatosCuenta();
  if (!cuenta) {
    return derivarARevision(admin, solicitud.id, ["cuenta_no_configurada"], extraccion, null);
  }

  const movimiento = await buscarMovimientoCandidato(admin, solicitud.monto_a_transferir);
  const duplicado = await esComprobanteDuplicado(admin, solicitud, extraccion);

  const resultado = conciliar(solicitud, extraccion, movimiento, {
    cuenta,
    exigirRemitente: exigirRemitente(),
    duplicado,
  });

  if (resultado.aprobar && movimiento) {
    const { error } = await admin.rpc("aprobar_solicitud_pago", {
      p_solicitud_id: solicitud.id,
      p_movimiento_id: movimiento.id,
    });

    if (!error) {
      await admin
        .from("solicitudes_pago")
        .update({ extraccion, evaluacion: resultado })
        .eq("id", solicitud.id);
      return "aprobada";
    }

    // Otro proceso (webhook + cron a la vez) ya la aprobó: no es un error.
    if (error.message?.includes("solicitud_no_aprobable")) return "sin_cambios";

    return derivarARevision(
      admin,
      solicitud.id,
      ["error_aprobacion", error.message ?? "error desconocido"],
      extraccion,
      resultado,
    );
  }

  const enviadoEn = solicitud.comprobante_enviado_en
    ? new Date(solicitud.comprobante_enviado_en).getTime()
    : Date.now();
  const dentroDeLaVentana = Date.now() - enviadoEn < VENTANA_ESPERA_MOVIMIENTO_MS;

  if (resultado.esperandoMovimiento && dentroDeLaVentana) {
    await admin
      .from("solicitudes_pago")
      .update({ extraccion, evaluacion: resultado })
      .eq("id", solicitud.id);
    return "verificando";
  }

  const motivos = resultado.esperandoMovimiento
    ? ["sin_movimiento_en_cuenta", ...resultado.motivos]
    : resultado.motivos;

  return derivarARevision(admin, solicitud.id, motivos, extraccion, resultado);
}

// Re-evalúa todas las solicitudes que esperan verificación (cron).
export async function verificarPendientes(admin: Admin): Promise<number> {
  const { data } = await admin
    .from("solicitudes_pago")
    .select("id")
    .eq("estado", "verificando")
    .returns<{ id: string }[]>();

  let aprobadas = 0;
  for (const { id } of data ?? []) {
    try {
      if ((await verificarSolicitud(admin, id)) === "aprobada") aprobadas += 1;
    } catch {
      // Una solicitud con problemas no debe frenar a las demás; el próximo
      // ciclo del cron la reintenta.
    }
  }
  return aprobadas;
}

// Guarda un movimiento de la cuenta de MP (idempotente por mp_id). No pisa la
// asociación con una solicitud ni una alerta ya registrada.
export async function guardarMovimiento(
  admin: Admin,
  movimiento: MovimientoNormalizado,
): Promise<{ id: string; solicitud_id: string | null } | null> {
  const { alerta, ...campos } = movimiento;
  const fila: Record<string, unknown> = alerta ? { ...campos, alerta } : campos;

  const { data } = await admin
    .from("movimientos_mp")
    .upsert(fila, { onConflict: "mp_id" })
    .select("id, solicitud_id")
    .single<{ id: string; solicitud_id: string | null }>();

  return data ?? null;
}

// Trae los pagos recientes de la cuenta y los guarda; devuelve los ingresos
// que quedaron libres (sin solicitud) para poder conciliarlos.
export async function sincronizarMovimientos(admin: Admin): Promise<number> {
  const desde = new Date(Date.now() - HORAS_SINCRONIZACION * 60 * 60 * 1000);
  const pagos = await buscarPagosRecientes(desde);

  let guardados = 0;
  for (const pago of pagos) {
    if (await guardarMovimiento(admin, pago)) guardados += 1;
  }
  return guardados;
}

// Después de guardar un ingreso, re-evalúa las solicitudes que esperan ese monto.
export async function conciliarIngreso(admin: Admin, monto: number): Promise<void> {
  const { data } = await admin
    .from("solicitudes_pago")
    .select("id")
    .eq("estado", "verificando")
    .eq("monto_a_transferir", monto)
    .returns<{ id: string }[]>();

  for (const { id } of data ?? []) {
    await verificarSolicitud(admin, id);
  }
}
