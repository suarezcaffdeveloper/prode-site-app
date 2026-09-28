import { createClient } from "@/lib/supabase/server";
import { LigaBottomNav } from "@/components/liga-bottom-nav";
import { FijarLigaActiva } from "@/components/liga-activa-store";

// Un subgrupo pertenece a una liga: mantiene la navegación de esa liga
// (header en escritorio, barra inferior en mobile) igual que dentro de /ligas/[id].
export default async function GrupoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: grupo } = await supabase
    .from("grupos")
    .select("liga_id")
    .eq("id", id)
    .maybeSingle();

  if (!grupo) return <>{children}</>;

  return (
    <div className="pb-24 lg:pb-0">
      <FijarLigaActiva ligaId={grupo.liga_id} />
      {children}
      <LigaBottomNav ligaId={grupo.liga_id} />
    </div>
  );
}
