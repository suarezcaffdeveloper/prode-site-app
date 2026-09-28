"use client";

import { useEffect, useSyncExternalStore } from "react";

// Las pantallas de subgrupo viven en /grupos/[id], sin el id de la liga en la
// URL. Su layout publica acá la liga a la que pertenece el subgrupo para que el
// header (que está en un layout padre) pueda seguir mostrando la navegación.
let ligaActiva: string | null = null;
const oyentes = new Set<() => void>();

function fijar(ligaId: string | null) {
  ligaActiva = ligaId;
  oyentes.forEach((oyente) => oyente());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function useLigaActiva(): string | null {
  return useSyncExternalStore(
    suscribir,
    () => ligaActiva,
    () => null,
  );
}

export function FijarLigaActiva({ ligaId }: { ligaId: string }) {
  useEffect(() => {
    fijar(ligaId);
    return () => fijar(null);
  }, [ligaId]);

  return null;
}
