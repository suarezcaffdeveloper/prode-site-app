import { Card } from "@/components/ui/card";
import { MarcadorActiva } from "@/components/ui/marcador";
import type { MiembroGrupo } from "@/lib/puntos-grupo";
import { EcharMiembroBoton } from "./gestion-creador";

export type MiembroConMembresia = MiembroGrupo & { membresiaId: string };

function fechaIngreso(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MiembrosGrupo({
  miembros,
  usuarioActualId,
  esCreador,
  echar,
}: {
  miembros: MiembroConMembresia[];
  usuarioActualId: string;
  esCreador: boolean;
  // Acción ya enlazada al grupo y a la membresía (solo la usa el creador).
  echar: (membresiaId: string) => () => Promise<void>;
}) {
  return (
    <Card className="overflow-hidden">
      <ul>
        {miembros.map((miembro) => {
          const esYo = miembro.usuarioId === usuarioActualId;
          return (
            <li
              key={miembro.membresiaId}
              className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0 lg:px-6 lg:py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900 lg:text-base">
                  {miembro.nombre}
                  {esYo && (
                    <span className="ml-2 font-mono text-[10px] font-semibold tracking-widest text-pitch-600">
                      VOS
                    </span>
                  )}
                  {miembro.esCreador && (
                    <span className="ml-2 text-xs font-normal text-ink-400">(creador)</span>
                  )}
                </p>
                <p className="text-xs text-ink-400">Se unió el {fechaIngreso(miembro.unidoEn)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <MarcadorActiva activa={miembro.activo} />
                {esCreador && !miembro.esCreador && (
                  <EcharMiembroBoton
                    nombre={miembro.nombre}
                    action={echar(miembro.membresiaId)}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
