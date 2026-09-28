import { forwardRef, HTMLAttributes } from "react";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-2xl border border-line bg-chalk-0 shadow-[0_1px_2px_rgba(16,36,26,0.04)] ${className}`}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";
