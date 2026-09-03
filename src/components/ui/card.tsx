import * as React from "react";

import { cn } from "@/lib/utils/cn";
import { HelpTip } from "@/components/shared/help-tip";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4 shadow-[var(--sombra-media-7)]",
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

/**
 * La descripcion es prosa, asi que lleva la medida de lectura. Alcanza 133
 * llamadas en 86 ficheros con un solo cambio, y ninguna de ellas la usa para
 * maquetar —se comprobo— ni pasa ya un `max-w`.
 *
 * Quien necesite el ancho completo pasa `max-w-none`: `cn` usa twMerge, asi
 * que la clase del llamador SUSTITUYE a esta en vez de sumarse.
 */
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("max-w-[var(--medida-lectura)] text-sm text-[var(--slate-600)]", className)} {...props} />;
}
