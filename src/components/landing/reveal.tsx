"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEnVista } from "./hooks";

type Variante = "up" | "left" | "right" | "scale";

export function Reveal({
  children,
  variante = "up",
  retraso = 0,
  className = "",
  soloEscritorio = false,
}: {
  children: ReactNode;
  variante?: Variante;
  retraso?: number;
  className?: string;
  // Con true la animación solo corre desde el breakpoint lg; en mobile el
  // contenido se muestra sin transición.
  soloEscritorio?: boolean;
}) {
  const { ref, enVista } = useEnVista<HTMLDivElement>(0.15);

  return (
    <div
      ref={ref}
      className={`${soloEscritorio ? "reveal-lg" : "reveal"} ${className}`}
      data-variant={variante}
      data-visible={enVista}
      style={{ "--reveal-delay": `${retraso}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
