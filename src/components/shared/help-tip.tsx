"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X } from "lucide-react";

interface HelpTipProps {
  text: string;
  /** Side to open the popover. Defaults to "bottom". Only used on desktop (md+). On mobile the popover is always centered. */
  side?: "bottom" | "top" | "left" | "right";
  className?: string;
}

/**
 * Small "?" circle button that opens a non-invasive floating tip on click.
 * On mobile: renders as a fixed centered sheet so it is always fully visible.
 * On desktop: renders as a relative popover anchored to the button.
 * Closes on outside click, Escape key, or clicking the button again.
 */
export function HelpTip({ text, side = "bottom", className = "" }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Detect mobile on mount and on resize.
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  const popoverPositionClass =
    side === "top"
      ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
      : side === "left"
        ? "right-full mr-2 top-1/2 -translate-y-1/2"
        : side === "right"
          ? "left-full ml-2 top-1/2 -translate-y-1/2"
          : "top-full mt-2 left-1/2 -translate-x-1/2";

  const popoverContent = (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-[var(--slate-700)]">Descripción</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(false); }}
        aria-label="Cerrar ayuda"
        className="rounded-sm p-0.5 text-[var(--slate-400)] hover:text-[var(--slate-600)]"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        aria-label="Ayuda"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((prev) => !prev); }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--slate-300)] bg-[var(--surface-strong)] text-[var(--slate-500)] transition-colors hover:border-[var(--brand-400)] hover:text-[var(--brand-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && isMobile
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center px-5"
              onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            >
              {/* backdrop */}
              <div className="absolute inset-0 bg-[var(--overlay)]/30" onClick={() => setOpen(false)} />
              {/* card */}
              <div
                role="tooltip"
                className="relative w-full max-w-sm rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4 shadow-xl"
              >
                {popoverContent}
                <p className="text-sm leading-6 text-[var(--slate-600)]">{text}</p>
              </div>
            </div>,
            document.body,
          )
        : null}

      {open && !isMobile ? (
        <div
          role="tooltip"
          className={`absolute z-50 w-64 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-3 shadow-lg ${popoverPositionClass}`}
        >
          {popoverContent}
          <p className="text-xs leading-5 text-[var(--slate-600)]">{text}</p>
        </div>
      ) : null}
    </div>
  );
}
