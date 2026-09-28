import { LigaBottomNav } from "@/components/liga-bottom-nav";

export default async function LigaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="pb-24">
      {children}
      <LigaBottomNav ligaId={id} />
    </div>
  );
}
