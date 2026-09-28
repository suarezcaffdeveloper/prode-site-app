import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Info, KeyRound, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { obtenerMembresia } from "@/lib/suscripcion";
import { Card } from "@/components/ui/card";
import { MarcadorEstado, MarcadorCodigo } from "@/components/ui/marcador";
import { Reveal } from "@/components/landing/reveal";
import { PLANES, formatearPrecio, precioPorProde } from "@/lib/planes";
import { crearGrupo, unirseAGrupo } from "../actions";
import { CrearGrupoForm, UnirseGrupoForm } from "../grupo-forms";
import { PlanesSuscripcion } from "../planes-suscripcion";
import { PlanesHero, type DatoHero } from "./planes-hero";

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

  const membresia = await obtenerMembresia(supabase, id, user!.id);

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

  const cantidadGrupos = misGrupos?.length ?? 0;
  const mejorPrecioPorProde = Math.round(Math.min(...PLANES.map(precioPorProde)));

  const datosHero: DatoHero[] = tieneSuscripcionActiva
    ? [
        {
          etiqueta: "TUS SUBGRUPOS",
          valor: String(cantidadGrupos),
          detalle: cantidadGrupos === 0 ? "Creá uno o unite con un código." : undefined,
        },
      ]
    : [
        { etiqueta: "PLANES", valor: String(PLANES.length), detalle: "Para elegir" },
        {
          etiqueta: "DESDE",
          valor: `${formatearPrecio(mejorPrecioPorProde)}`,
          detalle: "Por prode, en el mejor plan",
        },
      ];

  const ctaHero = tieneSuscripcionActiva
    ? { href: "#planes", etiqueta: "Sumar más prodes" }
    : membresia?.estado_suscripcion === "pendiente"
      ? null
      : { href: "#planes", etiqueta: "Ver los planes" };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 lg:max-w-none lg:gap-12">
      <PlanesHero
        ligaNombre={liga.nombre}
        membresia={membresia?.estado_suscripcion ?? null}
        cta={ctaHero}
        datos={datosHero}
      />

      <div className="lg:hidden">
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {liga.nombre.toUpperCase()}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Planes
        </h1>
      </div>

      <Card className="flex flex-col gap-4 p-5 lg:hidden">
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
        <div id="subgrupos" className="flex scroll-mt-40 flex-col gap-6 lg:gap-8">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
              SUBGRUPOS
            </p>
            <h2 className="font-display text-xl font-bold tracking-tight text-ink-900 lg:text-3xl">
              Tus subgrupos en esta liga
            </h2>
            <p className="mt-2 hidden text-base text-ink-600 lg:block">
              Competí con tus amigos, tu oficina o tu familia. Cada subgrupo tiene su propio
              código de invitación.
            </p>
          </div>

          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
            {misGrupos && misGrupos.length > 0 ? (
              <ul className="flex flex-col gap-3 lg:col-span-7 lg:gap-4">
                {misGrupos.map((grupo, indice) => (
                  <li key={grupo.id}>
                    <Reveal soloEscritorio retraso={indice * 80}>
                      <Link href={`/grupos/${grupo.id}`} className="group block">
                        <Card className="flex items-center justify-between gap-4 p-5 transition-all hover:border-pitch-500 lg:gap-5 lg:p-6 lg:hover:-translate-y-1 lg:hover:shadow-[0_16px_36px_rgba(16,36,26,0.10)]">
                          <span
                            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pitch-900 font-display text-lg font-bold text-lime-300 lg:flex"
                            aria-hidden="true"
                          >
                            {grupo.nombre.charAt(0).toUpperCase()}
                          </span>
                          <p className="min-w-0 flex-1 truncate font-medium text-ink-900 lg:text-lg">
                            {grupo.nombre}
                          </p>
                          <MarcadorCodigo codigo={grupo.codigo_invitacion} />
                          <ArrowRight
                            className="hidden h-5 w-5 shrink-0 text-ink-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-pitch-700 lg:block"
                            aria-hidden="true"
                          />
                        </Card>
                      </Link>
                    </Reveal>
                  </li>
                ))}
              </ul>
            ) : (
              <Card className="hidden flex-col items-center gap-3 border-dashed border-line-strong p-12 text-center lg:col-span-7 lg:flex">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-lime-400/25 text-pitch-700"
                  aria-hidden="true"
                >
                  <Users className="h-6 w-6" />
                </span>
                <p className="font-display text-lg font-bold text-ink-900">
                  Todavía no estás en ningún subgrupo
                </p>
                <p className="max-w-sm text-sm text-ink-600">
                  Creá uno nuevo y compartí el código, o unite a uno con el código que te
                  pasaron.
                </p>
              </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 lg:gap-6">
              <Reveal soloEscritorio variante="right">
                <Card className="p-6 lg:p-7 lg:transition-all lg:hover:border-pitch-500 lg:hover:shadow-[0_16px_36px_rgba(16,36,26,0.08)]">
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pitch-900 text-lime-300 lg:flex"
                      aria-hidden="true"
                    >
                      <Users className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-semibold text-ink-900 lg:text-base">
                      Crear un subgrupo nuevo
                    </p>
                  </div>
                  <CrearGrupoForm action={crearGrupo.bind(null, liga.id)} />
                </Card>
              </Reveal>
              <Reveal soloEscritorio variante="right" retraso={100}>
                <Card className="p-6 lg:p-7 lg:transition-all lg:hover:border-pitch-500 lg:hover:shadow-[0_16px_36px_rgba(16,36,26,0.08)]">
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pitch-900 text-lime-300 lg:flex"
                      aria-hidden="true"
                    >
                      <KeyRound className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-semibold text-ink-900 lg:text-base">
                      Unirme con un código
                    </p>
                  </div>
                  <UnirseGrupoForm action={unirseAGrupo.bind(null, liga.id)} />
                </Card>
              </Reveal>
            </div>
          </div>
        </div>
      )}

      {tieneSuscripcionActiva && <PlanesSuscripcion ligaId={liga.id} recompra />}
    </div>
  );
}
