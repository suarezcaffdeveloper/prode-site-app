"use client";

import { InputHTMLAttributes, useId, useState } from "react";

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: string;
}

// Igual que Field, pero con el botón "ojito" para mostrar/ocultar la
// contraseña tipeada. Componente de cliente porque necesita estado local
// para el toggle.
export function PasswordField({
  label,
  error,
  hint,
  id,
  className = "",
  ...props
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink-900">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : undefined}
          className={`w-full rounded-lg border bg-chalk-0 px-3.5 py-2.5 pr-11 text-sm text-ink-900 placeholder:text-ink-400 transition-colors ${
            error ? "border-coral-500" : "border-line-strong"
          } ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-400 hover:text-ink-600"
        >
          {visible ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 3l18 18" strokeLinecap="round" />
              <path
                d="M10.58 10.58a2 2 0 0 0 2.83 2.83M9.36 5.36A10.6 10.6 0 0 1 12 5c5 0 9 4 10 7-.32.99-1.06 2.24-2.17 3.42M6.6 6.6C4.6 7.9 3 9.8 2 12c1 3 5 7 10 7 1.13 0 2.2-.19 3.2-.53"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path
                d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-coral-700">
          {error}
        </p>
      )}
    </div>
  );
}
