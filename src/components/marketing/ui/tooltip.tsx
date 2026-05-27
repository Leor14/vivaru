"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Minimal CSS tooltip used by Topbar when the portal URL is unavailable
 * (decision rule §C — `NEXT_PUBLIC_PORTAL_LOGIN_URL` empty → show inline hint).
 *
 * Why hand-rolled instead of @base-ui/react/tooltip?
 *   - Single use-site (Sprint 1). No need for a portalled positioning engine.
 *   - We control the timing (none — show on hover/focus, hide on leave/blur).
 *   - Keeps the bundle lighter and the a11y contract explicit.
 *
 * Pattern: `aria-describedby` → screen-readers announce the hint when the
 * trigger receives focus. Visually shown on `:hover` and `:focus-visible`
 * via Tailwind's group-* states.
 */
export interface TooltipProps {
  /** Tooltip body. Plain text only — no interactive elements. */
  label: React.ReactNode;
  /** Trigger element (button, link, etc.). */
  children: React.ReactNode;
  /** Tooltip placement. Defaults to "bottom". */
  side?: "top" | "bottom";
  /** Optional id for `aria-describedby`. Auto-generated if omitted. */
  id?: string;
  className?: string;
}

export function Tooltip({
  label,
  children,
  side = "bottom",
  id,
  className,
}: TooltipProps) {
  const generatedId = React.useId();
  const tooltipId = id ?? `tooltip-${generatedId}`;

  // Clone the single child so we can inject `aria-describedby` without an
  // extra wrapper that would break button defaults.
  const child = React.Children.only(children) as React.ReactElement<{
    "aria-describedby"?: string;
  }>;
  const trigger = React.cloneElement(child, {
    "aria-describedby": tooltipId,
  });

  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {trigger}
      <span
        role="tooltip"
        id={tooltipId}
        className={cn(
          "pointer-events-none absolute left-1/2 z-[70] w-max max-w-[min(280px,90vw)] -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-xs leading-snug font-medium text-white shadow-brand-md",
          "opacity-0 transition-opacity duration-150 ease-out-brand",
          "group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
        )}
      >
        {label}
      </span>
    </span>
  );
}
