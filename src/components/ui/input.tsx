import * as React from "react";

import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  focusStyle?: "default" | "premium";
}

export function Input({ className, label, error, id, focusStyle = "default", ...props }: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block mb-1 text-sm font-medium text-[var(--slate-700)]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none placeholder:text-[var(--slate-500)] focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]",
          focusStyle === "premium" &&
            "transition-all duration-200 focus-visible:ring-4 focus-visible:ring-[color:var(--brand-200)]/80 focus-visible:shadow-[0_0_0_1px_var(--brand-700)]",
          error && 'border-red-500',
          className,
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <span id={`${inputId}-error`} className="mt-1 block text-xs text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}
