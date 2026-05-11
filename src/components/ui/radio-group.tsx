import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils/cn";

// ─── RadioItem ────────────────────────────────────────────────────────────────

interface RadioItemProps {
  value: string;
  label: string;
  name?: string;
  checked?: boolean;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export function RadioItem({ value, label, name, checked, onChange, disabled }: RadioItemProps) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-center gap-2 cursor-pointer select-none text-sm text-[var(--slate-800)]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(value)}
        className={cn(
          "h-4 w-4 cursor-pointer border-[var(--slate-300)] text-[var(--brand-700)]",
          "accent-[var(--brand-700)]",
          disabled && "cursor-not-allowed",
        )}
      />
      {label}
    </label>
  );
}

// ─── RadioGroup ───────────────────────────────────────────────────────────────

interface RadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  name: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, onChange, name, children, className, ...rest }, ref) => {
    // Clone children to inject name, checked, and onChange
    const items = Array.isArray(children) ? children : [children];
    const cloned = items.map((child, index) => {
      if (!child || typeof child !== "object" || !("props" in child)) return child;
      const item = child as React.ReactElement<RadioItemProps>;
      return {
        ...item,
        key: item.key ?? index,
        props: {
          ...item.props,
          name,
          checked: item.props.value === value,
          onChange,
        },
      };
    });

    return (
      <div
        ref={ref}
        role="radiogroup"
        className={cn("flex flex-col gap-2", className)}
        {...rest}
      >
        {cloned}
      </div>
    );
  },
);

RadioGroup.displayName = "RadioGroup";
