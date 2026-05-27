/**
 * Vivaru Landing — Design Tokens
 *
 * Single source of truth for color, typography, spacing, radius, shadow,
 * z-index and motion. Imported by tailwind.config.ts via CommonJS shim
 * (see tailwind.config.ts → `require('./src/lib/tokens')` is NOT used;
 * tokens are duplicated in the Tailwind theme to keep tree-shaking simple,
 * but every value below is the canonical reference).
 *
 * Brand identity is LOCKED per plan section 1 + section 8:
 *   - Navy #0B3C5D    → max 15% of any surface (background accent, never fill)
 *   - Blue #4B5FD4    → primary CTA, active links
 *   - Purple #9B59B6  → high-jerarquía decorative accents (logo gradient)
 *   - Greens (#16A34A, #1A7A45) → success + Residente surface
 *   - Slate neutrals  → 70%+ of the page (white space + text)
 *
 * Anti-patterns rejected here (per plan):
 *   - WhatsApp green (#25D366) — informal channel association
 *   - Neon-on-dark fintech palettes — alarmante
 *   - Glassmorphism aggressive — wrong category signal
 */

export const colors = {
  navy: '#0B3C5D',
  navyDark: '#0B1F3A',
  blue: '#4B5FD4',
  blueLight: '#A8C4E8',
  purple: '#9B59B6',
  purpleDeep: '#7C3AED',
  teal: '#0891B2',
  green: '#059669',
  greenSucc: '#16A34A',
  greenResident: '#1A7A45',
  amber: '#D97706',
  red: '#DC2626',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate600: '#475569',
  slate900: '#0F172A',
  white: '#FFFFFF',
} as const;

export const typography = {
  fontDisplay: 'var(--font-fraunces), Georgia, serif',
  fontUI: 'var(--font-manrope), "Inter", system-ui, sans-serif',
  sizes: {
    hero: ['56px', '72px'], // [mobile, desktop]
    h1: ['36px', '48px'],
    h2: ['28px', '36px'],
    h3: ['20px', '24px'],
    body: ['16px', '16px'],
    sm: ['14px', '14px'],
    xs: ['12px', '12px'],
  },
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.65 },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '64px',
} as const;

export const radii = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '20px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
  md: '0 4px 12px rgba(15, 23, 42, 0.08)',
  lg: '0 10px 30px rgba(15, 23, 42, 0.12)',
} as const;

export const zIndex = {
  base: 1,
  dropdown: 10,
  sticky: 20,
  modal: 50,
  toast: 60,
} as const;

export const motion = {
  fast: '150ms',
  base: '250ms',
  slow: '400ms',
  easing: {
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  },
} as const;

export const tokens = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  zIndex,
  motion,
} as const;

export type Tokens = typeof tokens;
