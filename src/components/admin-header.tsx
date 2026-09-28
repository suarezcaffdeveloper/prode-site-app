import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "@/lib/auth-actions";

export function AdminHeader() {
  return (
    <header className="border-b border-line bg-chalk-0">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/ligas">
            <Logo />
          </Link>
          <span className="inline-flex items-center rounded-md bg-pitch-900 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-widest text-lime-400">
            ADMIN
          </span>
          <nav className="hidden gap-6 sm:flex" aria-label="Administración">
            <Link
              href="/admin/ligas"
              className="text-sm font-medium text-ink-600 hover:text-pitch-700"
            >
              Ligas
            </Link>
          </nav>
        </div>
        <form action={cerrarSesion}>
          <Button type="submit" variant="ghost">
            Salir
          </Button>
        </form>
      </div>
      <div className="yard-line" />
    </header>
  );
}
