import { Card } from "@/components/ui/card";

// Habilita el prefetch parcial de esta ruta dinámica (ver doc de Next
// "Dynamic routes without loading.tsx"): sin esto, Link no navega hasta
// tener la respuesta completa del servidor.
export default function CargandoFixture() {
  return (
    <div className="mx-auto flex w-full flex-col gap-8 lg:gap-10">
      <Card className="h-32 animate-pulse bg-chalk-100" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card className="h-48 animate-pulse bg-chalk-100" />
        <Card className="h-48 animate-pulse bg-chalk-100" />
      </div>
    </div>
  );
}
