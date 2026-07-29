import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-xs font-semibold tracking-[0.3em] text-coral-500">
        ERROR DE ACCESO
      </p>
      <h1 className="font-display text-2xl font-bold text-ink-900">
        No pudimos confirmar tu inicio de sesión
      </h1>
      <p className="max-w-sm text-sm text-ink-600">
        El enlace puede haber expirado o ya haberse usado. Volvé a intentar
        iniciar sesión.
      </p>
      <Link href="/login">
        <Button>Volver a intentar</Button>
      </Link>
    </div>
  );
}
