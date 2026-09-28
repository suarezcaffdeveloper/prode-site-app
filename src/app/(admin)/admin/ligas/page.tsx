import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarcadorActiva } from "@/components/ui/marcador";

export default async function AdminLigasPage() {
  const supabase = await createClient();
  const { data: ligas } = await supabase
    .from("ligas")
    .select("id, nombre, descripcion, activa")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            ADMINISTRACIÓN
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
            Ligas
          </h1>
        </div>
        <Link href="/admin/ligas/nueva">
          <Button>+ Nueva liga</Button>
        </Link>
      </div>

      {!ligas || ligas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-600">
          Todavía no creaste ninguna liga.
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {ligas.map((liga) => (
            <li key={liga.id}>
              <Card className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold text-ink-900">
                    {liga.nombre}
                  </p>
                  {liga.descripcion && (
                    <p className="truncate text-sm text-ink-600">
                      {liga.descripcion}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <MarcadorActiva activa={liga.activa} />
                  <Link
                    href={`/admin/ligas/${liga.id}/editar`}
                    className="text-sm font-medium text-pitch-700 hover:underline"
                  >
                    Editar
                  </Link>
                  <Link
                    href={`/admin/ligas/${liga.id}/equipos`}
                    className="text-sm font-medium text-pitch-700 hover:underline"
                  >
                    Equipos
                  </Link>
                  <Link
                    href={`/admin/ligas/${liga.id}/partidos`}
                    className="text-sm font-medium text-pitch-700 hover:underline"
                  >
                    Partidos
                  </Link>
                  <Link
                    href={`/admin/ligas/${liga.id}/usuarios`}
                    className="text-sm font-medium text-pitch-700 hover:underline"
                  >
                    Suscripciones
                  </Link>
                  <Link
                    href={`/admin/ligas/${liga.id}/ganadores`}
                    className="text-sm font-medium text-pitch-700 hover:underline"
                  >
                    Ganadores
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
