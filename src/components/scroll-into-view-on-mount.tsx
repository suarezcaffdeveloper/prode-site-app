"use client";

import { useEffect, useRef } from "react";

export function ScrollIntoViewOnMount({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, []);

  return <div ref={ref}>{children}</div>;
}
