import { Logo } from "@/components/ui/logo";

// Página estática (sin llamadas a Supabase) precacheada por el service
// worker como fallback de navegación cuando no hay red: es el "app shell"
// que exige el criterio de aceptación de instalar sin conexión.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-pitch-900 px-6 text-center text-chalk-0">
      <Logo inverted />
      <p className="font-mono text-xs font-semibold tracking-[0.3em] text-lime-400">
        SIN CONEXIÓN
      </p>
      <h1 className="max-w-sm font-display text-2xl font-bold">
        No hay señal en este momento
      </h1>
      <p className="max-w-sm text-sm text-chalk-100/70">
        Revisá tu conexión a internet. Las ligas, subgrupos y suscripciones
        necesitan estar online para cargar.
      </p>
    </div>
  );
}
