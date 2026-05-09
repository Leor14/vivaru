"use client";

import { useState, type ReactNode } from "react";
import { Filter, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { cn } from "@/lib/utils/cn";

export function MobileFiltersPanel({
  title = "Filtros",
  children,
  footer,
  defaultOpen = false,
  collapsibleOnDesktop = false,
  activeFiltersCount = 0,
  openLabel = "Mostrar filtros",
  closeLabel = "Ocultar filtros",
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  defaultOpen?: boolean;
  collapsibleOnDesktop?: boolean;
  activeFiltersCount?: number;
  openLabel?: string;
  closeLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const buttonLabel = open ? closeLabel : openLabel;
  const shouldShowPanel = open || !collapsibleOnDesktop;

  return (
    <section className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className={cn("w-full justify-between", collapsibleOnDesktop ? "" : "md:hidden")}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="inline-flex items-center gap-2">
          <IconBadge tone="sky" active={open}>
            <Filter className="h-4 w-4" />
          </IconBadge>
          {collapsibleOnDesktop ? buttonLabel : title}
          {activeFiltersCount > 0 ? (
            <span className="rounded-full bg-[var(--brand-50)] px-2 py-0.5 text-xs font-semibold text-[var(--brand-800)]">
              {activeFiltersCount}
            </span>
          ) : null}
        </span>
        <IconBadge tone="mint" active={open} className={cn("transition", open ? "rotate-90" : "rotate-0")}>
          <SlidersHorizontal className="h-4 w-4" />
        </IconBadge>
      </Button>

      <div
        className={cn(
          "rounded-xl border border-[var(--slate-200)] bg-white p-3",
          collapsibleOnDesktop ? (shouldShowPanel ? "block" : "hidden") : open ? "block" : "hidden md:block",
        )}
      >
        <p className="text-xs font-medium tracking-wide text-[var(--slate-500)] uppercase">{title}</p>
        <div className="mt-2 grid gap-3">{children}</div>
        {footer ? <div className="mt-3 border-t border-[var(--slate-200)] pt-3">{footer}</div> : null}
      </div>
    </section>
  );
}
