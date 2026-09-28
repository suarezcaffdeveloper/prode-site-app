"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMPROBANTE_TAMANIO_MAXIMO, detectarImagen } from "@/lib/comprobante-archivo";
import { sincronizarMovimientos, verificarSolicitud } from "@/lib/verificar-pago";

// Compra de un plan por transferencia (SPEC 11): el usuario genera una
// solicitud con un monto único y sube el comprobante; la verificación contra
// la cuenta de Mercado Pago es automática (ver src/lib/verificar-pago.ts).

export type SolicitudVista = {
  id: string;
  planSlug: string;
  montoATransferir: number;
  expiraEn: string;
};

export type CrearSolicitudResultado = { error?: string; solicitud?: SolicitudVista };

export type EnviarComprobanteResultado = {
  error?: string;
  estado?: "aprobada" | "verificando" | "pendiente_admin";
};

type FilaSolicitud = {
  id: string;
  plan_slug: string;
  monto_a_transferir: number;
  expira_en: string;
};

export async function crearSolicitudPago(
  ligaId: string,
  planSlug: string,
): Promise<CrearSolicitudResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { data, error } = await supabase.rpc("crear_solicitud_pago", {
    p_liga_id: ligaId,
    p_plan_slug: planSlug,
  });

  if (error || !data) {
    const mensaje = error?.message ?? "";
    if (mensaje.includes("montos_agotados")) {
      return { error: "Hay muchos pagos en curso. Probá de nuevo en unos minutos." };
    }
    if (mensaje.includes("plan_invalido") || mensaje.includes("liga_invalida")) {
      return { error: "Ese plan no está disponible. Volvé a intentar." };
    }
    return { error: "No pudimos iniciar tu pago. Intentá de nuevo." };
  }

  const fila = data as FilaSolicitud;
  return {
    solicitud: {
      id: fila.id,
      planSlug: fila.plan_slug,
      montoATransferir: Number(fila.monto_a_transferir),
      expiraEn: fila.expira_en,
    },
  };
}

export async function enviarComprobante(
  ligaId: string,
  solicitudId: string,
  formData: FormData,
): Promise<EnviarComprobanteResultado> {
  const comprobante = formData.get("comprobante");
  if (!(comprobante instanceof File) || comprobante.size === 0) {
    return { error: "Subí una imagen del comprobante." };
  }
  if (comprobante.size > COMPROBANTE_TAMANIO_MAXIMO) {
    return { error: "La imagen es demasiado pesada (máximo 5 MB)." };
  }

  // El tipo se valida por el contenido del archivo, no por el MIME que informa
  // el navegador (que puede falsificarse).
  const bytes = new Uint8Array(await comprobante.arrayBuffer());
  const imagen = detectarImagen(bytes);
  if (!imagen) {
    return { error: "El comprobante debe ser una imagen JPG, PNG o WEBP." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const path = `${user.id}/${ligaId}/${crypto.randomUUID()}.${imagen.extension}`;

  const { error: errorSubida } = await supabase.storage
    .from("comprobantes")
    .upload(path, bytes, { contentType: imagen.mediaType });
  if (errorSubida) {
    return { error: "No pudimos subir el comprobante. Intentá de nuevo." };
  }

  const { error: errorRegistro } = await supabase.rpc("registrar_comprobante", {
    p_solicitud_id: solicitudId,
    p_path: path,
    p_sha256: sha256,
  });

  if (errorRegistro) {
    await supabase.storage.from("comprobantes").remove([path]);
    const mensaje = errorRegistro.message ?? "";
    if (mensaje.includes("solicitud_vencida")) {
      return { error: "La reserva del monto venció. Generá un pago nuevo." };
    }
    if (mensaje.includes("solicitud_no_editable")) {
      return { error: "Este pago ya tiene un comprobante enviado." };
    }
    return { error: "No pudimos registrar el comprobante. Intentá de nuevo." };
  }

  // Desde acá el comprobante quedó guardado y la solicitud en "verificando".
  // Si algo de la verificación falla (IA caída, Mercado Pago sin responder), no
  // es un error del usuario: la solicitud sigue en verificación y la retoma el
  // cron, o termina en revisión manual.
  let estado: EnviarComprobanteResultado["estado"] = "verificando";
  try {
    const admin = createAdminClient();
    try {
      await sincronizarMovimientos(admin);
    } catch {
      // Sin acceso a Mercado Pago en este momento: se usa lo que ya hay en el ledger.
    }
    const resultado = await verificarSolicitud(admin, solicitudId);
    if (resultado === "aprobada" || resultado === "pendiente_admin") estado = resultado;
  } catch {
    // ver comentario de arriba
  }

  revalidatePath(`/ligas/${ligaId}`, "layout");
  return { estado };
}
