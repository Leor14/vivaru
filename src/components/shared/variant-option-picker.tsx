"use client";

import { Check, Lock } from "lucide-react";

import type { ModuleVariantMeta } from "@/lib/config/module-variants";

type Editability = "locked" | "warn" | "free";

export type VariantOptionPickerProps = {
  meta: ModuleVariantMeta;
  value: string;
  editability: Editability;
  /** "create" = alta del conjunto (locked es seleccionable); "edit" = configurador (locked es solo lectura). */
  context: "create" | "edit";
  disabled?: boolean;
  /** Se llama al elegir una opción seleccionable. El padre decide qué hacer (p. ej. abrir modal en warn). */
  onSelect: (value: string) => void;
};

function EditabilityBadge({ editability }: { editability: Editability }) {
  if (editability === "locked") {
    return (
      <span className="rounded-full bg-[var(--slate-200)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--slate-600)]">
        se fija al crear
      </span>
    );
  }
  if (editability === "warn") {
    return (
      <span className="rounded-full bg-[var(--amber-100)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--amber-800)]">
        cambio con aviso
      </span>
    );
  }
  return null;
}

export function VariantOptionPicker({
  meta,
  value,
  editability,
  context,
  disabled = false,
  onSelect,
}: VariantOptionPickerProps) {
  // En el configurador, las variantes estructurales (locked) son solo lectura.
  const readOnly = editability === "locked" && context === "edit";
  const interactive = !readOnly && !disabled;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <p className="text-sm font-medium text-[var(--slate-900)]">{meta.label}</p>
        <EditabilityBadge editability={editability} />
      </div>
      <p className="text-xs text-[var(--slate-500)]">{meta.helpText}</p>

      {editability === "locked" && context === "create" ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-[var(--amber-50)] px-2.5 py-1.5 text-[11px] text-[var(--amber-800)]">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          Esta elección se fija al crear el conjunto y no se puede cambiar después.
        </p>
      ) : null}

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {meta.options.map((opt) => {
          const selected = opt.value === value;
          const dim = readOnly && !selected;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!interactive}
              onClick={() => interactive && !selected && onSelect(opt.value)}
              className={[
                "flex h-full flex-col rounded-xl border p-3 text-left transition-colors",
                selected
                  ? "border-[var(--brand-700)] bg-[color-mix(in_srgb,var(--brand-700)_6%,transparent)]"
                  : "border-[var(--slate-200)]",
                interactive && !selected ? "cursor-pointer hover:border-[var(--slate-400)]" : "",
                !interactive ? "cursor-default" : "",
                dim ? "opacity-60" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--slate-900)]">{opt.label}</span>
                {selected ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--relleno-marca)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--on-fill)]">
                    <Check className="h-3 w-3" />
                    {context === "edit" ? "Activo" : "Elegido"}
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-xs text-[var(--slate-600)]">{opt.description}</p>

              <p className="mt-2 text-[11px] text-[var(--slate-500)]">
                <span className="font-medium text-[var(--slate-700)]">Para:</span> {opt.bestFor}
              </p>

              <ul className="mt-1.5 space-y-0.5">
                {opt.highlights.map((h) => (
                  <li key={h} className="flex gap-1.5 text-[11px] text-[var(--slate-600)]">
                    <span className="text-[var(--slate-400)]">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              {dim ? (
                <p className="mt-2 text-[10px] italic text-[var(--slate-400)]">
                  Disponible solo al crear el conjunto.
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
