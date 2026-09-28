import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmarCuentaForm } from "./confirmar-form";

export default async function ConfirmarCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  const tipoValido = type === "signup" || type === "magiclink";

  if (!tokenHash || !tipoValido) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-coral-500">
          LINK INVÁLIDO
        </p>
        <h1 className="font-display text-2xl font-bold text-ink-900">
          Este link de confirmación no es válido
        </h1>
        <p className="max-w-sm text-sm text-ink-600">
          Puede que esté incompleto o mal copiado. Volvé a iniciar sesión para
          pedir que te reenvíen la confirmación.
        </p>
        <Link href="/login">
          <Button>Ir a iniciar sesión</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
        CONFIRMAR CUENTA
      </p>
      <h1 className="font-display text-2xl font-bold text-ink-900">
        Confirmá tu cuenta
      </h1>
      <p className="max-w-sm text-sm text-ink-600">
        Para terminar de crear tu cuenta y empezar a pronosticar, confirmá que
        este es tu email.
      </p>
      <ConfirmarCuentaForm tokenHash={tokenHash} type={type} />
    </div>
  );
}
