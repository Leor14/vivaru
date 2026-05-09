"use client";

import { Eye, MoreHorizontal, PenSquare, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type RowActionsMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Render a divider above this item. */
  separatorBefore?: boolean;
};

export type RowActionsMenuProps = {
  /** Visible label for accessibility, e.g. the row's name. */
  ariaLabel?: string;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Additional fully-custom items inserted between Editar and Eliminar. */
  extraItems?: RowActionsMenuItem[];
  /** Override default items entirely. */
  items?: RowActionsMenuItem[];
  className?: string;
};

const DANGER_COLOR = "#A32D2D";

export function RowActionsMenu({
  ariaLabel = "Acciones de la fila",
  onView,
  onEdit,
  onDelete,
  extraItems,
  items,
  className,
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const resolvedItems: RowActionsMenuItem[] =
    items ??
    [
      onView
        ? {
            key: "view",
            label: "Ver detalle",
            icon: <Eye className="h-3.5 w-3.5" />,
            onSelect: onView,
          }
        : null,
      onEdit
        ? {
            key: "edit",
            label: "Editar",
            icon: <PenSquare className="h-3.5 w-3.5" />,
            onSelect: onEdit,
          }
        : null,
      ...(extraItems ?? []),
      onDelete
        ? {
            key: "delete",
            label: "Eliminar",
            icon: <Trash2 className="h-3.5 w-3.5" />,
            onSelect: onDelete,
            danger: true,
            separatorBefore: true,
          }
        : null,
    ].filter((item): item is RowActionsMenuItem => Boolean(item));

  if (resolvedItems.length === 0) return null;

  return (
    <div ref={wrapperRef} className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center justify-center bg-transparent text-[var(--slate-600)] transition hover:bg-[var(--slate-100)] hover:text-[var(--slate-900)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-700)]"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: "0.5px solid var(--slate-300)",
        }}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 z-30 mt-1 min-w-[176px] overflow-hidden bg-white"
          style={{
            border: "0.5px solid var(--slate-300)",
            borderRadius: 8,
            boxShadow: "none",
          }}
        >
          <ul className="py-1">
            {resolvedItems.map((item, index) => {
              const showSeparator = item.separatorBefore && index > 0;
              return (
                <li key={item.key}>
                  {showSeparator ? (
                    <div
                      role="separator"
                      className="my-1"
                      style={{ borderTop: "0.5px solid var(--slate-200)" }}
                    />
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      if (item.disabled) return;
                      setOpen(false);
                      item.onSelect();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                      "hover:bg-[var(--surface-soft)]",
                    )}
                    style={{
                      fontSize: 13,
                      color: item.danger ? DANGER_COLOR : "var(--slate-800)",
                    }}
                  >
                    {item.icon ? <span className="inline-flex h-3.5 w-3.5 items-center justify-center">{item.icon}</span> : null}
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
