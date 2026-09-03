"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Optional supporting content rendered next to the title (badges, status). */
  headerExtra?: ReactNode;
  /** Footer rendered sticky at the bottom. */
  footer?: ReactNode;
  /** Width of the drawer in px on desktop. Defaults to 480. */
  width?: number;
  children: ReactNode;
  /** Optional id used by aria-labelledby. Auto-generated when omitted. */
  ariaLabelledById?: string;
  className?: string;
};

let titleIdCounter = 0;

/**
 * Slide-over drawer anchored to the right of the viewport. Closes via:
 * - the close button
 * - clicking the dark overlay
 * - pressing Escape
 *
 * Animation: enter 300ms (--ease-drawer, iOS curve) / exit 220ms ease-in.
 * Uses the same mounted+dataState pattern as Dialog so exit animation plays
 * before the component is removed from the DOM.
 *
 * Renders into a React portal to avoid stacking-context issues.
 */
export function Drawer({
  open,
  onClose,
  title,
  headerExtra,
  footer,
  width = 480,
  children,
  ariaLabelledById,
  className,
}: DrawerProps) {
  const titleIdRef = useRef<string>("");
  if (!titleIdRef.current) {
    titleIdCounter += 1;
    titleIdRef.current = `drawer-title-${titleIdCounter}`;
  }
  const titleId = ariaLabelledById ?? titleIdRef.current;

  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Stable ref for onClose — prevents the open/focus effect from re-running
  // every time the parent re-renders with a new function reference.
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  // `mounted` keeps the portal in the DOM during the exit animation.
  // `dataState` drives the CSS classes ("open" → visible, "closed" → animating out).
  const [mounted, setMounted] = useState(open);
  const [dataState, setDataState] = useState<"open" | "closed">(open ? "open" : "closed");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setMounted(true);
      // Tick delay so browser paints the "closed" state first, then transitions to "open".
      requestAnimationFrame(() => setDataState("open"));
    } else {
      setDataState("closed");
      // Keep mounted for 220ms — matches the exit transition duration in globals.css.
      closeTimerRef.current = setTimeout(() => setMounted(false), 220);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [open]);

  // Scroll-lock + focus management. Tied to `open` (logical state), not `mounted`.
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;

    previouslyFocusedRef.current = (document.activeElement as HTMLElement | null) ?? null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);

    // Focus the panel on open so keyboard users land inside the drawer.
    requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]); // onClose intentionally excluded — use onCloseRef instead

  if (!mounted || typeof window === "undefined") return null;

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      const root = panelRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  const drawer = (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        data-state={dataState}
        aria-label="Cerrar panel"
        className="drawer-overlay absolute inset-0 bg-[var(--overlay)]/40"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        data-state={dataState}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={cn(
          // Mobile: bottom sheet — slides up from bottom
          "drawer-panel absolute bottom-0 left-0 right-0 flex max-h-[90vh] flex-col rounded-t-2xl border-t border-[var(--slate-200)] bg-[var(--surface-strong)] shadow-2xl outline-none",
          // Desktop (md+): right panel — slides in from right
          "md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-full md:max-h-none md:rounded-none md:border-l md:border-t-0 md:w-auto",
          className,
        )}
        style={typeof window !== "undefined" && window.innerWidth >= 768 ? { width } : undefined}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--slate-200)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-lg font-semibold text-[var(--slate-900)]">
              {title}
            </h2>
            {headerExtra ? <div className="mt-1 flex flex-wrap items-center gap-2">{headerExtra}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-[var(--slate-600)] transition-colors hover:bg-[var(--slate-100)] hover:text-[var(--slate-900)]"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="border-t border-[var(--slate-200)] bg-[var(--slate-50)]/60 px-5 py-3">{footer}</footer>
        ) : null}
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
