import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerPago, validarFirmaWebhook } from "@/lib/mercadopago";
import { conciliarIngreso, guardarMovimiento } from "@/lib/verificar-pago";

// Webhook de Mercado Pago (SPEC 12). Cada aviso de pago se valida por firma,
// se consulta el detalle por API (el aviso solo trae el id), se guarda en el
// ledger de movimientos y se re-evalúan las solicitudes que esperaban ese monto.
// Es idempotente: Mercado Pago reintenta y puede avisar dos veces el mismo pago.

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const cuerpo = (await request.json().catch(() => null)) as {
    type?: string;
    data?: { id?: string | number };
  } | null;

  const idQuery = request.nextUrl.searchParams.get("data.id");
  const dataId = idQuery ?? (cuerpo?.data?.id !== undefined ? String(cuerpo.data.id) : null);

  const firmaValida = validarFirmaWebhook({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
  });
  if (!firmaValida) {
    return NextResponse.json({ error: "firma_invalida" }, { status: 401 });
  }

  const tipo =
    cuerpo?.type ??
    request.nextUrl.searchParams.get("type") ??
    request.nextUrl.searchParams.get("topic");
  if (tipo !== "payment" || !dataId) {
    return NextResponse.json({ ignorado: true });
  }

  try {
    const movimiento = await obtenerPago(dataId);
    if (!movimiento) return NextResponse.json({ ignorado: true });

    const admin = createAdminClient();
    await guardarMovimiento(admin, movimiento);

    if (movimiento.direccion === "ingreso" && movimiento.estado_mp === "approved") {
      await conciliarIngreso(admin, movimiento.monto);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook de Mercado Pago:", error);
    // 500 para que Mercado Pago reintente el aviso.
    return NextResponse.json({ error: "error_interno" }, { status: 500 });
  }
}
