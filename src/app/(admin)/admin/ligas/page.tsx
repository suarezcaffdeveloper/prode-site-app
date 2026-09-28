import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  Pencil,
  Plus,
  Shield,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { LogoLiga } from "@/components/ui/logo-liga";
import { MarcadorActiva } from "@/components/ui/marcador";

type Gestion = {
  segmento: string;
  titulo: string;
  detalle: string;
  Icono: LucideIcon;
};

// Cada tarjeta de liga ofrece las mismas cuatro áreas de carga y gestión.
const GESTIONES: Gestion[] = [
  { segmento: "equipos", titulo: "Equipos", detalle: "Cargar y editar equipos", Icono: Shield },
  { segmento: "partidos", titulo: "Partidos", detalle: "Fixture y resultados", Icono: CalendarDays },
  { segmento: "usuarios", titulo: "Suscripciones", detalle: "Jugadores y planes", Icono: CreditCard },
  { segmento: "ganadores", titulo: "Ganadores", detalle: "Prodes y pozo", Icono: Trophy },
];

export default async function AdminLigasPage() {
  const supabase = await createClient();
  const { data: ligas } = await supabase
    .from("ligas")
    .select("id, nombre, descripcion, activa, logo_url")
    .order("created_at", { ascending: false });

  const total = ligas?.length ?? 0;
  const activas = ligas?.filter((liga) => liga.activa).length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            ADMINISTRACIÓN
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Ligas
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {total === 0
              ? "Creá la primera liga para empezar a cargar equipos y partidos."
              : `${total} ${total === 1 ? "liga" : "ligas"} · ${activas} ${activas === 1 ? "activa" : "activas"}`}
          </p>
        </div>
        <Link
          href="/admin/ligas/nueva"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-pitch-700 px-5 py-2.5 text-sm font-semibold tracking-tight text-chalk-0 transition-colors hover:bg-pitch-600"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva liga
        </Link>
      </div>

      {!ligas || ligas.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-16 text-center">
          <p className="font-display text-lg font-semibold text-ink-900">
            Todavía no creaste ninguna liga
          </p>
          <p className="text-sm text-ink-600">
            Usá el botón &ldquo;Nueva liga&rdquo; para crear la primera.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-5">
          {ligas.map((liga) => (
            <li key={liga.id}>
              <Card className="overflow-hidden">
                <div className="flex items-center gap-5 px-6 py-5">
                  <LogoLiga url={liga.logo_url} nombre={liga.nombre} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="truncate font-display text-xl font-bold tracking-tight text-ink-900">
                        {liga.nombre}
                      </h2>
                      <MarcadorActiva activa={liga.activa} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-600">
                      {liga.descripcion || "Sin descripción"}
                    </p>
                  </div>
                  <Link
                    href={`/admin/ligas/${liga.id}/editar`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line-strong bg-chalk-0 px-4 py-2 text-sm font-semibold tracking-tight text-ink-900 transition-colors hover:border-pitch-700 hover:text-pitch-700"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Editar liga
                  </Link>
                </div>

                <ul className="grid grid-cols-4 divide-x divide-line border-t border-line bg-chalk-50">
                  {GESTIONES.map(({ segmento, titulo, detalle, Icono }) => (
                    <li key={segmento}>
                      <Link
                        href={`/admin/ligas/${liga.id}/${segmento}`}
                        className="group flex h-full items-center gap-3 px-5 py-4 transition-colors hover:bg-chalk-0"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-chalk-0 text-pitch-700 transition-colors group-hover:border-pitch-500 group-hover:bg-pitch-700 group-hover:text-chalk-0">
                          <Icono className="h-[18px] w-[18px]" aria-hidden="true" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-semibold text-ink-900">
                            {titulo}
                          </span>
                          <span className="truncate text-xs text-ink-600">
                            {detalle}
                          </span>
                        </span>
                        <ArrowRight
                          className="h-4 w-4 shrink-0 text-ink-400 transition-all group-hover:translate-x-0.5 group-hover:text-pitch-700"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
