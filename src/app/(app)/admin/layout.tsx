import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario-actual";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();

  if (usuario?.rol !== "admin") {
    redirect("/ligas");
  }

  return <>{children}</>;
}
