import { Logo } from "@/components/ui/logo";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-pitch-900 px-12 py-10 text-chalk-0 md:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, rgba(245,247,242,0.06) 0, rgba(245,247,242,0.06) 1px, transparent 1px, transparent 64px)",
          }}
          aria-hidden="true"
        />
        <Logo inverted />
        <div className="relative flex flex-col gap-4">
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-lime-400">
            {eyebrow}
          </p>
          <h1 className="max-w-xs font-display text-4xl font-bold leading-[1.05] tracking-tight">
            Tu liga de amigos, con marcador propio.
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-chalk-100/70">
            Sumate a una liga, armá tu subgrupo y seguí el estado de tu
            suscripción como en el tablero de la cancha.
          </p>
        </div>
        <p className="relative font-mono text-xs text-chalk-100/50">
          © {new Date().getFullYear()} Prode
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Logo />
          </div>
          <p className="mb-2 font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            {eyebrow}
          </p>
          <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-ink-900">
            {title}
          </h2>
          <p className="mb-8 text-sm text-ink-600">{subtitle}</p>
          {children}
          <div className="mt-8 text-sm text-ink-600">{footer}</div>
        </div>
      </main>
    </div>
  );
}
