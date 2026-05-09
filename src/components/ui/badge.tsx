import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[var(--slate-100)] px-2.5 py-1 text-xs font-medium text-[var(--slate-700)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
