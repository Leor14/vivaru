"use client";

import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { es } from "react-day-picker/locale";

import { cn } from "@/lib/utils/cn";

import "react-day-picker/style.css";

export type RangePickerValue = {
  from: Date;
  to: Date;
};

type RangePickerProps = {
  value: RangePickerValue | null;
  onChange: (value: RangePickerValue) => void;
  /** Earliest selectable date. Defaults to 5 years ago. */
  minDate?: Date;
  /** Latest selectable date. Defaults to today. */
  maxDate?: Date;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
};

const SHORT_MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function formatShort(date: Date): string {
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type Preset = "this-month" | "last-month" | "last-quarter" | "ytd";

function buildPreset(preset: Preset, today = new Date()): RangePickerValue {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (preset) {
    case "this-month":
      return { from: startOfMonth(t), to: endOfMonth(t) };
    case "last-month": {
      const prev = addMonths(t, -1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "last-quarter":
      return { from: startOfMonth(addMonths(t, -2)), to: endOfMonth(t) };
    case "ytd":
      return { from: new Date(t.getFullYear(), 0, 1), to: t };
  }
}

export function RangePicker({
  value,
  onChange,
  minDate,
  maxDate,
  className,
  triggerClassName,
  placeholder = "Seleccionar rango",
}: RangePickerProps) {
  const [open, setOpen] = useState(false);
  const [leftMonth, setLeftMonth] = useState<Date>(() => {
    if (value?.from) return startOfMonth(value.from);
    return startOfMonth(addMonths(new Date(), -1));
  });
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() =>
    value ? { from: value.from, to: value.to } : undefined,
  );
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setDraftRange(value ? { from: value.from, to: value.to } : undefined);
      if (value?.from) setLeftMonth(startOfMonth(value.from));
    }
  }, [open, value]);

  const triggerLabel = useMemo(() => {
    if (!value) return placeholder;
    return `${formatShort(value.from)} — ${formatShort(value.to)}`;
  }, [value, placeholder]);

  const rightMonth = useMemo(() => addMonths(leftMonth, 1), [leftMonth]);

  function handleSelect(next: DateRange | undefined) {
    setDraftRange(next);
    if (next?.from && next?.to && !isSameDay(next.from, next.to)) {
      onChange({ from: next.from, to: next.to });
      setOpen(false);
    }
  }

  function handleApplyPreset(preset: Preset) {
    const next = buildPreset(preset);
    setDraftRange(next);
    setLeftMonth(startOfMonth(next.from));
  }

  function handleApply() {
    if (draftRange?.from && draftRange?.to) {
      onChange({ from: draftRange.from, to: draftRange.to });
    } else if (draftRange?.from) {
      onChange({ from: draftRange.from, to: draftRange.from });
    }
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[var(--slate-300)] px-3 text-sm text-[var(--slate-900)] transition hover:border-[var(--slate-400)]",
          triggerClassName,
        )}
        style={{ backgroundColor: "var(--color-background-secondary, var(--surface-soft))" }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-[var(--slate-500)]" />
          <span className="truncate">{triggerLabel}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--slate-500)] transition", open ? "rotate-180" : "")} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Seleccionar rango de fechas"
          className="vivaru-rangepicker absolute right-0 z-40 mt-2 rounded-2xl border border-[var(--slate-200)] bg-white shadow-[0_18px_40px_rgba(10,40,70,0.12)]"
          style={{ minWidth: 620 }}
        >
          <div className="flex">
            <div className="relative flex-1 px-3 pt-3">
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--slate-600)] hover:bg-[var(--surface-soft)]"
                  onClick={() => setLeftMonth((prev) => addMonths(prev, -1))}
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium capitalize text-[var(--slate-900)]">
                  {leftMonth.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}
                </span>
                <span className="h-7 w-7" aria-hidden />
              </div>
              <DayPicker
                mode="range"
                selected={draftRange}
                onSelect={handleSelect}
                month={leftMonth}
                onMonthChange={setLeftMonth}
                locale={es}
                weekStartsOn={1}
                numberOfMonths={1}
                disabled={[
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]}
                hideNavigation
                classNames={{
                  caption: "hidden",
                  caption_label: "hidden",
                  nav: "hidden",
                  month_caption: "hidden",
                }}
              />
            </div>
            <div className="w-px self-stretch bg-[var(--slate-200)]" aria-hidden />
            <div className="relative flex-1 px-3 pt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="h-7 w-7" aria-hidden />
                <span className="text-sm font-medium capitalize text-[var(--slate-900)]">
                  {rightMonth.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}
                </span>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--slate-600)] hover:bg-[var(--surface-soft)]"
                  onClick={() => setLeftMonth((prev) => addMonths(prev, 1))}
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <DayPicker
                mode="range"
                selected={draftRange}
                onSelect={handleSelect}
                month={rightMonth}
                locale={es}
                weekStartsOn={1}
                numberOfMonths={1}
                disabled={[
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]}
                hideNavigation
                classNames={{
                  caption: "hidden",
                  caption_label: "hidden",
                  nav: "hidden",
                  month_caption: "hidden",
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--slate-200)] px-3 py-2">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-[var(--slate-700)] hover:bg-[var(--surface-soft)]"
                onClick={() => handleApplyPreset("this-month")}
              >
                Este mes
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-[var(--slate-700)] hover:bg-[var(--surface-soft)]"
                onClick={() => handleApplyPreset("last-month")}
              >
                Mes anterior
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-[var(--slate-700)] hover:bg-[var(--surface-soft)]"
                onClick={() => handleApplyPreset("last-quarter")}
              >
                Último trimestre
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-[var(--slate-700)] hover:bg-[var(--surface-soft)]"
                onClick={() => handleApplyPreset("ytd")}
              >
                Año en curso
              </button>
            </div>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#185FA5" }}
              disabled={!draftRange?.from}
            >
              Aplicar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
