"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HelpCircle, X } from "lucide-react";

interface HelpTipProps {
  text: string;
  /** Side to open the popover. Defaults to "bottom". */
  side?: "bottom" | "top" | "left" | "right";
  className?: string;
}

/**
 * Small "?" circle button that opens a non-invasive floating tip on click.
 * Closes on outside click, Escape key, or clicking the button again.
 * Auto-adjusts horizontal position to stay within the viewport.
 */
export function HelpTip({ text, side = "bottom", className = "" }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // After the popover renders, clamp it so it never overflows left or right edge.
  useLayoutEffect(() => {
    if (!open || !popoverRef.current) return;
    const el = popoverRef.current;
    // Reset any previous inline adjustments before measuring.
    el.style.left = "";
    el.style.right = "";
    el.style.transform = "";

    const rect = el.getBoundingClientRect();
    const MARGIN = 8;
    const vw = window.innerWidth;

    if (rect.right > vw - MARGIN) {
      // Overflows right: pin to right edge of the button container.
      el.style.left = "auto";
      el.style.right = "0";
      el.style.transform = "none";
    } else if (rect.left < MARGIN) {
      // Overflows left: pin to left edge of the button container.
      el.style.left = "0";
      el.style.right = "auto";
      el.style.transform = "none";
    }
  }, [open]);

  const popoverPositionClass =
    side === "top"
      ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
      : side === "left"
        ? "right-full mr-2 top-1/2 -translate-y-1/2"
        : side === "right"
          ? "left-full ml-2 top-1/2 -translate-y-1/2"
          : "top-full mt-2 left-1/2 -translate-x-1/2"; // default: bottom

  return (
    <div ref={containerRef} className={`relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        aria-label="Ayuda"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((prev) => !prev); }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--slate-300)] bg-white text-[var(--slate-500)] transition-colors hover:border-[var(--brand-400)] hover:text-[var(--brand-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div
          ref={popoverRef}
          role="tooltip"
          className={`absolute z-50 w-64 rounded-xl border border-[var(--slate-200)] bg-white p-3 shadow-lg ${popoverPositionClass}`}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--slate-700)]">Descripción</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar ayuda"
              className="rounded p-0.5 text-[var(--slate-400)] hover:text-[var(--slate-600)]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="text-xs leading-5 text-[var(--slate-600)]">{text}</p>
        </div>
      ) : null}
    </div>
  );
}
