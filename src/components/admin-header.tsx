import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "@/lib/auth-actions";
import { createClient } from "@/lib/supabase/server";

export async function AdminHeader() {
  // Pagos que el sistema no pudo verificar y esperan una decisión (SPEC 12).
  const supabase = await createClient();
  const { count: pagosPendientes } = await supabase
    .from("solicitudes_pago")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente_admin");

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
            <Link
              href="/admin/pagos"
              className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-pitch-700"
            >
              Pagos
              {(pagosPendientes ?? 0) > 0 && (
                <span
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 font-mono text-[11px] font-bold text-chalk-0"
                  aria-label={`${pagosPendientes} pagos pendientes`}
                >
                  {pagosPendientes}
                </span>
              )}
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
