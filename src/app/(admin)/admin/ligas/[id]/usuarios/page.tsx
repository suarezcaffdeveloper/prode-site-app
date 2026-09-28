import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { MarcadorEstado } from "@/components/ui/marcador";
import { obtenerPlan } from "@/lib/planes";
import { calcularSaldoDisponible } from "@/lib/creditos";
import { CambiarEstadoBoton } from "./cambiar-estado-boton";
import { OtorgarPlanForm } from "./otorgar-plan-form";
import { cambiarEstadoSuscripcion, otorgarPlan } from "./actions";

const URL_COMPROBANTE_TTL_SEGUNDOS = 600;

type Estado = "pendiente" | "activa" | "inactiva";

const FILTROS: { valor: Estado | "todas"; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "pendiente", etiqueta: "Pendientes" },
  { valor: "activa", etiqueta: "Activas" },
  { valor: "inactiva", etiqueta: "Inactivas" },
];

// Qué le está pidiendo la fila al admin, según el estado actual.
const CONTEXTO: Record<
  Estado,
  { mensaje: string; franja: string; etiquetaPlan: string; variantePlan: "primary" | "secondary" }
> = {
  pendiente: {
    mensaje: "Solicitud pendiente. Revisá el comprobante y otorgá un plan para activarla.",
    franja: "bg-amber-500/10",
    etiquetaPlan: "Activar con este plan",
    variantePlan: "primary",
  },
  activa: {
    mensaje: "Suscripción activa. Podés sumarle más créditos otorgando otro plan.",
    franja: "bg-chalk-50",
    etiquetaPlan: "Otorgar créditos",
    variantePlan: "secondary",
  },
  inactiva: {
    mensaje: "Suscripción dada de baja. Otorgá un plan para reactivarla.",
    franja: "bg-chalk-50",
    etiquetaPlan: "Reactivar con este plan",
    variantePlan: "primary",
  },
};

