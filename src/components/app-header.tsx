import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "@/lib/auth-actions";

function inicialesDe(nombre: string | null, email: string) {
  if (nombre && nombre.trim().length > 0) {
    const partes = nombre.trim().split(/\s+/);
    const primeras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
    return primeras.join("") || email[0]?.toUpperCase() || "?";
  }
  return email[0]?.toUpperCase() ?? "?";
}

export function AppHeader({
  usuario,
}: {
  usuario: { nombre: string | null; email: string };
}) {
  return (
    <header className="border-b border-line bg-chalk-0">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/ligas">
            <Logo />
          </Link>
          <Link
            href="/ligas"
            className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink-600 hover:border-pitch-500 hover:text-pitch-700"
          >
            Ligas
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-400"
            aria-hidden="true"
          >
            <Bell className="h-5 w-5" />
          </span>

          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-pitch-900 font-display text-xs font-bold text-lime-300"
            title={usuario.nombre ?? usuario.email}
          >
            {inicialesDe(usuario.nombre, usuario.email)}
          </span>

          <form action={cerrarSesion}>
            <Button type="submit" variant="ghost">
              Salir
            </Button>
          </form>
        </div>
      </div>
      <div className="yard-line" />
    </header>
  );
}
