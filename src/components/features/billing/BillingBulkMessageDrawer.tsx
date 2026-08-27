import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

export type BillingUnitOption = {
  id: string;
  label: string;
};

type BillingBulkMessageDrawerProps = {
  open: boolean;
  units: BillingUnitOption[];
  selectedUnitIds: string[];
  message: string;
  onClose: () => void;
  onToggleUnit: (unitId: string) => void;
  onToggleAll: () => void;
  onChangeMessage: (nextValue: string) => void;
  onSend: () => void;
  isSending: boolean;
};

export function BillingBulkMessageDrawer({
  open,
  units,
  selectedUnitIds,
  message,
  onClose,
  onToggleUnit,
  onToggleAll,
  onChangeMessage,
  onSend,
  isSending,
}: BillingBulkMessageDrawerProps) {
  if (!open) return null;

  const allSelected = units.length > 0 && selectedUnitIds.length === units.length;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Enviar mensaje masivo">
      <button className="absolute inset-0 bg-slate-950/40" onClick={onClose} aria-label="Cerrar drawer" />

      <aside className="absolute right-0 top-0 h-full w-full overflow-y-auto border-l border-[var(--slate-200)] bg-white p-5 shadow-2xl sm:max-w-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Comunicación operativa</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--slate-900)]">Enviar mensaje masivo</h2>
            <p className="mt-2 text-sm text-[var(--slate-700)]">Selecciona unidades y redacta el mensaje para notificacion masiva.</p>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Cerrar
          </Button>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--slate-900)]">Destinatarios</p>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onToggleAll}>
                {allSelected ? "Quitar todas" : "Seleccionar todas"}
              </Button>
              <span className="rounded-full bg-[var(--slate-200)] px-2 py-1 text-xs font-semibold text-[var(--slate-700)]">
                {selectedUnitIds.length} seleccionada(s)
              </span>
            </div>
          </div>

          <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-[var(--slate-200)] bg-white p-3 sm:grid-cols-2">
            {units.length === 0 ? (
              <p className="text-sm text-[var(--slate-600)]">No hay unidades disponibles para seleccionar.</p>
            ) : (
              units.map((unit) => {
                const isChecked = selectedUnitIds.includes(unit.id);
                return (
                  <label
                    key={unit.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-sm",
                      isChecked
                        ? "border-[var(--brand-400)] bg-[var(--brand-100)] text-[var(--brand-900)]"
                        : "border-[var(--slate-200)] bg-white text-[var(--slate-700)]",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleUnit(unit.id)}
                      className="h-4 w-4 rounded-sm border-[var(--slate-300)]"
                    />
                    <span>{unit.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--slate-200)] p-4">
          <Textarea
            label="Mensaje"
            value={message}
            onChange={(event) => onChangeMessage(event.target.value)}
            placeholder="Escribe un mensaje claro para las unidades seleccionadas"
            className="min-h-32"
          />
          <p className="mt-2 text-xs text-[var(--slate-500)]">Usa un texto concreto y accionable para mejorar la respuesta de recaudo.</p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSending}>Cancelar</Button>
          <Button
            type="button"
            onClick={onSend}
            disabled={isSending || selectedUnitIds.length === 0 || message.trim().length === 0}
          >
            {isSending ? "Enviando..." : `Enviar a ${selectedUnitIds.length} unidad(es)`}
          </Button>
        </div>
      </aside>
    </div>
  );
}
