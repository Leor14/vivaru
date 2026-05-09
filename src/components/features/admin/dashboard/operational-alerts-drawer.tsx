"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function OperationalAlertsDrawer({
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
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/35"
        onClick={onClose}
        aria-label="Cerrar panel de alertas"
      />
      <aside className="absolute right-0 top-0 h-full w-full overflow-y-auto border-l border-[var(--slate-200)] bg-white p-5 shadow-2xl md:max-w-2xl md:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Alertas operativas</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--slate-900)]">{title}</h2>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="mr-1 h-4 w-4" /> Cerrar
          </Button>
        </div>

        <div className="space-y-2">{children}</div>
      </aside>
    </div>
  );
}
