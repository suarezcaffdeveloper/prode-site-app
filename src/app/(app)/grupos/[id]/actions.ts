"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string };

export async function renombrarGrupo(
  grupoId: string,
  _prevState: State,
  formData: FormData,
) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) {
    return { error: "El nombre no puede estar vacío." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("grupos")
    .update({ nombre })
    .eq("id", grupoId);

  if (error) {
    return { error: "No pudimos renombrar el grupo. Intentá de nuevo." };
  }

  revalidatePath(`/grupos/${grupoId}`);
  return {};
}

export async function echarMiembro(grupoId: string, membresiaId: string) {
  const supabase = await createClient();
  await supabase.from("membresias_grupo").delete().eq("id", membresiaId);
  revalidatePath(`/grupos/${grupoId}`);
}

export async function eliminarGrupo(grupoId: string, ligaId: string) {
  const supabase = await createClient();
  await supabase.from("grupos").delete().eq("id", grupoId);
  redirect(`/ligas/${ligaId}`);
}
