import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-soft";
type Size = "md" | "sm";

const sizeClasses: Record<Size, string> = {
  md: "px-5 py-2.5",
  sm: "px-3.5 py-2",
};

const variantClasses: Record<Variant, string> = {
  "danger-soft":
    "bg-chalk-0 text-coral-700 border border-line-strong hover:border-coral-500 hover:bg-coral-500/5 disabled:text-ink-400 disabled:border-line",
  primary:
    "bg-pitch-700 text-chalk-0 hover:bg-pitch-600 disabled:bg-ink-400",
  secondary:
    "bg-chalk-0 text-ink-900 border border-line-strong hover:border-pitch-700 hover:text-pitch-700 disabled:text-ink-400 disabled:border-line",
  ghost:
    "bg-transparent text-ink-600 hover:text-pitch-700 hover:bg-chalk-100 disabled:text-ink-400",
  danger:
    "bg-coral-500 text-chalk-0 hover:bg-coral-700 disabled:bg-ink-400",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={`inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold tracking-tight transition-colors disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {loading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
