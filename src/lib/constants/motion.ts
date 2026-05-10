/**
 * Vivaru — Motion System
 *
 * Philosophy (Emil Kowalski):
 *   - Animate only what earns it. High-frequency UI (nav tabs, toggles) → no animation.
 *   - Nothing appears from nothing: exits use accelerate, entrances use decelerate.
 *   - Specify exact properties — avoid `transition-all` on paint-heavy props in hot paths.
 *   - Tone: trustworthy, operational. Duration stays short. Never playful or theatrical.
 *
 * Usage guide:
 *   TRANSITION.base  → buttons, badges, form fields, most interactive elements
 *   TRANSITION.slow  → modals, drawers, cards entering viewport
 *   TRANSITION.fast  → hover color/shadow changes, icon swaps
 *
 * Framer Motion: not installed. Use Tailwind TRANSITION classes + CSS custom properties.
 * If Framer Motion is added later, map DURATION + EASING into motion variants here.
 */

// ─── Durations (ms) ──────────────────────────────────────────────────────────

export const DURATION = {
  /** Hover states, button press feedback, icon swaps */
  fast: 150,
  /** Standard transitions: form fields, badges, most interactive elements */
  base: 200,
  /** Modals, drawers, cards entering/leaving the screen */
  slow: 300,
} as const;

// ─── Easing curves ────────────────────────────────────────────────────────────

/**
 * Cubic bezier arrays — ready to pass to CSS `cubic-bezier()` or future Framer variants.
 *
 * standard   → most UI elements (enter + exit balanced)
 * decelerate → elements entering the screen (start fast, settle gently)
 * accelerate → elements leaving the screen (start slow, exit decisively)
 */
export const EASING = {
  standard: [0.4, 0, 0.2, 1] as const,
  decelerate: [0, 0, 0.2, 1] as const,
  accelerate: [0.4, 0, 1, 1] as const,
} as const;

// ─── Tailwind transition presets ──────────────────────────────────────────────

/**
 * Drop these class strings onto any element.
 * Prefer TRANSITION.fast for colour/opacity changes (GPU-composited).
 * Prefer TRANSITION.slow on transform for modals/drawers entering.
 *
 * Avoid on list items rendered 50+ times — prefer CSS :hover without JS class toggling.
 */
export const TRANSITION = {
  fast: "transition-all duration-150 ease-out",
  base: "transition-all duration-200 ease-out",
  slow: "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
} as const;

export type Duration = (typeof DURATION)[keyof typeof DURATION];
export type TransitionClass = (typeof TRANSITION)[keyof typeof TRANSITION];
