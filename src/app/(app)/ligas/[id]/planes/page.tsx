import Link from "next/link";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { MarcadorEstado, MarcadorCodigo } from "@/components/ui/marcador";
import { crearGrupo, unirseAGrupo } from "../actions";
import { CrearGrupoForm, UnirseGrupoForm } from "../grupo-forms";
import { PlanesSuscripcion } from "../planes-suscripcion";

export default async function LigaPlanesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: liga } = await supabase
    .from("ligas")
    .select("id, nombre, descripcion, activa")
    .eq("id", id)
    .single();

  if (!liga || !liga.activa) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membresia } = await supabase
    .from("membresias_liga")
    .select("estado_suscripcion")
    .eq("liga_id", id)
    .eq("usuario_id", user!.id)
    .maybeSingle();

  const tieneSuscripcionActiva = membresia?.estado_suscripcion === "activa";

  // RLS en "grupos" ya limita el resultado a los subgrupos donde el usuario
  // es creador o miembro (ver policy grupos_select_miembro_o_admin), así que
  // este select no necesita un filtro adicional de membresía.
  const { data: misGrupos } = tieneSuscripcionActiva
    ? await supabase
        .from("grupos")
        .select("id, nombre, codigo_invitacion")
        .eq("liga_id", id)
    : { data: null };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {liga.nombre.toUpperCase()}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Planes
        </h1>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-400/25 text-pitch-700"
              aria-hidden="true"
            >
              <Info className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium text-ink-900">Tu suscripción</p>
          </div>
          {membresia && <MarcadorEstado estado={membresia.estado_suscripcion} />}
        </div>

        {!membresia && (
          <p className="text-sm text-ink-600">
            Todavía no elegiste un plan para esta liga. Seleccioná una opción
            para empezar a pronosticar.
          </p>
        )}

        {membresia?.estado_suscripcion === "pendiente" && (
          <p className="rounded-lg bg-amber-500/10 p-4 text-sm text-amber-700">
            Ya recibimos tu comprobante y lo estamos revisando. En cuanto lo
            confirmemos, tu suscripción pasa a <strong>activa</strong> y vas a
            poder cargar tus pronósticos y crear o unirte a subgrupos.
          </p>
        )}

        {membresia?.estado_suscripcion === "inactiva" && (
          <p className="rounded-lg bg-coral-500/10 p-4 text-sm text-coral-700">
            Tu suscripción está inactiva. Elegí un plan de nuevo y subí el
            comprobante para reactivarla.
          </p>
        )}
      </Card>

      {!tieneSuscripcionActiva && <PlanesSuscripcion ligaId={liga.id} />}

      {tieneSuscripcionActiva && (
        <div id="subgrupos" className="flex scroll-mt-6 flex-col gap-6">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
              SUBGRUPOS
            </p>
            <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">
              Tus subgrupos en esta liga
            </h2>
          </div>

          {misGrupos && misGrupos.length > 0 && (
            <ul className="flex flex-col gap-3">
              {misGrupos.map((grupo) => (
                <li key={grupo.id}>
                  <Link href={`/grupos/${grupo.id}`}>
                    <Card className="flex items-center justify-between gap-4 p-5 transition-colors hover:border-pitch-500">
                      <p className="font-medium text-ink-900">{grupo.nombre}</p>
                      <MarcadorCodigo codigo={grupo.codigo_invitacion} />
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-6">
              <p className="mb-3 text-sm font-semibold text-ink-900">
                Crear un subgrupo nuevo
              </p>
              <CrearGrupoForm action={crearGrupo.bind(null, liga.id)} />
            </Card>
            <Card className="p-6">
              <p className="mb-3 text-sm font-semibold text-ink-900">
                Unirme con un código
              </p>
              <UnirseGrupoForm action={unirseAGrupo.bind(null, liga.id)} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
