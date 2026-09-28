import { Card } from "@/components/ui/card";

// Habilita el prefetch parcial de esta ruta dinámica (ver doc de Next
// "Dynamic routes without loading.tsx"): sin esto, Link no navega hasta
// tener la respuesta completa del servidor.
export default function CargandoGrupo() {
  return (
    <div className="mx-auto flex w-full flex-col gap-10 lg:gap-12">
      <Card className="h-40 animate-pulse bg-chalk-100" />
      <Card className="h-72 animate-pulse bg-chalk-100" />
    </div>
  );
}
