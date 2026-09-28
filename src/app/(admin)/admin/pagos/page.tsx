import { notFound } from "next/navigation";
import { AlertTriangle, Check, ExternalLink, X } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUsuarioActual } from "@/lib/usuario-actual";
import { Card } from "@/components/ui/card";
import { obtenerPlan } from "@/lib/planes";
import { formatearPesos } from "@/lib/pozo";
import type { ExtraccionComprobante, ResultadoConciliacion } from "@/lib/conciliacion";
import { AccionesPago, type OpcionMovimiento } from "./acciones-pago";
import { aprobarPago, rechazarPago } from "./actions";

const URL_COMPROBANTE_TTL_SEGUNDOS = 600;
const DIAS_MOVIMIENTOS = 30;

type Ref<T> = T | T[] | null;

type SolicitudAdmin = {
  id: string;
  plan_slug: string;
  monto_a_transferir: number;
  estado: string;
  comprobante_path: string | null;
  comprobante_enviado_en: string | null;
  extraccion: ExtraccionComprobante | null;
  evaluacion: ResultadoConciliacion | null;
  motivos: string[];
  created_at: string;
  usuarios: Ref<{ email: string; nombre: string | null }>;
  ligas: Ref<{ nombre: string }>;
};

type MovimientoAdmin = {
  id: string;
  mp_id: string;
  direccion: "ingreso" | "egreso";
  estado_mp: string;
  monto: number;
  fecha_acreditacion: string;
  pagador_nombre: string | null;
  solicitud_id: string | null;
  alerta: string | null;
};

function uno<T>(valor: Ref<T>): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ETIQUETA_ALERTA: Record<string, string> = {
  devuelto: "Pago devuelto",
  contracargo: "Contracargo",
  egreso_sobre_movimiento_usado: "Egreso sobre un movimiento ya usado",
};

