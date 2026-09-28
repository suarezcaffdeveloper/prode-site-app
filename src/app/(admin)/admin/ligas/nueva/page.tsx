import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LigaForm } from "../liga-form";
import { crearLiga } from "../actions";

export default function NuevaLigaPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/ligas"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-pitch-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Todas las ligas
        </Link>
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            ADMINISTRACIÓN
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Nueva liga
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            Después de crearla vas a poder cargar equipos, partidos y suscripciones.
          </p>
        </div>
      </div>
      <Card className="p-8">
        <LigaForm action={crearLiga} submitLabel="Crear liga" />
      </Card>
    </div>
  );
}
