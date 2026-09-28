"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { parsearFixtureExcel } from "@/lib/parsear-fixture-excel";
import {
  validarLoteFixture,
  type EquipoBatch,
  type ErrorFilaFixture,
  type FilaFixtureCruda,
  type PartidoExistenteBatch,
} from "@/lib/fixture-batch";

type ResultadoCargaMasiva = {
  error?: string;
  erroresPorFila?: ErrorFilaFixture[];
  cantidadCargada?: number;
};

type Paso =
  | { tipo: "seleccion"; error?: string }
  | { tipo: "preview"; filas: FilaFixtureCruda[]; errores: ErrorFilaFixture[]; validas: number }
  | { tipo: "resultado"; cantidadCargada: number };

export function CargaMasivaModal({
  open,
  onClose,
  ligaId,
  equipos,
  partidosExistentes,
  cargarFixtureMasivoAction,
}: {
  open: boolean;
  onClose: () => void;
  ligaId: string;
  equipos: EquipoBatch[];
  partidosExistentes: PartidoExistenteBatch[];
  cargarFixtureMasivoAction: (filas: FilaFixtureCruda[]) => Promise<ResultadoCargaMasiva>;
}) {
  const [paso, setPaso] = useState<Paso>({ tipo: "seleccion" });
  const [errorEnvio, setErrorEnvio] = useState<string>();
  const [pending, startTransition] = useTransition();

  function cerrarYResetear() {
    setPaso({ tipo: "seleccion" });
    setErrorEnvio(undefined);
    onClose();
  }

  async function onArchivoSeleccionado(archivo: File) {
    setPaso({ tipo: "seleccion" });
    const resultado = await parsearFixtureExcel(archivo);
    if (!resultado.ok) {
      setPaso({ tipo: "seleccion", error: resultado.error });
      return;
    }
    const { erroresPorFila, filasResueltas } = validarLoteFixture(
      resultado.filas,
      equipos,
      partidosExistentes,
    );
    setPaso({
      tipo: "preview",
      filas: resultado.filas,
      errores: erroresPorFila,
      validas: filasResueltas.length,
    });
  }

  function confirmar(filas: FilaFixtureCruda[]) {
    setErrorEnvio(undefined);
    startTransition(async () => {
      const resultado = await cargarFixtureMasivoAction(filas);
      if (resultado.erroresPorFila && resultado.erroresPorFila.length > 0) {
        setPaso({
          tipo: "preview",
          filas,
          errores: resultado.erroresPorFila,
          validas: filas.length - resultado.erroresPorFila.length,
        });
        return;
      }
      if (resultado.error) {
        setErrorEnvio(resultado.error);
        return;
      }
      setPaso({ tipo: "resultado", cantidadCargada: resultado.cantidadCargada ?? 0 });
    });
  }

  const hayErrorDeEquipoNoEncontrado =
    paso.tipo === "preview" && paso.errores.some((e) => e.mensaje.startsWith("No encontramos el equipo"));

  return (
    <Modal open={open} onClose={cerrarYResetear} title="Carga masiva de fixture" size="lg">
      <p className="text-sm text-ink-600">
        Subí un archivo .xlsx o .csv con las columnas <strong>Jornada</strong>, <strong>Equipo Local</strong> y{" "}
        <strong>Equipo Visitante</strong>. Los resultados y horarios se cargan después, jornada a jornada.
      </p>

      {paso.tipo === "seleccion" && (
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-chalk-50 px-6 py-10 text-center transition-colors hover:border-pitch-500 hover:bg-chalk-0 has-[:focus-visible]:border-pitch-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pitch-500/30">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-chalk-0 text-pitch-700"
              aria-hidden="true"
            >
              <FileSpreadsheet className="h-6 w-6" />
            </span>
            <span className="text-sm font-semibold text-pitch-700">Elegir archivo</span>
            <span className="text-xs text-ink-600">.xlsx o .csv</span>
            <input
              type="file"
              accept=".xlsx,.csv"
              aria-label="Archivo de fixture"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) void onArchivoSeleccionado(archivo);
                e.target.value = "";
              }}
              className="sr-only"
            />
          </label>
          {paso.error && (
            <p role="alert" className="text-sm font-medium text-coral-700">
              {paso.error}
            </p>
          )}
        </div>
      )}

      {paso.tipo === "preview" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-900">
            <span className="font-semibold text-pitch-700">{paso.validas}</span> fila
            {paso.validas === 1 ? "" : "s"} lista{paso.validas === 1 ? "" : "s"} para cargar
            {paso.errores.length > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-coral-700">
                  {paso.errores.length} fila{paso.errores.length === 1 ? "" : "s"} con error
                </span>
              </>
            )}
            {" de "}
            {paso.filas.length} en total.
          </p>

          {paso.errores.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-chalk-100 text-xs font-semibold uppercase tracking-wide text-ink-600">
                  <tr>
                    <th className="px-3 py-2">Fila</th>
                    <th className="px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {paso.errores.map((e, i) => (
                    <tr key={`${e.fila}-${i}`} className="border-t border-line">
                      <td className="px-3 py-2 font-mono text-xs text-ink-600">{e.fila}</td>
                      <td className="px-3 py-2 text-coral-700">{e.mensaje}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hayErrorDeEquipoNoEncontrado && (
            <p className="text-sm text-ink-600">
              Si falta algún equipo,{" "}
              <Link
                href={`/admin/ligas/${ligaId}/equipos`}
                className="font-medium text-pitch-700 hover:underline"
              >
                cargalo acá
              </Link>{" "}
              y volvé a subir el archivo.
            </p>
          )}

          {errorEnvio && (
            <p role="alert" className="text-sm font-medium text-coral-700">
              {errorEnvio}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={() => confirmar(paso.filas)}
              loading={pending}
              disabled={paso.errores.length > 0 || pending}
            >
              Confirmar carga
            </Button>
            <Button variant="ghost" onClick={() => setPaso({ tipo: "seleccion" })} disabled={pending}>
              Elegir otro archivo
            </Button>
          </div>
        </div>
      )}

      {paso.tipo === "resultado" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-ink-900">
            Se cargaron {paso.cantidadCargada} partido{paso.cantidadCargada === 1 ? "" : "s"} correctamente.
          </p>
          <Button onClick={cerrarYResetear} className="self-start">
            Cerrar
          </Button>
        </div>
      )}
    </Modal>
  );
}
