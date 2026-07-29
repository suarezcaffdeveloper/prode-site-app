import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getUsuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol")
    .eq("id", user.id)
    .single();

  return usuario;
}
