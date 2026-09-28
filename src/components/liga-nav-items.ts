import { BarChart2, Calendar, ClipboardList, Home, Ticket, type LucideIcon } from "lucide-react";

export type ItemNavLiga = {
  label: string;
  href: string;
  icon: LucideIcon;
  central?: boolean;
};

export function itemsNavLiga(ligaId: string): ItemNavLiga[] {
  return [
    { label: "Pronósticos", href: `/ligas/${ligaId}/pronosticos`, icon: ClipboardList },
    { label: "Fixture", href: `/ligas/${ligaId}/partidos`, icon: Calendar },
    { label: "Inicio", href: `/ligas/${ligaId}`, icon: Home, central: true },
    { label: "Planes", href: `/ligas/${ligaId}/planes`, icon: Ticket },
    { label: "Estadísticas", href: `/ligas/${ligaId}/estadisticas`, icon: BarChart2 },
  ];
}

export function itemActivo(item: ItemNavLiga, ligaId: string, pathname: string): boolean {
  return item.href === `/ligas/${ligaId}` ? pathname === item.href : pathname.startsWith(item.href);
}