export default async function UsuariosLigaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { id } = await params;
  const { estado: estadoParam } = await searchParams;
  const filtro: Estado | "todas" =
    estadoParam === "pendiente" || estadoParam === "activa" || estadoParam === "inactiva"
      ? estadoParam
      : "todas";

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

  const todas = membresias ?? [];
  const conteo: Record<Estado | "todas", number> = {
    todas: todas.length,
    pendiente: todas.filter((m) => m.estado_suscripcion === "pendiente").length,
    activa: todas.filter((m) => m.estado_suscripcion === "activa").length,
    inactiva: todas.filter((m) => m.estado_suscripcion === "inactiva").length,
  };

  // Las pendientes van primero: son las que esperan una decisión del admin.
  const visibles = todas
    .filter((m) => filtro === "todas" || m.estado_suscripcion === filtro)
    .sort(
      (a, b) =>
        Number(b.estado_suscripcion === "pendiente") -
        Number(a.estado_suscripcion === "pendiente"),
    );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/ligas"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-pitch-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Todas las ligas
        </Link>
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            {liga.nombre.toUpperCase()}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Suscripciones
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {conteo.pendiente > 0
              ? `${conteo.pendiente} ${conteo.pendiente === 1 ? "solicitud espera" : "solicitudes esperan"} tu decisión · `
              : ""}
            {conteo.activa} {conteo.activa === 1 ? "activa" : "activas"} de {conteo.todas}
          </p>
        </div>
      </div>

      {todas.length === 0 ? (
        <Card className="flex flex-col items-center gap-1 border-dashed p-16 text-center">
          <p className="font-display text-lg font-semibold text-ink-900">
            Todavía nadie pidió suscribirse
          </p>
          <p className="text-sm text-ink-600">
            Cuando un usuario solicite un plan en esta liga, va a aparecer acá.
          </p>
        </Card>
      ) : (
        <>
          <nav
            aria-label="Filtrar por estado"
            className="flex w-fit items-center gap-1 rounded-xl border border-line bg-chalk-0 p-1"
          >
            {FILTROS.map(({ valor, etiqueta }) => {
              const activo = valor === filtro;
              return (
                <Link
                  key={valor}
                  href={
                    valor === "todas"
                      ? `/admin/ligas/${id}/usuarios`
                      : `/admin/ligas/${id}/usuarios?estado=${valor}`
                  }
                  aria-current={activo ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    activo
                      ? "bg-pitch-700 text-chalk-0"
                      : "text-ink-600 hover:bg-chalk-100 hover:text-pitch-700"
                  }`}
                >
                  {etiqueta}
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      activo ? "text-chalk-0/70" : "text-ink-400"
                    }`}
                  >
                    {conteo[valor]}
                  </span>
                </Link>
              );
            })}
          </nav>

          {visibles.length === 0 ? (
            <Card className="p-12 text-center text-sm text-ink-600">
              No hay suscripciones en este estado.
            </Card>
          ) : (
            <ul className="flex flex-col gap-5">
              {visibles.map((membresia) => {
                const usuario = Array.isArray(membresia.usuarios)
                  ? membresia.usuarios[0]
                  : membresia.usuarios;
                const plan = membresia.plan_elegido ? obtenerPlan(membresia.plan_elegido) : null;
                const urlComprobante = urlsComprobante.get(membresia.id);
                const saldo = calcularSaldoDisponible(
                  lotesPorUsuario.get(membresia.usuario_id) ?? [],
                );
                const estado: Estado = membresia.estado_suscripcion;
                const contexto = CONTEXTO[estado];
                const titulo = usuario?.nombre || usuario?.email || "Usuario";

                return (
                  <li key={membresia.id}>
                    <Card className="overflow-hidden">
                      <div className="flex items-center gap-5 px-6 py-5">
                        <span
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pitch-900 font-display text-xl font-bold text-lime-300"
                          aria-hidden="true"
                        >
                          {titulo.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-lg font-bold tracking-tight text-ink-900">
                            {titulo}
                          </p>
                          {usuario?.nombre && (
                            <p className="truncate text-sm text-ink-600">{usuario.email}</p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <span className="text-ink-600">
                              Plan elegido:{" "}
                              <span className="font-semibold text-ink-900">
                                {plan ? plan.nombre : "Ninguno"}
                              </span>
                            </span>
                            {urlComprobante ? (
                              <a
                                href={urlComprobante}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 font-semibold text-pitch-700 hover:underline"
                              >
                                Ver comprobante
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              </a>
                            ) : (
                              <span className="text-ink-400">Sin comprobante</span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-8">
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                              CRÉDITOS
                            </span>
                            <span className="font-display text-xl font-bold leading-tight text-pitch-700">
                              {saldo}
                            </span>
                          </div>
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                              ESTADO
                            </span>
                            <MarcadorEstado estado={estado} />
                          </div>
                        </div>
                      </div>

                      <div
                        className={`flex flex-col gap-3 border-t border-line px-6 py-4 ${contexto.franja}`}
                      >
                        <p className="text-sm text-ink-600">{contexto.mensaje}</p>
                        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                          {planesActivos && planesActivos.length > 0 ? (
                            <OtorgarPlanForm
                              planes={planesActivos}
                              slugSugerido={membresia.plan_elegido}
                              etiqueta={contexto.etiquetaPlan}
                              variante={contexto.variantePlan}
                              action={otorgarPlan.bind(null, liga.id, membresia.usuario_id)}
                            />
                          ) : (
                            <p className="text-sm font-medium text-coral-700">
                              No hay planes activos para otorgar.
                            </p>
                          )}

                          {estado === "pendiente" && (
                            <CambiarEstadoBoton
                              destino="inactiva"
                              label="Rechazar solicitud"
                              confirmLabel={`¿Rechazar la solicitud de ${titulo}?`}
                              action={cambiarEstadoSuscripcion.bind(null, liga.id, membresia.id)}
                            />
                          )}
                          {estado === "activa" && (
                            <CambiarEstadoBoton
                              destino="inactiva"
                              label="Dar de baja"
                              confirmLabel={`¿Dar de baja a ${titulo}?`}
                              action={cambiarEstadoSuscripcion.bind(null, liga.id, membresia.id)}
                            />
                          )}
                          {estado === "inactiva" && (
                            <CambiarEstadoBoton
                              destino="pendiente"
                              label="Volver a pendiente"
                              action={cambiarEstadoSuscripcion.bind(null, liga.id, membresia.id)}
                            />
                          )}
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
