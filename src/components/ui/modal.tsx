"use client";

import { ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg";
}

const MAX_WIDTH: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-3xl",
};

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`flex max-h-[85vh] w-full ${MAX_WIDTH[size]} flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-chalk-0 p-6 shadow-[0_1px_2px_rgba(16,36,26,0.04)]`}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-lg font-bold tracking-tight text-ink-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1 text-ink-400 transition-colors hover:bg-chalk-100 hover:text-ink-900"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
