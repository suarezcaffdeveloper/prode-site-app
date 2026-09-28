import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario-actual";

export default async function Home() {
  const usuario = await getUsuarioActual();

  if (!usuario) redirect("/login");
  redirect(usuario.rol === "admin" ? "/admin/ligas" : "/ligas");
}
