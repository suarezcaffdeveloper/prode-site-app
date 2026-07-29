"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function cambiarEstadoSuscripcion(
  ligaId: string,
  membresiaId: string,
  formData: FormData,
) {
  const nuevoEstado = String(formData.get("estado_suscripcion"));
  const supabase = await createClient();

  await supabase
    .from("membresias_liga")
    .update({ estado_suscripcion: nuevoEstado })
    .eq("id", membresiaId);

  revalidatePath(`/admin/ligas/${ligaId}/usuarios`);
}
