export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span
      className={`font-display text-xl font-bold tracking-tight ${
        inverted ? "text-chalk-0" : "text-ink-900"
      }`}
    >
      prode<span className="text-lime-400">.</span>
    </span>
  );
}
