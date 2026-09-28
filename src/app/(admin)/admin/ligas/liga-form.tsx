"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type State = { error?: string };

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function LigaForm({
  action,
  submitLabel,
  defaultValues,
  showActivaToggle,
}: {
  action: (prevState: State, formData: FormData) => Promise<State>;
  submitLabel: string;
  defaultValues?: {
    nombre?: string;
    descripcion?: string | null;
    activa?: boolean;
    logoUrl?: string | null;
  };
  showActivaToggle?: boolean;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});
  const inputLogoRef = useRef<HTMLInputElement>(null);
  const [seleccion, setSeleccion] = useState<{ nombre: string; url: string } | null>(null);
  const [quitarLogo, setQuitarLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState<string>();

  function limpiarSeleccion() {
    if (seleccion) URL.revokeObjectURL(seleccion.url);
    setSeleccion(null);
    if (inputLogoRef.current) inputLogoRef.current.value = "";
  }

  function elegirLogo(archivo: File | undefined) {
    setErrorLogo(undefined);
    if (!archivo) {
      limpiarSeleccion();
      return;
    }
    if (archivo.size > MAX_LOGO_BYTES) {
      limpiarSeleccion();
      setErrorLogo("El logo no puede pesar más de 2 MB.");
      return;
    }
    if (seleccion) URL.revokeObjectURL(seleccion.url);
    setQuitarLogo(false);
    setSeleccion({ nombre: archivo.name, url: URL.createObjectURL(archivo) });
  }

  const logoActual = quitarLogo ? null : (seleccion?.url ?? defaultValues?.logoUrl ?? null);

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-900">
          Logo
          <span className="ml-1 font-normal text-ink-400">(opcional)</span>
        </span>
        <div className="flex items-center gap-3">
          <label
            htmlFor="logo"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 rounded-xl border border-dashed border-line-strong bg-chalk-50 p-3.5 transition-colors hover:border-pitch-500 hover:bg-chalk-0 has-[:focus-visible]:border-pitch-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pitch-500/30"
          >
            {logoActual ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL de Storage o blob local, sin dominio fijo para next/image.
              <img
                src={logoActual}
                alt="Logo de la liga"
                className="h-16 w-16 shrink-0 rounded-xl border border-line bg-chalk-0 object-contain p-1"
              />
            ) : (
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-chalk-0 text-ink-400"
                aria-hidden="true"
              >
                <ImagePlus className="h-6 w-6" />
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-pitch-700">
                {logoActual ? "Cambiar logo" : "Subir logo"}
              </span>
              <span className="truncate text-xs text-ink-600">
                {seleccion
                  ? seleccion.nombre
                  : "PNG, JPG, WEBP o GIF · hasta 2 MB · mejor si es cuadrado"}
              </span>
            </span>
            <input
              ref={inputLogoRef}
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => elegirLogo(event.target.files?.[0])}
            />
          </label>
          {logoActual && (
            <Button
              type="button"
              variant="danger-soft"
              size="sm"
              onClick={() => {
                limpiarSeleccion();
                setQuitarLogo(true);
              }}
            >
              Quitar
            </Button>
          )}
          {quitarLogo && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setQuitarLogo(false)}>
              Deshacer
            </Button>
          )}
        </div>
        {quitarLogo && <input type="hidden" name="quitar_logo" value="1" />}
        {errorLogo && (
          <p role="alert" className="text-xs font-medium text-coral-700">
            {errorLogo}
          </p>
        )}
      </div>
      <Field
        label="Nombre"
        name="nombre"
        required
        defaultValue={defaultValues?.nombre}
        placeholder="Liga de los Viernes"
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="descripcion" className="text-sm font-medium text-ink-900">
          Descripción
          <span className="ml-1 font-normal text-ink-400">(opcional)</span>
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          defaultValue={defaultValues?.descripcion ?? ""}
          placeholder="Contá de qué se trata la liga: torneo, categoría, fechas…"
          className="resize-y rounded-lg border border-line-strong bg-chalk-0 px-3.5 py-2.5 text-sm text-ink-900 transition-colors placeholder:text-ink-400 focus-visible:border-pitch-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-500/30"
        />
        <p className="text-xs text-ink-600">Se muestra a los jugadores en el catálogo de ligas.</p>
      </div>
      {showActivaToggle && (
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line-strong bg-chalk-50 p-4 transition-colors hover:border-pitch-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pitch-500/30">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink-900">Liga activa</span>
            <span className="text-xs text-ink-600">
              Si está activa, se muestra en el catálogo y los jugadores pueden entrar.
            </span>
          </span>
          <input
            type="checkbox"
            name="activa"
            defaultChecked={defaultValues?.activa}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-11 shrink-0 rounded-full bg-ink-400/40 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-chalk-0 after:shadow-sm after:transition-transform peer-checked:bg-pitch-700 peer-checked:after:translate-x-5"
          />
        </label>
      )}
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3 border-t border-line pt-6">
        <Link
          href="/admin/ligas"
          className="inline-flex items-center justify-center rounded-lg border border-line-strong bg-chalk-0 px-5 py-2.5 text-sm font-semibold tracking-tight text-ink-900 transition-colors hover:border-pitch-700 hover:text-pitch-700"
        >
          Cancelar
        </Link>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
