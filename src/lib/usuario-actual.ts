import { cache } from "react";
import "server-only";
import { createClient } from "@/lib/supabase/server";

// Memoizado por request: aunque el layout y cada page llamen a esto por su
// cuenta, auth.getUser() termina pegando contra el servidor de Auth una sola
// vez por navegación (React.cache resetea entre requests, no persiste).
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export const getUsuarioActual = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol, ultimo_sync_avisos")
    .eq("id", user.id)
    .single();

  return usuario;
});
