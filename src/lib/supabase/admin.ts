import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con service role: se salta RLS. Solo para código que corre sin
// sesión de usuario (webhook y cron de Mercado Pago) y para las pantallas de
// /admin que necesitan columnas que el usuario común no puede leer. Nunca debe
// importarse desde un client component (server-only lo impide en el build).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
