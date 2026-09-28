import { Card } from "@/components/ui/card";

// Habilita el prefetch parcial de esta ruta dinámica (ver doc de Next
// "Dynamic routes without loading.tsx"): sin esto, Link no navega hasta
// tener la respuesta completa del servidor.
export default function CargandoInicioLiga() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 lg:max-w-none lg:gap-12">
      <Card className="h-40 animate-pulse bg-chalk-100" />
      <Card className="h-56 animate-pulse bg-chalk-100" />
      <Card className="h-40 animate-pulse bg-chalk-100" />
    </div>
  );
}
