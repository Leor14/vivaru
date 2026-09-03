import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  focusStyle?: "default" | "premium";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, focusStyle = "default", type, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const [showPassword, setShowPassword] = React.useState(false);

    const isPassword = type === "password";
    const effectiveType = isPassword && showPassword ? "text" : type;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block mb-1 text-sm font-medium text-[var(--slate-700)]">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            type={effectiveType}
            ref={ref}
            className={cn(
              "h-11 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--slate-900)] outline-none placeholder:text-[var(--slate-500)] focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]",
              isPassword && "pr-10",
              focusStyle === "premium" &&
                "transition-all duration-200 focus-visible:ring-4 focus-visible:ring-[color:var(--brand-200)]/80 focus-visible:shadow-[0_0_0_1px_var(--brand-700)]",
              error && "border-[var(--danger-500)]",
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--slate-400)] hover:text-[var(--slate-700)] focus:outline-none"
            >
              {showPassword
                ? <EyeOff className="h-4 w-4" />
                : <Eye className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
        {error ? (
          <span id={`${inputId}-error`} className="mt-1 block max-w-[var(--medida-lectura)] text-xs text-[var(--danger-500)]">
            {error}
          </span>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";
