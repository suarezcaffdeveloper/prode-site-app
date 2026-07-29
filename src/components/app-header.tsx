import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "@/app/(app)/actions";

export function AppHeader({ esAdmin }: { esAdmin: boolean }) {
  return (
    <header className="border-b border-line bg-chalk-0">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/ligas">
            <Logo />
          </Link>
          <nav className="hidden gap-6 sm:flex" aria-label="Principal">
            <Link
              href="/ligas"
              className="text-sm font-medium text-ink-600 hover:text-pitch-700"
            >
              Ligas
            </Link>
            {esAdmin && (
              <Link
                href="/admin/ligas"
                className="text-sm font-medium text-ink-600 hover:text-pitch-700"
              >
                Admin
              </Link>
            )}
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
