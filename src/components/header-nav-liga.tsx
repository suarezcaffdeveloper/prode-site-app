"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { itemActivo, itemsNavLiga } from "./liga-nav-items";
import { useLigaActiva } from "./liga-activa-store";

// Navegación de la liga dentro del header (desde lg). En mobile se usa la
// barra inferior. Aparece dentro de /ligas/[id]/... (el id sale del pathname)
// y dentro de /grupos/[id]/..., donde el "id" es del subgrupo y la liga la
// publica el layout del subgrupo.
export function HeaderNavLiga() {
  const pathname = usePathname();
  const ligaDelSubgrupo = useLigaActiva();
  const ligaId =
    pathname.match(/^\/ligas\/([^/]+)/)?.[1] ??
    (pathname.startsWith("/grupos/") ? ligaDelSubgrupo : null);
  if (!ligaId) return null;

  // En escritorio "Inicio" va primero: es la puerta de entrada de la liga.
  const items = itemsNavLiga(ligaId).sort((a, b) => Number(!!b.central) - Number(!!a.central));

  return (
    <nav
      className="hidden items-center gap-1 rounded-full border border-line bg-chalk-50 p-1 lg:flex"
      aria-label="Navegación de la liga"
    >
      {items.map((item) => {
        const activo = itemActivo(item, ligaId, pathname);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={activo ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
              activo
                ? "bg-pitch-900 text-lime-300 shadow-[0_4px_12px_rgba(11,31,20,0.25)]"
                : "text-ink-600 hover:bg-chalk-0 hover:text-pitch-700"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
