import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-[var(--brand-700)] text-white hover:bg-[var(--brand-800)] hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none",
        outline: "border border-[var(--slate-300)] bg-white text-[var(--slate-900)] hover:bg-[var(--slate-100)]",
        ghost: "text-[var(--slate-700)] hover:bg-[var(--slate-100)]",
        danger: "bg-[var(--danger-600)] text-white hover:bg-[var(--danger-700)]",
      },
      size: {
        xs: "h-8 px-2.5 text-xs",
        sm: "h-10 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
