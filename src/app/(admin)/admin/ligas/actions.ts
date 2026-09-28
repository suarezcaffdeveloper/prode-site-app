"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type State = { error?: string };

const BUCKET_LOGOS = "escudos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const EXTENSION_POR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function archivoLogo(formData: FormData): File | null {
  const logo = formData.get("logo");
  return logo instanceof File && logo.size > 0 ? logo : null;
}

function validarLogo(logo: File): string | null {
  if (!(logo.type in EXTENSION_POR_MIME)) return "El logo tiene que ser una imagen PNG, JPG, WEBP o GIF.";
  if (logo.size > MAX_LOGO_BYTES) return "El logo no puede pesar más de 2 MB.";
  return null;
}

async function subirLogo(supabase: SupabaseClient, logo: File): Promise<string | null> {
  const path = `ligas/${crypto.randomUUID()}.${EXTENSION_POR_MIME[logo.type]}`;

  const { error } = await supabase.storage.from(BUCKET_LOGOS).upload(path, logo);
  if (error) return null;

  return supabase.storage.from(BUCKET_LOGOS).getPublicUrl(path).data.publicUrl;
}

// Borrado de mejor esfuerzo: si falla, el archivo queda huérfano en el bucket
// pero la liga ya apunta a la imagen correcta.
async function borrarLogo(supabase: SupabaseClient, url: string | null | undefined) {
  const marca = `/${BUCKET_LOGOS}/`;
  const indice = url?.indexOf(marca) ?? -1;
  if (!url || indice === -1) return;
  await supabase.storage.from(BUCKET_LOGOS).remove([url.slice(indice + marca.length)]);
}

export async function crearLiga(_prevState: State, formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const logo = archivoLogo(formData);

  if (!nombre) {
    return { error: "El nombre de la liga es obligatorio." };
  }
  const errorLogo = logo ? validarLogo(logo) : null;
  if (errorLogo) return { error: errorLogo };

  const supabase = await createClient();

  let logoUrl: string | null = null;
  if (logo) {
    logoUrl = await subirLogo(supabase, logo);
    if (!logoUrl) return { error: "No pudimos subir el logo. Intentá de nuevo." };
  }

  const { error } = await supabase
    .from("ligas")
    .insert({ nombre, descripcion: descripcion || null, logo_url: logoUrl });

  if (error) {
    await borrarLogo(supabase, logoUrl);
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
  const quitarLogo = formData.get("quitar_logo") === "1";
  const logo = archivoLogo(formData);

  if (!nombre) {
    return { error: "El nombre de la liga es obligatorio." };
  }
  const errorLogo = logo ? validarLogo(logo) : null;
  if (errorLogo) return { error: errorLogo };

  const supabase = await createClient();

  const update: {
    nombre: string;
    descripcion: string | null;
    activa: boolean;
    logo_url?: string | null;
  } = { nombre, descripcion: descripcion || null, activa };

  // Un logo nuevo tiene prioridad sobre "quitar"; sin ninguno de los dos el
  // logo actual no se toca.
  let logoNuevoUrl: string | null = null;
  if (logo) {
    logoNuevoUrl = await subirLogo(supabase, logo);
    if (!logoNuevoUrl) return { error: "No pudimos subir el logo. Intentá de nuevo." };
    update.logo_url = logoNuevoUrl;
  } else if (quitarLogo) {
    update.logo_url = null;
  }

  const { data: anterior } = await supabase
    .from("ligas")
    .select("logo_url")
    .eq("id", ligaId)
    .single();

  const { error } = await supabase.from("ligas").update(update).eq("id", ligaId);

  if (error) {
    await borrarLogo(supabase, logoNuevoUrl);
    return { error: "No pudimos guardar los cambios. Intentá de nuevo." };
  }

  if ("logo_url" in update) await borrarLogo(supabase, anterior?.logo_url);

  revalidatePath("/admin/ligas");
  redirect("/admin/ligas");
}
