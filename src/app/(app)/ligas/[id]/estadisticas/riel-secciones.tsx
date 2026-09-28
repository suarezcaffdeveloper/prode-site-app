// Solo escritorio: barra pegajosa para saltar entre las secciones de la página.
export function RielSecciones({
  items,
  descripcion = "Secciones de estadísticas",
}: {
  items: { id: string; etiqueta: string }[];
  // Texto accesible del <nav>; cambia según la pantalla que lo use.
  descripcion?: string;
}) {
  return (
    <nav
      aria-label={descripcion}
      className="sticky top-[88px] z-20 hidden items-center gap-4 rounded-2xl border border-line bg-chalk-0/90 py-2.5 pl-5 pr-2.5 shadow-[0_8px_24px_rgba(16,36,26,0.06)] backdrop-blur lg:flex"
    >
      <p className="shrink-0 font-mono text-[11px] font-semibold tracking-[0.3em] text-ink-400">
        IR A
      </p>
      <div
        className="flex flex-1 gap-2 overflow-x-auto py-0.5 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="flex h-9 shrink-0 items-center rounded-full border border-line-strong bg-chalk-0 px-4 text-sm font-medium text-ink-600 transition-all hover:-translate-y-0.5 hover:border-pitch-500 hover:text-pitch-700 hover:shadow-[0_8px_20px_rgba(16,36,26,0.08)]"
          >
            {item.etiqueta}
          </a>
        ))}
      </div>
    </nav>
  );
}
