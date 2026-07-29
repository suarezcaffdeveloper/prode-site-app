import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-line bg-chalk-0 shadow-[0_1px_2px_rgba(16,36,26,0.04)] ${className}`}
      {...props}
    />
  );
}
