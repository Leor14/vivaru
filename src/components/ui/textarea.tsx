import * as React from "react";

import { cn } from "@/lib/utils/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ className, label, error, id, ...props }: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id ?? generatedId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block mb-1 text-sm font-medium text-[var(--slate-700)]">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={cn(
          "min-h-24 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 py-2 text-sm text-[var(--slate-900)] outline-none placeholder:text-[var(--slate-500)] focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]",
          error && 'border-red-500',
          className,
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        {...props}
      />
      {error && (
        <span id={`${textareaId}-error`} className="mt-1 block text-xs text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}
