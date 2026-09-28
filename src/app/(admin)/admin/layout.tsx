import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin-header";
import { getUsuarioActual } from "@/lib/usuario-actual";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();

  if (!usuario) {
    redirect("/login");
  }
  if (usuario.rol !== "admin") {
    redirect("/ligas");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AdminHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
