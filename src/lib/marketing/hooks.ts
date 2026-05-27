"use client";

import * as React from "react";

/**
 * Reads `prefers-reduced-motion` and re-renders on changes. SSR-safe:
 * returns `false` during the first render so server markup matches client.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}

/**
 * Fires once when the referenced node first intersects the viewport above
 * `threshold` (0..1). Returns `[ref, hasIntersected]`.
 */
export function useInView<T extends Element = HTMLElement>(
  threshold = 0.25,
): [React.MutableRefObject<T | null>, boolean] {
  const ref = React.useRef<T | null>(null);
  const [seen, setSeen] = React.useState(false);

  React.useEffect(() => {
    if (seen) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [seen, threshold]);

  return [ref, seen];
}

/**
 * Linear ease-out tween from 0 → `target` over `durationMs`, returned as
 * the current frame value. When `active` is false the hook returns 0 and
 * does no work. When `reduce` is true the hook snaps to `target`
 * immediately (no animation), respecting `prefers-reduced-motion`.
 */
export function useCountUp(
  target: number,
  active: boolean,
  { durationMs = 800, reduce = false }: { durationMs?: number; reduce?: boolean } = {},
): number {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (!active) return;
    if (reduce || durationMs <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, durationMs, reduce, target]);

  return value;
}
