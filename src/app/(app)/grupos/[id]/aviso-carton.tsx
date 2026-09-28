import Link from "next/link";
import { Card } from "@/components/ui/card";

// Estado del prode del usuario para la fecha abierta: cuál compite en el
// subgrupo. Solo se muestra mientras la fecha se puede editar.
export function AvisoCarton({
  ligaId,
  jornada,
  cartones,
}: {
  ligaId: string;
  jornada: number;
  cartones: { esPrincipal: boolean }[];
}) {
  const indicePrincipal = cartones.findIndex((c) => c.esPrincipal);

  let mensaje: string;
  let accion: string;
  if (cartones.length === 0) {
    mensaje = `Todavía no cargaste un prode para la fecha ${jornada}. Si no cargás uno antes del cierre, sumás 0 puntos en esta fecha.`;
    accion = "Cargar mi prode";
  } else if (cartones.length === 1) {
    mensaje = `Tu prode de la fecha ${jornada} compite en este subgrupo.`;
    accion = "Ver mi prode";
  } else {
    mensaje = `Tenés ${cartones.length} prodes en la fecha ${jornada}. En el subgrupo compite tu prode #${indicePrincipal + 1}; podés cambiarlo hasta el cierre. Los demás siguen jugando por el pozo.`;
    accion = "Elegir cuál compite";
  }

  return (
    <Card className="flex flex-col gap-3 border-lime-400/60 bg-lime-400/10 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-mono text-[11px] font-semibold tracking-[0.25em] text-pitch-600">
          FECHA {jornada} ABIERTA
        </p>
        <p className="mt-1 text-sm text-ink-900">{mensaje}</p>
      </div>
      <Link
        href={`/ligas/${ligaId}/pronosticos`}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-pitch-700 px-5 text-sm font-semibold text-chalk-0 transition-colors hover:bg-pitch-600"
      >
        {accion}
      </Link>
    </Card>
  );
}
