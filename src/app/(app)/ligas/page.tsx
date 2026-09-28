import { createClient } from "@/lib/supabase/server";
import { obtenerPozoJornada } from "@/lib/pozo";
import { CatalogoHero } from "./catalogo-hero";
import {
  CatalogoEscritorio,
  type EstadoFechaLiga,
  type LigaCatalogo,
} from "./catalogo-escritorio";
import { CatalogoHeroMovil, CatalogoListaMovil } from "./catalogo-movil";

export default async function LigasPage() {
  const supabase = await createClient();
  const [{ data: ligas }, { data: auth }] = await Promise.all([
    supabase
      .from("ligas")
      .select("id, nombre, descripcion, logo_url")
      .eq("activa", true)
      .order("nombre"),
    supabase.auth.getUser(),
  ]);

  if (auth.user) await supabase.rpc("vencer_suscripciones");
  const { data: membresias } = auth.user
    ? await supabase
        .from("membresias_liga")
        .select("liga_id, estado_suscripcion")
        .eq("usuario_id", auth.user.id)
    : { data: null };
  const membresiaPorLiga = new Map((membresias ?? []).map((m) => [m.liga_id, m.estado_suscripcion]));

  // Fecha en curso y pozo de cada liga. Son pocas ligas, así que se consultan
  // en paralelo.
  const detalle: LigaCatalogo[] = await Promise.all(
    (ligas ?? []).map(async (liga) => {
      const { data } = await supabase.rpc("jornada_activa", { p_liga_id: liga.id });
      const activa =
        (data as { jornada: number; hora_cierre: string | null }[] | null)?.[0] ?? null;
      const pozo = activa ? await obtenerPozoJornada(supabase, liga.id, activa.jornada) : null;
      const estadoFecha: EstadoFechaLiga = !activa
        ? "sin_fecha"
        : activa.hora_cierre === null
          ? "bloqueada"
          : new Date(activa.hora_cierre) <= new Date()
            ? "cerrada"
            : "abierta";

      return {
        id: liga.id,
        nombre: liga.nombre,
        descripcion: liga.descripcion,
        logoUrl: liga.logo_url,
        jornada: activa?.jornada ?? null,
        estadoFecha,
        pozo: pozo?.pozo_total ?? null,
        membresia: membresiaPorLiga.get(liga.id) ?? null,
      };
    }),
  );

  const pozos = detalle.flatMap((l) => (l.pozo !== null ? [l.pozo] : []));
  const resumen = {
    totalLigas: detalle.length,
    ligasSuscriptas: detalle.filter((l) => l.membresia === "activa").length,
    pozoEnJuego: pozos.length > 0 ? pozos.reduce((total, p) => total + p, 0) : null,
  };

  return (
    <div className="flex flex-col gap-8 lg:gap-12">
      <CatalogoHero resumen={resumen} />
      <CatalogoHeroMovil resumen={resumen} />

      <CatalogoEscritorio ligas={detalle} />
      <CatalogoListaMovil ligas={detalle} />
    </div>
  );
}
