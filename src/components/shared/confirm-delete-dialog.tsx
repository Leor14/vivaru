"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

const DANGER_COLOR = "#A32D2D";

export type ConfirmDeleteDialogProps = {
  open: boolean;
  /** Name of the item being deleted, used in the title: "Eliminar [name]". */
  name: string;
  /** Description of the impact of deleting. */
  description?: ReactNode;
  /** Optional override for the title. Defaults to `Eliminar ${name}`. */
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDeleteDialog({
  open,
  name,
  description,
  title,
  confirmLabel = "Sí, eliminar",
  cancelLabel = "Cancelar",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const resolvedTitle = title ?? `Eliminar ${name}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--overlay)]/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] shadow-xl sm:rounded-2xl">
        <div className="flex items-start gap-3 p-5">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(163, 45, 45, 0.1)", color: DANGER_COLOR }}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h3 id="confirm-delete-title" className="text-base font-semibold text-[var(--slate-900)]">
              {resolvedTitle}
            </h3>
            {description ? (
              <div className="mt-1 text-sm text-[var(--slate-600)]">{description}</div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--slate-200)] bg-[var(--surface-soft)] px-5 py-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-medium text-[var(--on-fill)] transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 sm:w-auto"
            style={{ backgroundColor: DANGER_COLOR }}
          >
            {loading ? "Eliminando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
