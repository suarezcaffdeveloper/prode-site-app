import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { MarcadorEstado } from "@/components/ui/marcador";
import { obtenerPlan } from "@/lib/planes";
import { calcularSaldoDisponible } from "@/lib/creditos";
import { EstadoSelector } from "./estado-selector";
import { OtorgarPlanForm } from "./otorgar-plan-form";
import { cambiarEstadoSuscripcion, otorgarPlan } from "./actions";

const URL_COMPROBANTE_TTL_SEGUNDOS = 600;

export default async function UsuariosLigaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: liga } = await supabase
    .from("ligas")
    .select("id, nombre")
    .eq("id", id)
    .single();

  if (!liga) notFound();

  const { data: membresias } = await supabase
    .from("membresias_liga")
    .select("id, usuario_id, estado_suscripcion, plan_elegido, comprobante_path, usuarios(email, nombre)")
    .eq("liga_id", id)
    .order("created_at", { ascending: false });

  const { data: planesActivos } = await supabase
    .from("planes")
    .select("id, nombre, cantidad_creditos, slug")
    .eq("activo", true)
    .order("cantidad_creditos", { ascending: true });

  type LoteUsuario = {
    usuario_id: string;
    cantidad_total: number;
    cantidad_usada: number;
    expira_en: string | null;
  };

  const { data: lotesLiga } = await supabase
    .from("creditos_lotes")
    .select("usuario_id, cantidad_total, cantidad_usada, expira_en")
    .eq("liga_id", id)
    .returns<LoteUsuario[]>();

  const lotesPorUsuario = new Map<string, LoteUsuario[]>();
  for (const lote of lotesLiga ?? []) {
    const lotes = lotesPorUsuario.get(lote.usuario_id) ?? [];
    lotes.push(lote);
    lotesPorUsuario.set(lote.usuario_id, lotes);
  }

  const urlsComprobante = new Map(
    await Promise.all(
      (membresias ?? [])
        .filter((membresia) => membresia.comprobante_path)
        .map(async (membresia) => {
          const { data } = await supabase.storage
            .from("comprobantes")
            .createSignedUrl(membresia.comprobante_path as string, URL_COMPROBANTE_TTL_SEGUNDOS);
          return [membresia.id, data?.signedUrl ?? null] as const;
        }),
    ),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {liga.nombre.toUpperCase()}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Suscripciones
        </h1>
      </div>

      {!membresias || membresias.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-600">
          Todavía nadie pidió suscribirse a esta liga.
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {membresias.map((membresia) => {
            const usuario = Array.isArray(membresia.usuarios)
              ? membresia.usuarios[0]
              : membresia.usuarios;
            const plan = membresia.plan_elegido ? obtenerPlan(membresia.plan_elegido) : null;
            const urlComprobante = urlsComprobante.get(membresia.id);
            const saldo = calcularSaldoDisponible(lotesPorUsuario.get(membresia.usuario_id) ?? []);

            return (
              <li key={membresia.id}>
                <Card className="flex flex-col gap-4 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {usuario?.nombre || usuario?.email}
                      </p>
                      {usuario?.nombre && (
                        <p className="truncate text-xs text-ink-400">
                          {usuario.email}
                        </p>
                      )}
                      {plan && (
                        <p className="mt-1 text-xs text-ink-600">
                          Plan elegido: <span className="font-medium">{plan.nombre}</span>
                        </p>
                      )}
                      {urlComprobante && (
                        <a
                          href={urlComprobante}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs font-medium text-pitch-700 hover:underline"
                        >
                          Ver comprobante →
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <MarcadorEstado estado={membresia.estado_suscripcion} />
                      <EstadoSelector
                        estadoActual={membresia.estado_suscripcion}
                        action={cambiarEstadoSuscripcion.bind(null, liga.id, membresia.id)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
                    <p className="text-xs font-medium text-ink-600">
                      Créditos disponibles en esta liga:{" "}
                      <span className="font-semibold text-ink-900">{saldo}</span>
                    </p>
                    {planesActivos && planesActivos.length > 0 && (
                      <OtorgarPlanForm
                        planes={planesActivos}
                        slugSugerido={membresia.plan_elegido}
                        action={otorgarPlan.bind(null, liga.id, membresia.usuario_id)}
                      />
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