export default async function PagosAdminPage() {
  // Esta pantalla lee con service role (columnas que el usuario común no puede
  // ver): el layout de /admin ya exige rol admin, pero se verifica de nuevo acá.
  const usuario = await getUsuarioActual();
  if (usuario?.rol !== "admin") notFound();

  const admin = createAdminClient();

  const { data: pendientes } = await admin
    .from("solicitudes_pago")
    .select(
      "id, plan_slug, monto_a_transferir, estado, comprobante_path, comprobante_enviado_en, extraccion, evaluacion, motivos, created_at, usuarios(email, nombre), ligas(nombre)",
    )
    .eq("estado", "pendiente_admin")
    .order("comprobante_enviado_en", { ascending: true })
    .returns<SolicitudAdmin[]>();

  const { count: verificando } = await admin
    .from("solicitudes_pago")
    .select("id", { count: "exact", head: true })
    .eq("estado", "verificando");

  const desde = new Date(Date.now() - DIAS_MOVIMIENTOS * 24 * 60 * 60 * 1000).toISOString();
  const { data: movimientos } = await admin
    .from("movimientos_mp")
    .select("id, mp_id, direccion, estado_mp, monto, fecha_acreditacion, pagador_nombre, solicitud_id, alerta")
    .gte("fecha_acreditacion", desde)
    .order("fecha_acreditacion", { ascending: false })
    .returns<MovimientoAdmin[]>();

  const libres = (movimientos ?? []).filter(
    (m) => m.direccion === "ingreso" && m.solicitud_id === null,
  );
  const alertas = (movimientos ?? []).filter((m) => m.alerta !== null);

  const urlsComprobante = new Map(
    await Promise.all(
      (pendientes ?? [])
        .filter((s) => s.comprobante_path)
        .map(async (s) => {
          const { data } = await admin.storage
            .from("comprobantes")
            .createSignedUrl(s.comprobante_path as string, URL_COMPROBANTE_TTL_SEGUNDOS);
          return [s.id, data?.signedUrl ?? null] as const;
        }),
    ),
  );

  const opcionesMovimiento: OpcionMovimiento[] = libres.map((m) => ({
    id: m.id,
    etiqueta: `${formatearPesos(m.monto)} · ${formatearFecha(m.fecha_acreditacion)}${
      m.pagador_nombre ? ` · ${m.pagador_nombre}` : ""
    } · #${m.mp_id}`,
  }));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          COBROS
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Pagos</h1>
        <p className="mt-1 text-sm text-ink-600">
          {(pendientes ?? []).length > 0
            ? `${(pendientes ?? []).length} ${
                (pendientes ?? []).length === 1 ? "pago espera" : "pagos esperan"
              } tu decisión`
            : "No hay pagos pendientes de revisión"}
          {(verificando ?? 0) > 0 &&
            ` · ${verificando} ${verificando === 1 ? "se está verificando" : "se están verificando"} automáticamente`}
        </p>
      </div>

      {(pendientes ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-1 border-dashed p-16 text-center">
          <p className="font-display text-lg font-semibold text-ink-900">Todo al día</p>
          <p className="text-sm text-ink-600">
            Los pagos que el sistema no pueda verificar solo aparecen acá.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-5">
          {(pendientes ?? []).map((solicitud) => {
            const persona = uno(solicitud.usuarios);
            const liga = uno(solicitud.ligas);
            const plan = obtenerPlan(solicitud.plan_slug);
            const url = urlsComprobante.get(solicitud.id);
            const extraccion = solicitud.extraccion;
            const candidato =
              libres.find((m) => Math.abs(m.monto - Number(solicitud.monto_a_transferir)) < 0.005) ??
              null;

            return (
              <li key={solicitud.id}>
                <Card className="overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-bold text-ink-900">
                        {persona?.nombre || persona?.email || "Usuario"}
                      </p>
                      {persona?.nombre && (
                        <p className="truncate text-sm text-ink-600">{persona.email}</p>
                      )}
                      <p className="mt-1 text-sm text-ink-600">
                        {liga?.nombre} · {plan?.nombre ?? solicitud.plan_slug}
                      </p>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-pitch-700 hover:underline"
                        >
                          Ver comprobante
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      ) : (
                        <p className="mt-2 text-sm text-ink-400">Sin comprobante</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                        MONTO ESPERADO
                      </p>
                      <p className="font-display text-2xl font-bold tabular-nums text-pitch-700">
                        {formatearPesos(Number(solicitud.monto_a_transferir))}
                      </p>
                      {solicitud.comprobante_enviado_en && (
                        <p className="text-xs text-ink-400">
                          Enviado {formatearFecha(solicitud.comprobante_enviado_en)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-6 border-t border-line bg-chalk-50 px-6 py-5 lg:grid-cols-2">
                    <div>
                      <p className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                        LO QUE LEYÓ LA IA
                      </p>
                      {extraccion ? (
                        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                          <Dato etiqueta="Es comprobante" valor={extraccion.es_comprobante ? "Sí" : "No"} />
                          <Dato etiqueta="Monto" valor={extraccion.monto !== null ? formatearPesos(extraccion.monto) : null} />
                          <Dato
                            etiqueta="Fecha"
                            valor={
                              extraccion.fecha
                                ? `${extraccion.fecha}${extraccion.hora ? ` ${extraccion.hora}` : ""}`
                                : null
                            }
                          />
                          <Dato etiqueta="Remitente" valor={extraccion.remitente_nombre} />
                          <Dato etiqueta="Doc. remitente" valor={extraccion.remitente_documento} />
                          <Dato
                            etiqueta="Destinatario"
                            valor={
                              extraccion.destinatario_nombre ??
                              extraccion.destinatario_alias ??
                              extraccion.destinatario_cbu
                            }
                          />
                          <Dato etiqueta="N.º de operación" valor={extraccion.numero_operacion} />
                          <Dato etiqueta="Banco / billetera" valor={extraccion.banco_o_billetera} />
                          <Dato etiqueta="Confianza" valor={extraccion.confianza.toFixed(2)} />
                          {extraccion.senales_sospechosas.length > 0 && (
                            <Dato
                              etiqueta="Señales"
                              valor={extraccion.senales_sospechosas.join("; ")}
                            />
                          )}
                        </dl>
                      ) : (
                        <p className="mt-2 text-sm text-ink-600">
                          La IA no llegó a leer el comprobante.
                        </p>
                      )}
                      {solicitud.motivos.length > 0 && (
                        <p className="mt-3 text-xs text-amber-700">
                          Motivos: {solicitud.motivos.join(" · ")}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="font-mono text-[10px] font-semibold tracking-widest text-ink-400">
                        REGLAS DE VERIFICACIÓN
                      </p>
                      {solicitud.evaluacion ? (
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {solicitud.evaluacion.reglas.map((regla) => (
                            <li key={regla.codigo} className="flex items-start gap-2 text-sm">
                              {regla.ok ? (
                                <Check
                                  className="mt-0.5 h-4 w-4 shrink-0 text-pitch-600"
                                  strokeWidth={3}
                                  aria-label="Cumple"
                                />
                              ) : (
                                <X
                                  className="mt-0.5 h-4 w-4 shrink-0 text-coral-700"
                                  strokeWidth={3}
                                  aria-label="No cumple"
                                />
                              )}
                              <span className="text-ink-600">
                                <span className="font-semibold text-ink-900">{regla.nombre}.</span>{" "}
                                {regla.detalle}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-ink-600">
                          No se llegaron a evaluar las reglas.
                        </p>
                      )}
                      <p className="mt-3 text-xs text-ink-600">
                        {candidato
                          ? `Ingreso con ese monto en la cuenta: ${formatearFecha(candidato.fecha_acreditacion)}${
                              candidato.pagador_nombre ? ` · ${candidato.pagador_nombre}` : ""
                            }.`
                          : "No hay ningún ingreso libre con ese monto en la cuenta."}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-line px-6 py-4">
                    <AccionesPago
                      movimientos={opcionesMovimiento}
                      movimientoSugerido={candidato?.id ?? null}
                      aprobarAction={aprobarPago.bind(null, solicitud.id)}
                      rechazarAction={rechazarPago.bind(null, solicitud.id)}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {alertas.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-coral-700">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Alertas en la cuenta
          </p>
          <ul className="flex flex-col gap-2">
            {alertas.map((m) => (
              <li key={m.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 border-coral-500/40 p-4 text-sm">
                  <span className="font-semibold text-coral-700">
                    {ETIQUETA_ALERTA[m.alerta ?? ""] ?? m.alerta}
                  </span>
                  <span className="text-ink-600">
                    {formatearPesos(m.monto)} · {formatearFecha(m.fecha_acreditacion)} · #{m.mp_id}
                    {m.solicitud_id ? " · ya había acreditado prodes" : ""}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink-900">
          Ingresos sin solicitud asociada (últimos {DIAS_MOVIMIENTOS} días)
        </p>
        {libres.length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink-600">
            Todos los ingresos de la cuenta están asociados a un pago.
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {libres.map((m) => (
              <li key={m.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <span className="font-display font-bold tabular-nums text-ink-900">
                    {formatearPesos(m.monto)}
                  </span>
                  <span className="text-ink-600">
                    {formatearFecha(m.fecha_acreditacion)}
                    {m.pagador_nombre ? ` · ${m.pagador_nombre}` : ""} · #{m.mp_id} · {m.estado_mp}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <>
      <dt className="text-ink-400">{etiqueta}</dt>
      <dd className="break-words font-medium text-ink-900">{valor ?? "—"}</dd>
    </>
  );
}
