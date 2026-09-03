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

// Emil: admin uses this menu constantly — animations must be fast and subtle.
// Trigger: active:scale-[0.97] for press feedback (no bounce, admin context).
// Dropdown: scale(0.97)+opacity-0 → scale(1)+opacity-1 in 130ms ease-out.
// Exit: 100ms ease-in (faster — user already decided to close).
// Close-on-outside-click waits for exit animation before unmounting.
const CLOSE_ANIMATION_MS = 110;

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
  const [dropdownMounted, setDropdownMounted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openMenu() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setDropdownMounted(true);
    requestAnimationFrame(() => setOpen(true));
  }

  function closeMenu() {
    setOpen(false);
    closeTimerRef.current = setTimeout(() => setDropdownMounted(false), CLOSE_ANIMATION_MS);
  }

  function toggleMenu() {
    if (open) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {/* Trigger — specific transition (not shorthand), active:scale press feedback */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggleMenu}
        className="row-actions-trigger inline-flex items-center justify-center bg-transparent text-[var(--slate-600)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-700)]"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: "0.5px solid var(--slate-300)",
        }}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Dropdown — animated with data-open, unmounts after exit animation */}
      {dropdownMounted ? (
        <div
          role="menu"
          aria-orientation="vertical"
          data-open={open ? "true" : "false"}
          className="row-actions-dropdown absolute right-0 z-30 mt-1 min-w-[176px] overflow-hidden bg-[var(--surface-strong)]"
          style={{
            border: "0.5px solid var(--slate-300)",
            borderRadius: 8,
            transformOrigin: "top right",
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
                      closeMenu();
                      item.onSelect();
                    }}
                    className={cn(
                      "row-actions-item flex w-full items-center gap-2 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50",
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
