"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

// Copiar el código y mandarlo por WhatsApp: es la forma habitual de invitar
// gente al subgrupo (SPEC 01: código corto en vez de link con token).
export function CompartirCodigo({
  codigo,
  nombreGrupo,
  ligaNombre,
  oscuro = false,
}: {
  codigo: string;
  nombreGrupo: string;
  ligaNombre: string;
  // Sobre el fondo verde del hero los botones van en versión clara.
  oscuro?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el código sigue visible para copiarlo a mano.
    }
  }

  const mensaje = `Sumate a mi subgrupo "${nombreGrupo}" del prode de ${ligaNombre}. Entrá a la liga, andá a la sección de subgrupos e ingresá este código de invitación: ${codigo}`;
  const claseBoton = oscuro
    ? "border-chalk-0/25 bg-chalk-0/10 text-chalk-0 hover:bg-chalk-0/20"
    : "border-line-strong bg-chalk-0 text-ink-600 hover:border-pitch-500 hover:text-pitch-700";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copiar}
        className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${claseBoton}`}
      >
        {copiado ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
        {copiado ? "Copiado" : "Copiar código"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${claseBoton}`}
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Compartir por WhatsApp
      </a>
    </div>
  );
}
