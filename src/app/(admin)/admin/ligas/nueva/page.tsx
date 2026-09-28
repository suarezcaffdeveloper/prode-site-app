import { Card } from "@/components/ui/card";
import { LigaForm } from "../liga-form";
import { crearLiga } from "../actions";

export default function NuevaLigaPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          ADMINISTRACIÓN
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Nueva liga
        </h1>
      </div>
      <Card className="p-6">
        <LigaForm action={crearLiga} submitLabel="Crear liga" />
      </Card>
    </div>
  );
}
