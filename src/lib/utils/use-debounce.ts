"use client";

import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that updates only after `delayMs`
 * has elapsed without changes. Use for filter inputs that drive expensive
 * lists or remote queries.
 */
export function useDebounce<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
