import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarMovimientos, verificarPendientes } from "@/lib/verificar-pago";

// Red de seguridad de SPEC 11: corre cada pocos minutos (cron del hosting o un
// cron HTTP externo) y, con o sin webhook, sincroniza los pagos recientes de la
// cuenta de Mercado Pago, re-evalúa las solicitudes que esperan su
// movimiento y vence las reservas de monto de más de 48 horas.
// Protegido con `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron lo envía solo).

export const maxDuration = 60;

function secretoValido(recibido: string | null): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || !recibido) return false;

  const esperado = createHash("sha256").update(`Bearer ${secreto}`).digest();
  const actual = createHash("sha256").update(recibido).digest();
  return timingSafeEqual(esperado, actual);
}

export async function GET(request: NextRequest) {
  if (!secretoValido(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: vencidas } = await admin.rpc("vencer_solicitudes_pago");

  let movimientosSincronizados = 0;
  let errorSincronizacion: string | null = null;
  try {
    movimientosSincronizados = await sincronizarMovimientos(admin);
  } catch (error) {
    // Un fallo de Mercado Pago no debe impedir re-evaluar con lo que ya hay.
    errorSincronizacion = error instanceof Error ? error.message : "error desconocido";
  }

  const aprobadas = await verificarPendientes(admin);

  return NextResponse.json({
    vencidas: vencidas ?? 0,
    movimientosSincronizados,
    aprobadas,
    errorSincronizacion,
  });
}
