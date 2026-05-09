"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-[var(--slate-200)] bg-white p-4 shadow-xl sm:max-w-2xl sm:rounded-2xl md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--slate-900)]">{title}</h3>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
