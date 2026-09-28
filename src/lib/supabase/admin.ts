import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con la Service Role Key: bypassa RLS por completo. Server-only y
// sin persistencia de sesión (no es un cliente de usuario). Se usa
// exclusivamente para generar links de confirmación de email (SPEC 11) desde
// server actions; nunca se importa desde un Client Component.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY para esta operación.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
