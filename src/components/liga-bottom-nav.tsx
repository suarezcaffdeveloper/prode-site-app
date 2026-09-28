"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Calendar, ClipboardList, Home, Ticket } from "lucide-react";

export function LigaBottomNav({ ligaId }: { ligaId: string }) {
  const pathname = usePathname();

  const items = [
    {
      label: "Pronósticos",
      href: `/ligas/${ligaId}/pronosticos`,
      icon: ClipboardList,
    },
    {
      label: "Fixture",
      href: `/ligas/${ligaId}/partidos`,
      icon: Calendar,
    },
    {
      label: "Inicio",
      href: `/ligas/${ligaId}`,
      icon: Home,
      central: true,
    },
    {
      label: "Planes",
      href: `/ligas/${ligaId}/planes`,
      icon: Ticket,
    },
    {
      label: "Estadísticas",
      href: `/ligas/${ligaId}/estadisticas`,
      icon: BarChart2,
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-chalk-0"
      aria-label="Navegación de la liga"
    >
      <div className="mx-auto flex max-w-5xl items-stretch justify-between px-2">
        {items.map((item) => {
          const activo =
            item.href === `/ligas/${ligaId}`
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                activo ? "text-pitch-700" : "text-ink-400"
              }`}
              aria-current={activo ? "page" : undefined}
            >
              {item.central ? (
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    activo ? "bg-pitch-900 text-lime-300" : "bg-chalk-100 text-ink-600"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
              <span>{item.label}</span>
              <span
                className={`h-1 w-1 rounded-full ${activo ? "bg-pitch-700" : "bg-transparent"}`}
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
