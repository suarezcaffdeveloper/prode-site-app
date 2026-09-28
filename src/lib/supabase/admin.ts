import "server-only";

import { createClient } from "@supabase/supabase-js";

// Cliente con la Service Role Key: bypassa RLS por completo. Server-only y
// sin persistencia de sesión (no es un cliente de usuario). Se usa para
// generar links de confirmación de email (SPEC 11), y para el webhook y el
// cron de Mercado Pago y las pantallas de /admin/pagos (SPEC 12), que corren
// sin sesión de usuario o necesitan columnas que el usuario común no puede
// leer. Nunca se importa desde un Client Component (server-only lo impide en
// el build).
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
