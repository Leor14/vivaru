"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import {
  countryByCode,
  flagFor,
  orderedCountries,
  searchCountries,
  type Country,
} from "@/lib/countries";
import { cn } from "@/lib/utils/cn";

/**
 * Selector de país con búsqueda.
 *
 * No es un `<select>` nativo porque con doscientas opciones el nativo solo deja
 * saltar por la primera letra: quien busca «México» y escribe «mex» acaba en
 * Malasia, Malta y Marruecos. Aquí se filtra por nombre, código o indicativo,
 * porque al buscar un país uno teclea lo que tiene a mano y no lo que la lista
 * espera.
 *
 * `variant="dial"` lo usa el campo de teléfono: muestra bandera e indicativo en
 * vez del nombre, para que quepa pegado al número.
 */
export function CountrySelect({
  value,
  onChange,
  variant = "full",
  className,
  ariaLabel = "País",
}: {
  value: string;
  onChange: (code: string) => void;
  variant?: "full" | "dial";
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = countryByCode(value) ?? orderedCountries()[0];
  const results = useMemo(() => searchCountries(query), [query]);

  // Cerrar al pulsar fuera: sin esto el panel se queda abierto sobre el resto
  // del formulario y tapa el botón de continuar.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      // El foco va al buscador, no al botón: se abre para escribir.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function choose(country: Country) {
    onChange(country.code);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter" && results[highlight]) {
      event.preventDefault();
      choose(results[highlight]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)]",
          "[transition:border-color_150ms_var(--ease-out)] hover:border-[var(--slate-400)]",
          variant === "dial" && "w-auto min-w-[104px] justify-between",
        )}
      >
        <span aria-hidden className="text-base leading-none">{flagFor(selected.code)}</span>
        {variant === "dial" ? (
          <span className="tabular-nums">+{selected.dial}</span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-left">{selected.name}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--slate-500)]" aria-hidden />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--slate-200)] bg-white shadow-[0_12px_32px_rgba(12,33,53,0.14)]">
          <div className="flex items-center gap-2 border-b border-[var(--slate-100)] px-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--slate-500)]" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Busca país o indicativo"
              aria-controls={listId}
              aria-autocomplete="list"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-[var(--slate-500)]"
            />
          </div>

          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-[var(--slate-500)]">
                Ningún país coincide con «{query}».
              </li>
            ) : (
              results.map((country, index) => {
                const active = country.code === selected.code;
                return (
                  <li key={country.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => choose(country)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
                        index === highlight ? "bg-[var(--brand-50)]" : "bg-white",
                      )}
                    >
                      <span aria-hidden className="text-base leading-none">{flagFor(country.code)}</span>
                      <span className="min-w-0 flex-1 truncate text-[var(--slate-900)]">{country.name}</span>
                      <span className="shrink-0 tabular-nums text-xs text-[var(--slate-500)]">
                        +{country.dial}
                      </span>
                      {active ? (
                        <Check className="h-4 w-4 shrink-0 text-[var(--brand-700)]" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
