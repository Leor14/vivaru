"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  // `mounted` tracks whether the portal is in the DOM at all.
  // We keep it mounted for 250ms after `open` becomes false so the exit
  // animation has time to finish before we remove the node.
  const [mounted, setMounted] = useState(open);
  // `dataState` drives the CSS classes ("open" → visible, "closed" → animating out)
  const [dataState, setDataState] = useState<"open" | "closed">(open ? "open" : "closed");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      // Cancel any pending unmount
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setMounted(true);
      // Tick delay so browser paints the "closed" state first, then transitions to "open"
      requestAnimationFrame(() => setDataState("open"));
    } else {
      // Trigger exit animation, then unmount
      setDataState("closed");
      closeTimerRef.current = setTimeout(() => setMounted(false), 250);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-state={dataState}
      className="dialog-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        data-state={dataState}
        className={cn(
          "dialog-panel relative w-full max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
