"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  ImagePlus,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DATOS_TRANSFERENCIA,
  formatearPrecio,
  precioPorProde,
  type Plan,
} from "@/lib/planes";
import { elegirPlan } from "./actions";

type State = { error?: string; success?: boolean };

const TAMANIO_MAXIMO = 5 * 1024 * 1024;

type DatoCopiable = { clave: string; etiqueta: string; mostrar: string; copiar?: string };

function formatearTamanio(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const auxiliar = document.createElement("textarea");
      auxiliar.value = texto;
      auxiliar.style.position = "fixed";
      auxiliar.style.opacity = "0";
      document.body.appendChild(auxiliar);
      auxiliar.select();
      const copiado = document.execCommand("copy");
      document.body.removeChild(auxiliar);
      return copiado;
    } catch {
      return false;
    }
  }
}

export function CheckoutPlan({
  ligaId,
  plan,
  onClose,
}: {
  ligaId: string;
  plan: Plan;
  onClose: () => void;
}) {
  useEffect(() => {
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") onClose();
    }
    window.addEventListener("keydown", alPresionarTecla);

    return () => {
      document.body.style.overflow = overflowPrevio;
      window.removeEventListener("keydown", alPresionarTecla);
    };
  }, [onClose]);

  const [state, formAction, pending] = useActionState<State, FormData>(
    elegirPlan.bind(null, ligaId, plan.slug),
    {},
  );

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  const [copiado, setCopiado] = useState<string | null>(null);
  const temporizadorCopiado = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizadorCopiado.current) clearTimeout(temporizadorCopiado.current);
    },
    [],
  );

  async function copiar(dato: DatoCopiable) {
    if (dato.copiar === undefined) return;
    const ok = await copiarAlPortapapeles(dato.copiar);
    if (!ok) return;
    setCopiado(dato.clave);
    if (temporizadorCopiado.current) clearTimeout(temporizadorCopiado.current);
    temporizadorCopiado.current = setTimeout(() => setCopiado(null), 2000);
  }

  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!archivo) {
      setVistaPrevia(null);
      return;
    }
    const url = URL.createObjectURL(archivo);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  function elegirArchivo(elegido: File | null) {
    if (!elegido) return;
    if (!elegido.type.startsWith("image/")) {
      setErrorArchivo("El archivo debe ser una imagen.");
      return;
    }
    if (elegido.size > TAMANIO_MAXIMO) {
      setErrorArchivo("La imagen es demasiado pesada (máximo 5 MB).");
      return;
    }
    setErrorArchivo(null);
    setArchivo(elegido);
  }

  function soltarArchivo(evento: React.DragEvent<HTMLLabelElement>) {
    evento.preventDefault();
    setArrastrando(false);
    elegirArchivo(evento.dataTransfer.files[0] ?? null);
  }

  // Se arma el FormData a mano: React 19 vacía los inputs no controlados
  // (incluido el de archivo) al terminar una acción de formulario.
  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!archivo) return;
    const formData = new FormData();
    formData.set("comprobante", archivo);
    iniciarEnvio(() => formAction(formData));
  }

  const datos: DatoCopiable[] = [
    {
      clave: "monto",
      etiqueta: "MONTO",
      mostrar: formatearPrecio(plan.precio),
    },
    {
      clave: "alias",
      etiqueta: "ALIAS",
      mostrar: DATOS_TRANSFERENCIA.alias,
      copiar: DATOS_TRANSFERENCIA.alias,
    },
    {
      clave: "cbu",
      etiqueta: "CBU",
      mostrar: DATOS_TRANSFERENCIA.cbu,
      copiar: DATOS_TRANSFERENCIA.cbu,
    },
    {
      clave: "titular",
      etiqueta: "TITULAR",
      mostrar: DATOS_TRANSFERENCIA.titular,
    },
  ];

  const pasos = [
    "Transferí el monto exacto a la cuenta de abajo.",
    "Subí la captura o foto del comprobante.",
    "Revisamos el pago y acreditamos tus prodes.",
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/60 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Comprar ${plan.nombre}`}
        onClick={(evento) => evento.stopPropagation()}
        className="flex max-h-[94vh] w-full animate-pop-in flex-col overflow-hidden rounded-t-3xl border border-line bg-chalk-0 shadow-[0_30px_80px_rgba(11,31,20,0.35)] sm:max-h-[90vh] sm:max-w-xl sm:rounded-3xl"
      >
        <div className="relative shrink-0 overflow-hidden bg-pitch-900 px-6 pb-6 pt-6 text-chalk-0 sm:px-8 sm:pb-7 sm:pt-7">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lime-400/25 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(245,247,242,0.05) 0, rgba(245,247,242,0.05) 1px, transparent 1px, transparent 72px)",
            }}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-chalk-0/10 text-chalk-0/80 transition-colors hover:bg-chalk-0/20 hover:text-chalk-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="relative">
            <p className="font-mono text-[11px] font-semibold tracking-[0.3em] text-lime-300">
              CONFIRMAR PLAN
            </p>
            <h3 className="mt-2 font-display text-xl font-bold tracking-tight sm:text-2xl">
              {plan.nombre}
            </h3>
            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="font-display text-4xl font-bold tracking-tight text-lime-300 sm:text-5xl">
                {formatearPrecio(plan.precio)}
              </p>
              <p className="pb-1.5 text-sm text-chalk-0/60">
                {plan.tipo === "unico" ? "pago único" : "por 30 días"}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-chalk-0/10 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest">
                {plan.cantidadCreditos} {plan.cantidadCreditos === 1 ? "PRODE" : "PRODES"}
              </span>
              <span className="rounded-md bg-chalk-0/10 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest">
                {formatearPrecio(Math.round(precioPorProde(plan)))} POR PRODE
              </span>
              <span className="rounded-md bg-chalk-0/10 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest">
                {plan.tipo === "unico" ? "NO VENCE" : "VENCE A LOS 30 DÍAS"}
              </span>
            </div>
          </div>
        </div>

        <form
          onSubmit={enviar}
          noValidate
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <div className="flex shrink-0 flex-col gap-7 px-6 py-6 sm:px-8 sm:py-7">
            <section aria-labelledby="checkout-como-funciona">
              <p
                id="checkout-como-funciona"
                className="font-mono text-[11px] font-semibold tracking-[0.3em] text-pitch-600"
              >
                CÓMO FUNCIONA
              </p>
              <ol className="mt-3 flex flex-col gap-3">
                {pasos.map((paso, indice) => (
                  <li key={paso} className="flex items-start gap-3 text-sm text-ink-600">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pitch-900 font-mono text-[11px] font-bold text-lime-300"
                      aria-hidden="true"
                    >
                      {indice + 1}
                    </span>
                    <span className="pt-0.5">{paso}</span>
                  </li>
                ))}
              </ol>
              <ul className="mt-4 flex flex-col gap-2 rounded-xl bg-chalk-50 p-4 text-[13px] leading-relaxed text-ink-600">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pitch-600" strokeWidth={3} aria-hidden="true" />
                  <span>
                    Cada prode es un pronóstico completo de la próxima fecha habilitada. Podés
                    cargar más de uno en la misma fecha, con resultados distintos.
                  </span>
                </li>
                {plan.tipo === "mensual" && (
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pitch-600" strokeWidth={3} aria-hidden="true" />
                    <span>
                      Tus {plan.cantidadCreditos} prodes duran 30 días desde la compra. Si una
                      fecha se suspende y se reprograma, no perdés ese prode: lo jugás en la
                      fecha reprogramada.
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pitch-600" strokeWidth={3} aria-hidden="true" />
                  <span>Podés volver a comprar cuando quieras: los prodes nuevos se suman al saldo.</span>
                </li>
              </ul>
            </section>

            <section aria-labelledby="checkout-datos">
              <div className="flex items-baseline justify-between gap-3">
                <p
                  id="checkout-datos"
                  className="font-mono text-[11px] font-semibold tracking-[0.3em] text-pitch-600"
                >
                  DATOS PARA TRANSFERIR
                </p>
                <p className="text-xs text-ink-400">Copiá el alias o el CBU</p>
              </div>
              <dl className="mt-3 overflow-hidden rounded-2xl border border-line">
                {datos.map((dato, indice) => {
                  const fueCopiado = copiado === dato.clave;
                  return (
                    <div
                      key={dato.clave}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${
                        indice > 0 ? "border-t border-line" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <dt className="font-mono text-[10px] font-semibold tracking-[0.25em] text-ink-400">
                          {dato.etiqueta}
                        </dt>
                        <dd
                          className={`mt-0.5 break-all font-mono text-sm font-semibold text-ink-900 ${
                            dato.clave === "monto" ? "text-base" : ""
                          }`}
                        >
                          {dato.mostrar}
                        </dd>
                      </div>
                      {dato.copiar !== undefined && (
                        <button
                          type="button"
                          onClick={() => copiar(dato)}
                          aria-label={`Copiar ${dato.etiqueta.toLowerCase()}`}
                          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                            fueCopiado
                              ? "bg-lime-300 text-pitch-900"
                              : "bg-chalk-100 text-ink-600 hover:bg-pitch-900 hover:text-lime-300"
                          }`}
                        >
                          {fueCopiado ? (
                            <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {fueCopiado ? "Copiado" : "Copiar"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </dl>
              <p className="sr-only" role="status" aria-live="polite">
                {copiado ? "Copiado al portapapeles" : ""}
              </p>
              <p className="mt-2 text-xs text-ink-400">
                Copiá el alias o el CBU para no equivocarte al transferir. El monto y el titular
                son para que verifiques que transferís a la cuenta correcta.
              </p>
            </section>

            <section aria-labelledby="checkout-comprobante">
              <p
                id="checkout-comprobante"
                className="font-mono text-[11px] font-semibold tracking-[0.3em] text-pitch-600"
              >
                COMPROBANTE
              </p>
              <label
                onDragOver={(evento) => {
                  evento.preventDefault();
                  setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={soltarArchivo}
                className={`relative mt-3 flex min-w-0 cursor-pointer flex-col items-center overflow-hidden justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
                  arrastrando
                    ? "border-pitch-500 bg-lime-400/15"
                    : archivo
                      ? "border-pitch-500/50 bg-chalk-50"
                      : "border-line-strong bg-chalk-0 hover:border-pitch-500 hover:bg-chalk-50"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(evento) => {
                    elegirArchivo(evento.target.files?.[0] ?? null);
                    evento.target.value = "";
                  }}
                />
                {archivo && vistaPrevia ? (
                  <div className="flex w-full items-center gap-4 text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={vistaPrevia}
                      alt="Vista previa del comprobante"
                      className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{archivo.name}</p>
                      <p className="text-xs text-ink-400">{formatearTamanio(archivo.size)}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-chalk-100 px-3 py-1.5 text-xs font-semibold text-ink-600">
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      Cambiar
                    </span>
                  </div>
                ) : (
                  <>
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-lime-400/25 text-pitch-700"
                      aria-hidden="true"
                    >
                      <ImagePlus className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-ink-900">
                      Subí la foto o captura del comprobante
                    </span>
                    <span className="text-xs text-ink-400">
                      Arrastrala hasta acá o tocá para elegirla · Imagen de hasta 5 MB
                    </span>
                  </>
                )}
              </label>
            </section>

            {(errorArchivo || state.error) && (
              <p
                role="alert"
                className="rounded-xl bg-coral-500/10 px-4 py-3 text-sm font-medium text-coral-700"
              >
                {errorArchivo ?? state.error}
              </p>
            )}
          </div>

          <div className="sticky bottom-0 mt-auto flex flex-col gap-3 border-t border-line bg-chalk-0 px-6 py-4 sm:px-8">
            <Button
              type="submit"
              loading={pending || enviando}
              disabled={!archivo}
              className="w-full rounded-full bg-lime-400 py-3.5 text-base text-pitch-900 hover:bg-lime-300 disabled:bg-chalk-100 disabled:text-ink-400"
            >
              Enviar comprobante
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-ink-400">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Tu comprobante se usa solo para verificar el pago.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
