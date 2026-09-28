import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TipoNotificacion =
  | "ganaste"
  | "sin_premio"
  | "ultimo_prode"
  | "sin_prodes"
  | "jornada_abierta"
  | "plan_acreditado"
  | "cierra_pronto"
  | "creditos_por_vencer";

export type Notificacion = {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  texto: string;
  ligaNombre: string | null;
  creadaEn: string;
  leida: boolean;
  href: string;
};

type Fila = {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  texto: string;
  liga_id: string;
  jornada: number | null;
  created_at: string;
  leida_en: string | null;
  ligas: { nombre: string } | { nombre: string }[] | null;
};

const LIMITE = 10;

function hrefDe(tipo: TipoNotificacion, ligaId: string, jornada: number | null) {
  const base = `/ligas/${ligaId}`;
  switch (tipo) {
    case "ganaste":
    case "sin_premio":
      return jornada ? `${base}/pronosticos?jornada=${jornada}` : `${base}/pronosticos`;
    case "ultimo_prode":
    case "sin_prodes":
    case "creditos_por_vencer":
      return `${base}/planes`;
    default:
      return `${base}/pronosticos`;
  }
}

export async function obtenerNotificaciones(): Promise<Notificacion[]> {
  const supabase = await createClient();

  // Genera los avisos que dependen del tiempo (cierre cercano, créditos por
  // vencer). Es idempotente; si falla, la campana igual muestra lo existente.
  await supabase.rpc("sincronizar_avisos");

  const { data } = await supabase
    .from("notificaciones")
    .select("id, tipo, titulo, texto, liga_id, jornada, created_at, leida_en, ligas(nombre)")
    .or(`vence_en.is.null,vence_en.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(LIMITE);

  return ((data ?? []) as unknown as Fila[]).map((fila) => {
    const liga = Array.isArray(fila.ligas) ? fila.ligas[0] : fila.ligas;
    return {
      id: fila.id,
      tipo: fila.tipo,
      titulo: fila.titulo,
      texto: fila.texto,
      ligaNombre: liga?.nombre ?? null,
      creadaEn: fila.created_at,
      leida: fila.leida_en !== null,
      href: hrefDe(fila.tipo, fila.liga_id, fila.jornada),
    };
  });
}
