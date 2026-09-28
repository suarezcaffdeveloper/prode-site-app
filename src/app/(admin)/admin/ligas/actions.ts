"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string };

export async function crearLiga(_prevState: State, formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();

  if (!nombre) {
    return { error: "El nombre de la liga es obligatorio." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("ligas")
    .insert({ nombre, descripcion: descripcion || null });

  if (error) {
    return { error: "No pudimos crear la liga. Intentá de nuevo." };
  }

  revalidatePath("/admin/ligas");
  redirect("/admin/ligas");
}

export async function actualizarLiga(
  ligaId: string,
  _prevState: State,
  formData: FormData,
) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const activa = formData.get("activa") === "on";

  if (!nombre) {
    return { error: "El nombre de la liga es obligatorio." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("ligas")
    .update({ nombre, descripcion: descripcion || null, activa })
    .eq("id", ligaId);

  if (error) {
    return { error: "No pudimos guardar los cambios. Intentá de nuevo." };
  }

  revalidatePath("/admin/ligas");
  redirect("/admin/ligas");
}
