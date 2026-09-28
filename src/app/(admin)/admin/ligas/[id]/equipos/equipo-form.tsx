"use client";

import { useActionState, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Escudo } from "@/components/ui/escudo";

type State = { error?: string };

export function EquipoForm({
  action,
  submitLabel,
  defaultValues,
  fullWidthSubmit = false,
}: {
  action: (prevState: State, formData: FormData) => Promise<State>;
  submitLabel: string;
  defaultValues?: { nombre?: string; escudoUrl?: string | null };
  fullWidthSubmit?: boolean;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});
  const [seleccion, setSeleccion] = useState<{ nombre: string; url: string } | null>(
    null,
  );

  function elegirArchivo(archivo: File | undefined) {
    if (seleccion) URL.revokeObjectURL(seleccion.url);
    setSeleccion(
      archivo ? { nombre: archivo.name, url: URL.createObjectURL(archivo) } : null,
    );
  }

  const escudoActual = seleccion?.url ?? defaultValues?.escudoUrl ?? null;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field
        label="Nombre"
        name="nombre"
        required
        defaultValue={defaultValues?.nombre}
        placeholder="River Plate"
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-900">
          Escudo
          <span className="ml-1 font-normal text-ink-400">(opcional)</span>
        </span>
        <label
          htmlFor="escudo"
          className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-line-strong bg-chalk-50 p-3.5 transition-colors hover:border-pitch-500 hover:bg-chalk-0 has-[:focus-visible]:border-pitch-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pitch-500/30"
        >
          {escudoActual ? (
            <Escudo
              url={escudoActual}
              nombre={defaultValues?.nombre ?? ""}
              className="h-14 w-14"
            />
          ) : (
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line-strong bg-chalk-0 text-ink-400"
              aria-hidden="true"
            >
              <ImagePlus className="h-6 w-6" />
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-pitch-700">
              {escudoActual ? "Cambiar imagen" : "Subir imagen"}
            </span>
            <span className="truncate text-xs text-ink-600">
              {seleccion ? seleccion.nombre : "PNG o JPG, cuadrada si es posible"}
            </span>
          </span>
          <input
            id="escudo"
            name="escudo"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => elegirArchivo(event.target.files?.[0])}
          />
        </label>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        loading={pending}
        className={fullWidthSubmit ? "w-full" : "self-start"}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
