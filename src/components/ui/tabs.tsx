"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * **Las pestañas del producto, en un solo sitio (pasada 3).**
 *
 * Había **cuatro barras hechas a mano** en el portal de administración —
 * `billing`, `settings`, `regulations`, `documents`— y ninguna llevaba
 * `role="tablist"`, `role="tab"` ni `aria-selected`: para un lector de pantalla
 * eran cinco botones sueltos, y con el teclado había que tabular por cada uno.
 *
 * El patrón bueno **ya existía en el producto**, en el portal del residente
 * (`resident/pqrs`, `resident/reservations`): de ahí sale esto, con la
 * navegación por flechas que es lo que espera un `tablist`.
 *
 * **Los dos estilos son los dos que ya se pintan hoy**, copiados clase por
 * clase. Esta pasada no cambia el aspecto de ninguna pantalla:
 *
 *   - `underline` — `settings`, `documents`, `regulations`.
 *   - `segmented` — `billing` y las dos del residente.
 */

export type TabItem<K extends string = string> = {
  key: K;
  label: string;
};

const ESTILO = {
  underline: {
    lista: "flex gap-1 border-b border-[var(--slate-200)]",
    base: "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
    activo: "border-[var(--brand-700)] text-[var(--brand-700)]",
    inactivo: "border-transparent text-[var(--slate-500)] hover:text-[var(--slate-700)]",
  },
  segmented: {
    lista: "inline-flex flex-wrap rounded-xl border border-[var(--slate-300)] bg-white p-0.5",
    base: "rounded-lg px-3 py-1.5 text-sm transition-colors",
    activo: "bg-[var(--slate-900)] text-white",
    inactivo: "text-[var(--slate-600)] hover:text-[var(--slate-900)]",
  },
  /** Ancho completo y repartido: el del portal del residente, que es móvil. */
  pill: {
    lista: "flex w-full items-center gap-1 rounded-xl border border-[var(--slate-200)] bg-white p-1 shadow-sm",
    base: "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
    activo: "bg-[var(--brand-700)] text-white",
    inactivo: "text-[var(--slate-700)] hover:bg-[var(--slate-100)]",
  },
} as const;

export function Tabs<K extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  variant = "underline",
  className,
}: {
  items: readonly TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Qué agrupa esta barra, para quien la oye en vez de verla. */
  ariaLabel: string;
  variant?: keyof typeof ESTILO;
  className?: string;
}) {
  const estilo = ESTILO[variant];
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  /**
   * Flechas, Inicio y Fin, que es lo que un `tablist` promete al declararse
   * como tal. Sin esto el rol sería una etiqueta que miente.
   */
  function alPulsarTecla(event: React.KeyboardEvent) {
    const teclas = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!teclas.includes(event.key)) return;
    event.preventDefault();
    const i = items.findIndex((item) => item.key === value);
    const siguiente =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (i + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    const destino = items[siguiente];
    if (!destino) return;
    onChange(destino.key);
    refs.current[destino.key]?.focus();
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className={cn(estilo.lista, className)} onKeyDown={alPulsarTecla}>
      {items.map((item) => {
        const activo = item.key === value;
        return (
          <button
            key={item.key}
            ref={(nodo) => {
              refs.current[item.key] = nodo;
            }}
            type="button"
            role="tab"
            aria-selected={activo}
            // Un solo punto de tabulación en toda la barra: se entra con Tab y
            // se recorre con las flechas, que es cómo funciona un `tablist`.
            tabIndex={activo ? 0 : -1}
            onClick={() => onChange(item.key)}
            className={cn(estilo.base, activo ? estilo.activo : estilo.inactivo)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
