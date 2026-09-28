import { Card } from "@/components/ui/card";

// Habilita el prefetch parcial de esta ruta dinámica (ver doc de Next
// "Dynamic routes without loading.tsx"): sin esto, Link no navega hasta
// tener la respuesta completa del servidor.
export default function CargandoEstadisticas() {
  return (
    <div className="mx-auto flex w-full flex-col gap-10 lg:gap-12">
      <Card className="h-32 animate-pulse bg-chalk-100" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <Card className="h-32 animate-pulse bg-chalk-100" />
        <Card className="h-32 animate-pulse bg-chalk-100" />
        <Card className="h-32 animate-pulse bg-chalk-100" />
      </div>
    </div>
  );
}
