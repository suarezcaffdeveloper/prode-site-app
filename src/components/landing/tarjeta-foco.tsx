"use client";

import { useRef } from "react";

// Tarjeta con un destello que sigue al cursor. El destello solo se ve al pasar el mouse.
export function TarjetaFoco({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function seguir(evento: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const caja = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${evento.clientX - caja.left}px`);
    el.style.setProperty("--my", `${evento.clientY - caja.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={seguir}
      className={`group relative overflow-hidden rounded-3xl border border-line bg-chalk-0 transition-all duration-300 hover:-translate-y-1.5 hover:border-pitch-500/50 hover:shadow-[0_24px_60px_rgba(20,83,45,0.14)] ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(360px circle at var(--mx, 50%) var(--my, 50%), rgba(163,230,53,0.18), transparent 65%)",
        }}
        aria-hidden="true"
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
