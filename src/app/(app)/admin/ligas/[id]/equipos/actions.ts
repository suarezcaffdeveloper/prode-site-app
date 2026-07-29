"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type State = { error?: string };

async function subirEscudo(
  supabase: SupabaseClient,
  ligaId: string,
  escudo: File,
): Promise<string | null> {
  const extension = escudo.name.split(".").pop();
  const path = `${ligaId}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;

  const { error } = await supabase.storage.from("escudos").upload(path, escudo);
  if (error) return null;

  return supabase.storage.from("escudos").getPublicUrl(path).data.publicUrl;
}

export async function crearEquipo(
  ligaId: string,
  _prevState: State,
  formData: FormData,
) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) {
    return { error: "El nombre del equipo es obligatorio." };
  }

  const supabase = await createClient();
  const escudo = formData.get("escudo");
  const escudoUrl =
    escudo instanceof File && escudo.size > 0
      ? await subirEscudo(supabase, ligaId, escudo)
      : null;

  const { error } = await supabase
    .from("equipos")
    .insert({ liga_id: ligaId, nombre, escudo_url: escudoUrl });

  if (error) {
    return { error: "No pudimos crear el equipo. Intentá de nuevo." };
  }

  revalidatePath(`/admin/ligas/${ligaId}/equipos`);
  redirect(`/admin/ligas/${ligaId}/equipos`);
}

export async function actualizarEquipo(
  ligaId: string,
  equipoId: string,
  _prevState: State,
  formData: FormData,
) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) {
    return { error: "El nombre del equipo es obligatorio." };
  }

  const supabase = await createClient();
  const escudo = formData.get("escudo");
  const update: { nombre: string; escudo_url?: string } = { nombre };

  if (escudo instanceof File && escudo.size > 0) {
    const escudoUrl = await subirEscudo(supabase, ligaId, escudo);
    if (!escudoUrl) {
      return { error: "No pudimos subir el escudo. Intentá de nuevo." };
    }
    update.escudo_url = escudoUrl;
  }

  const { error } = await supabase.from("equipos").update(update).eq("id", equipoId);

  if (error) {
    return { error: "No pudimos guardar los cambios. Intentá de nuevo." };
  }

  revalidatePath(`/admin/ligas/${ligaId}/equipos`);
  redirect(`/admin/ligas/${ligaId}/equipos`);
}

export async function borrarEquipo(ligaId: string, equipoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("equipos").delete().eq("id", equipoId);

  if (error) {
    return { error: "No pudimos borrar el equipo. Puede tener partidos cargados." };
  }

  revalidatePath(`/admin/ligas/${ligaId}/equipos`);
}
