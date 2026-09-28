"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ResultadoAccion } from "./actions";

export type OpcionMovimiento = { id: string; etiqueta: string };

export function AccionesPago({
  movimientos,
  movimientoSugerido,
  aprobarAction,
  rechazarAction,
}: {
  movimientos: OpcionMovimiento[];
  movimientoSugerido: string | null;
  aprobarAction: (formData: FormData) => Promise<ResultadoAccion>;
  rechazarAction: (formData: FormData) => Promise<ResultadoAccion>;
}) {
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<"aprobar" | "rechazar" | null>(null);
  const [movimientoId, setMovimientoId] = useState(movimientoSugerido ?? "");
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<ResultadoAccion>();

  function ejecutar(accion: (formData: FormData) => Promise<ResultadoAccion>, datos: FormData) {
    setResultado(undefined);
    startTransition(async () => {
      const respuesta = await accion(datos);
      setResultado(respuesta);
      if (!respuesta.error) setModo(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {modo === null && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setModo("aprobar")}>Aprobar</Button>
          <Button variant="secondary" onClick={() => setModo("rechazar")}>
            Rechazar
          </Button>
        </div>
      )}

      {modo === "aprobar" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(evento) => {
            evento.preventDefault();
            const datos = new FormData();
            datos.set("movimiento_id", movimientoId);
            ejecutar(aprobarAction, datos);
          }}
        >
          <label className="flex flex-col gap-1 text-sm text-ink-600">
            Movimiento de Mercado Pago que respalda este pago
            <select
              value={movimientoId}
              onChange={(evento) => setMovimientoId(evento.target.value)}
              className="rounded-lg border border-line-strong bg-chalk-0 px-3 py-2 text-sm text-ink-900"
            >
              <option value="">Sin asociar (lo confirmé por fuera)</option>
              {movimientos.map((movimiento) => (
                <option key={movimiento.id} value={movimiento.id}>
                  {movimiento.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={pending}>
              Sí, aprobar y acreditar prodes
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setModo(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {modo === "rechazar" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(evento) => {
            evento.preventDefault();
            const datos = new FormData();
            datos.set("motivo", motivo);
            ejecutar(rechazarAction, datos);
          }}
        >
          <label className="flex flex-col gap-1 text-sm text-ink-600">
            Motivo (se le muestra al usuario)
            <textarea
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              rows={3}
              maxLength={300}
              required
              className="rounded-lg border border-line-strong bg-chalk-0 px-3 py-2 text-sm text-ink-900"
              placeholder="Ej.: El monto transferido no coincide con el del plan."
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="danger" loading={pending} disabled={!motivo.trim()}>
              Rechazar pago
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setModo(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {resultado?.error && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {resultado.error}
        </p>
      )}
      {resultado?.exito && (
        <p role="status" className="text-sm font-medium text-pitch-700">
          {resultado.exito}
        </p>
      )}
    </div>
  );
}
