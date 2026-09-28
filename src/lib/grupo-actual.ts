import { cache } from "react";
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Grupo = {
  id: string;
  nombre: string;
  liga_id: string;
  creador_id: string;
  codigo_invitacion: string;
};

// Memoizado por request y por id: el layout de /grupos/[id] y su page
// comparten esta lectura en vez de duplicar el mismo select a "grupos".
export const obtenerGrupo = cache(async (id: string): Promise<Grupo | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("grupos")
    .select("id, nombre, liga_id, creador_id, codigo_invitacion")
    .eq("id", id)
    .maybeSingle();

  return data;
});
