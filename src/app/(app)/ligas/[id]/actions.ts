"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generarCodigoInvitacion } from "@/lib/codigo-invitacion";

export async function suscribirse(ligaId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("membresias_liga")
    .insert({ usuario_id: user.id, liga_id: ligaId });

  revalidatePath(`/ligas/${ligaId}`);
}

type State = { error?: string };

export async function crearGrupo(
  ligaId: string,
  _prevState: State,
  formData: FormData,
) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) {
    return { error: "El nombre del subgrupo es obligatorio." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  let grupoId: string | null = null;

  // Reintenta si el código generado al azar choca con el constraint unique
  // (altamente improbable con 6 caracteres, pero posible).
  for (let intento = 0; intento < 5 && !grupoId; intento++) {
    const { data, error } = await supabase
      .from("grupos")
      .insert({
        liga_id: ligaId,
        nombre,
        creador_id: user.id,
        codigo_invitacion: generarCodigoInvitacion(),
      })
      .select("id")
      .single();

    if (data) {
      grupoId = data.id;
    } else if (error && error.code !== "23505") {
      return { error: "No pudimos crear el subgrupo. Intentá de nuevo." };
    }
  }

  if (!grupoId) {
    return { error: "No pudimos generar un código único. Intentá de nuevo." };
  }

  await supabase
    .from("membresias_grupo")
    .insert({ grupo_id: grupoId, usuario_id: user.id });

  revalidatePath(`/ligas/${ligaId}`);
  redirect(`/grupos/${grupoId}`);
}

export async function unirseAGrupo(
  ligaId: string,
  _prevState: State,
  formData: FormData,
) {
  const codigo = String(formData.get("codigo") ?? "").trim();
  if (!codigo) {
    return { error: "Ingresá un código de invitación." };
  }

  const supabase = await createClient();
  const { data: grupoId, error } = await supabase.rpc("unirse_a_grupo", {
    p_codigo: codigo,
  });

  if (error) {
    if (error.message.includes("codigo_invalido")) {
      return { error: "Ese código no corresponde a ningún subgrupo." };
    }
    if (error.message.includes("suscripcion_no_activa")) {
      return { error: "Necesitás una suscripción activa a esta liga para unirte." };
    }
    return { error: "No pudimos procesar el código. Intentá de nuevo." };
  }

  revalidatePath(`/ligas/${ligaId}`);
  redirect(`/grupos/${grupoId}`);
}
