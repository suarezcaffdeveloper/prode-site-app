import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ReenviarConfirmacionForm } from "./reenviar-form";

export default async function RevisaTuEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; envio?: string }>;
}) {
  const { email = "", envio } = await searchParams;

  return (
    <AuthShell
      eyebrow="CASI LISTO"
      title="Revisá tu email"
      subtitle={
        email
          ? `Te mandamos un link de confirmación a ${email}.`
          : "Te mandamos un link de confirmación a tu email."
      }
      footer={
        <>
          ¿Ya confirmaste tu cuenta?{" "}
          <Link href="/login" className="font-medium text-pitch-700 hover:underline">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-ink-600">
        <p>
          Abrí el email y tocá <strong>&ldquo;Confirmar mi cuenta&rdquo;</strong>.
          Si no lo ves, revisá spam o promociones: puede tardar unos minutos.
        </p>
        {envio === "fallido" && (
          <p role="alert" className="text-sm font-medium text-coral-700">
            No pudimos enviarte el email automáticamente. Probá pedir que te lo
            reenviemos.
          </p>
        )}
      </div>
      <ReenviarConfirmacionForm email={email} />
    </AuthShell>
  );
}
