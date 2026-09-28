"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CalendarX,
  Clock,
  CirclePlay,
  CreditCard,
  Target,
  Ticket,
  TicketX,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notificacion, TipoNotificacion } from "@/lib/notificaciones";
import {
  cargarNotificaciones,
  marcarNotificacionesLeidas,
} from "@/lib/notificaciones-actions";

const ICONOS: Record<TipoNotificacion, { icono: LucideIcon; tono: string }> = {
  ganaste: { icono: Trophy, tono: "bg-lime-300 text-pitch-900" },
  sin_premio: { icono: Target, tono: "bg-chalk-100 text-pitch-700" },
  ultimo_prode: { icono: Ticket, tono: "bg-amber-500/15 text-amber-700" },
  sin_prodes: { icono: TicketX, tono: "bg-coral-500/15 text-coral-700" },
  jornada_abierta: { icono: CirclePlay, tono: "bg-pitch-900 text-lime-300" },
  plan_acreditado: { icono: CreditCard, tono: "bg-pitch-600/10 text-pitch-700" },
  cierra_pronto: { icono: Clock, tono: "bg-amber-500/15 text-amber-700" },
  creditos_por_vencer: { icono: CalendarClock, tono: "bg-amber-500/15 text-amber-700" },
  suscripcion_vencida: { icono: CalendarX, tono: "bg-coral-500/15 text-coral-700" },
  pago_en_revision: { icono: Clock, tono: "bg-amber-500/15 text-amber-700" },
  pago_rechazado: { icono: CalendarX, tono: "bg-coral-500/15 text-coral-700" },
};

function tiempoRelativo(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `hace ${dias} d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function CampanaNotificaciones({
  usuarioId,
  iniciales,
}: {
  usuarioId: string;
  iniciales: Notificacion[];
}) {
  const [items, setItems] = useState(iniciales);
  const [abierto, setAbierto] = useState(false);
  const [nuevas, setNuevas] = useState<Set<string>>(new Set());
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const primeraCarga = useRef(true);
  const pathname = usePathname();

  const sinLeer = items.filter((n) => !n.leida).length;

  // El layout no se vuelve a renderizar en navegaciones internas, así que la
  // lista se recarga cuando llega un aviso en tiempo real, al cambiar de ruta
  // y al volver a la pestaña (respaldo por si se cae la conexión).
  const refrescar = useEffectEvent(async () => {
    try {
      const datos = await cargarNotificaciones();
      if (!abierto) {
        setItems(datos);
        return;
      }
      // Con el globito abierto, lo que llega se ve como nuevo y ya se marca leído.
      const recien = datos.filter((n) => !n.leida).map((n) => n.id);
      setItems(datos.map((n) => ({ ...n, leida: true })));
      if (recien.length > 0) {
        setNuevas((prev) => new Set([...prev, ...recien]));
        void marcarNotificacionesLeidas();
      }
    } catch {
      // Si falla la recarga se conserva lo que ya se veía.
    }
  });

  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    void refrescar();
  }, [pathname]);

  useEffect(() => {
    function alVolver() {
      if (document.visibilityState === "visible") void refrescar();
    }
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;

    // Realtime necesita el JWT del usuario para aplicar RLS a los eventos.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelado) return;
      supabase.realtime.setAuth(data.session?.access_token ?? null);
      canal = supabase
        .channel(`notificaciones:${usuarioId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notificaciones",
            filter: `usuario_id=eq.${usuarioId}`,
          },
          () => void refrescar(),
        )
        .subscribe();
    });

    return () => {
      cancelado = true;
      if (canal) supabase.removeChannel(canal);
    };
  }, [usuarioId]);

  useEffect(() => {
    if (!abierto) return;

    function alTocarAfuera(evento: PointerEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAbierto(false);
        boton.current?.focus();
      }
    }
    document.addEventListener("pointerdown", alTocarAfuera);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("pointerdown", alTocarAfuera);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  function alternar() {
    if (abierto) {
      setAbierto(false);
      return;
    }
    const pendientes = items.filter((n) => !n.leida);
    setNuevas(new Set(pendientes.map((n) => n.id)));
    setAbierto(true);
    if (pendientes.length > 0) {
      setItems((actuales) => actuales.map((n) => ({ ...n, leida: true })));
      void marcarNotificacionesLeidas();
    }
  }

  return (
    <div ref={contenedor} className="sm:relative">
      <button
        ref={boton}
        type="button"
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls="panel-notificaciones"
        aria-label={
          sinLeer > 0 ? `Notificaciones, ${sinLeer} sin leer` : "Notificaciones"
        }
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-chalk-100 hover:text-pitch-700 ${
          abierto ? "bg-chalk-100 text-pitch-700" : "text-ink-400"
        }`}
      >
        <Bell
          className={`h-5 w-5 origin-top ${sinLeer > 0 && !abierto ? "animate-bell" : ""}`}
          aria-hidden="true"
        />
        {sinLeer > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4" aria-hidden="true">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-coral-500" />
            <span className="relative flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-500 px-1 text-[10px] font-bold leading-none text-white">
              {sinLeer > 9 ? "9+" : sinLeer}
            </span>
          </span>
        )}
      </button>

      {abierto && (
        <div
          id="panel-notificaciones"
          role="dialog"
          aria-label="Notificaciones"
          className="absolute inset-x-4 top-full z-40 mt-2 origin-top-right animate-globito rounded-2xl border border-line bg-chalk-0 shadow-[0_12px_40px_rgba(16,36,26,0.16)] sm:left-auto sm:right-[-0.5rem] sm:mt-3 sm:w-[22rem]"
        >
          <span
            aria-hidden="true"
            className="absolute -top-1.5 right-5 hidden h-3 w-3 rotate-45 border-l border-t border-line bg-chalk-0 sm:block"
          />

          <div className="border-b border-line px-4 py-3">
            <p className="font-display text-sm font-bold text-ink-900">Notificaciones</p>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Bell className="h-6 w-6 text-ink-400" aria-hidden="true" />
              <p className="text-sm text-ink-600">Todavía no tenés novedades.</p>
            </div>
          ) : (
            <ul className="max-h-[min(24rem,70vh)] divide-y divide-line overflow-y-auto overflow-x-hidden rounded-b-2xl">
              {items.map((n) => {
                const { icono: Icono, tono } = ICONOS[n.tipo];
                const esNueva = nuevas.has(n.id);
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setAbierto(false)}
                      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-chalk-50 ${
                        esNueva ? "bg-lime-300/15" : ""
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tono}`}
                      >
                        <Icono className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        {n.ligaNombre && (
                          <span className="block truncate text-[11px] font-medium uppercase tracking-wide text-ink-400">
                            {n.ligaNombre}
                          </span>
                        )}
                        <span className="block font-display text-sm font-bold text-ink-900">
                          {n.titulo}
                        </span>
                        <span className="block text-sm text-ink-600">{n.texto}</span>
                        <span className="mt-1 block text-xs text-ink-400">
                          {tiempoRelativo(n.creadaEn)}
                        </span>
                      </span>
                      {esNueva && (
                        <span
                          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-pitch-500"
                          role="img"
                          aria-label="Nueva"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
