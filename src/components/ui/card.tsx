import * as React from "react";

import { cn } from "@/lib/utils/cn";
import { HelpTip } from "@/components/shared/help-tip";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4 shadow-[0_8px_22px_rgba(12,33,53,0.08)]",
        className,
      )}
      {...props}
    />
  );
}

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  /** Texto de ayuda contextual. Cuando se provee, muestra un ícono (?) con tooltip al lado del título. */
  help?: string;
};

export function CardTitle({ className, help, children, ...props }: CardTitleProps) {
  const heading = (
    <h3 className={cn("text-base font-semibold text-[var(--slate-900)]", className)} {...props}>
      {children}
    </h3>
  );

  if (!help) return heading;

  return (
    <div className="flex items-center gap-2">
      {heading}
      <HelpTip text={help} />
    </div>
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-[var(--slate-600)]", className)} {...props} />;
}
