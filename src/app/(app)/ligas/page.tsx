import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export default async function LigasPage() {
  const supabase = await createClient();
  const { data: ligas } = await supabase
    .from("ligas")
    .select("id, nombre, descripcion")
    .eq("activa", true)
    .order("nombre");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          CATÁLOGO
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Ligas disponibles
        </h1>
      </div>

      {!ligas || ligas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-600">
          Todavía no hay ligas activas. Volvé a revisar más adelante.
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {ligas.map((liga) => (
            <li key={liga.id}>
              <Link href={`/ligas/${liga.id}`}>
                <Card className="flex h-full flex-col gap-2 p-6 transition-colors hover:border-pitch-500">
                  <p className="font-display text-lg font-semibold text-ink-900">
                    {liga.nombre}
                  </p>
                  {liga.descripcion && (
                    <p className="text-sm text-ink-600">{liga.descripcion}</p>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
