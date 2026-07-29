import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getUsuarioActual } from "@/lib/usuario-actual";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();

  // El middleware ya protege estas rutas; esto es un resguardo si la fila
  // en "usuarios" todavía no existe (carrera rara con el trigger de alta).
  if (!usuario) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader esAdmin={usuario.rol === "admin"} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
