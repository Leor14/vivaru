# DESIGN.md — Vivaru

> Design system extracted from the live codebase. Keep updated when tokens, components, or patterns change.
> Last extracted: 2026-05

---

## Color tokens

All tokens are CSS custom properties defined in `src/app/globals.css`.

### Brand palette (navy blue)
```css
--brand-50:  #e7f1fb   /* tint backgrounds, hover states */
--brand-200: #bdd4ea   /* borders, dividers with brand context */
--brand-700: #0b3c5d   /* PRIMARY — buttons, active nav, key actions */
--brand-800: #092f49   /* hover on brand-700 */
--brand-900: #08243a   /* pressed state, deep emphasis */
```

### Neutral palette (slate, blue-tinted)
```css
--slate-100: #f2f5f8   /* skeleton loaders, hover on white surfaces */
--slate-200: #d9e2ec   /* borders, dividers, input outlines */
--slate-300: #c2ccda   /* disabled borders, secondary dividers */
--slate-500: #607286   /* secondary text, labels, captions */
--slate-600: #4c5f74   /* body text, descriptions */
--slate-700: #33485f   /* medium emphasis text */
--slate-900: #152536   /* headings, primary text */
```

### Surface tokens
```css
--background:     #f4f7fb   /* page background (light blue-gray) */
--surface-strong: #ffffff   /* cards, panels, elevated surfaces */
--surface-soft:   #f7fafc   /* footer areas, subtle section backgrounds */
```

### Semantic / Status colors
These are Tailwind's defaults used via class names, not CSS variables:
- **Success / Al día**: `emerald-500`, `emerald-50`, `emerald-700`
- **Warning / Pendiente**: `amber-400`, `amber-50`, `amber-700`
- **Danger / Vencido**: `red-500`, `red-50`, `red-700`
- **Danger actions**: `--danger-600: #b42318`, `--danger-700: #8e1c13`

### Icon color system (semantic tints)
Each icon role has a `muted` (idle) and `active` (selected/hover) pair:
```css
/* Sky */
--icon-sky-muted-bg:    #ebf4ff   --icon-sky-muted-fg:    #476687
--icon-sky-active-bg:   #d9eaff   --icon-sky-active-fg:   #274a71

/* Mint */
--icon-mint-muted-bg:   #ecf8f4   --icon-mint-muted-fg:   #3f6d63
--icon-mint-active-bg:  #d8f0e8   --icon-mint-active-fg:  #25584f

/* Peach */
--icon-peach-muted-bg:  #fff1e8   --icon-peach-muted-fg:  #7f5c47
--icon-peach-active-bg: #ffe4d3   --icon-peach-active-fg: #70432b

/* Sand */
--icon-sand-muted-bg:   #fbf3e3   --icon-sand-muted-fg:   #6e5d40
--icon-sand-active-bg:  #f4e7c9   --icon-sand-active-fg:  #5b4a2e

/* Lavender */
--icon-lavender-muted-bg:  #f1eefc   --icon-lavender-muted-fg:  #5d5782
--icon-lavender-active-bg: #e2dcf7   --icon-lavender-active-fg: #433c69
```

---

## Typography

### Font families
| Role | Font | Variable |
|---|---|---|
| UI / body / data | **Manrope** (geometric sans) | `--font-sans`, `var(--font-manrope)` |
| Display / page titles | **Fraunces** (optical serif) | `--font-display`, `var(--font-fraunces)` |

Fraunces applies to `h1`, `h2`, `h3` globally. The admin shell suppresses it via the `.admin-shell` class.

### Type scale (admin shell)
Defined as utility classes in `globals.css`:
```css
.text-display  { font-size: 22px; font-weight: 500; line-height: 1.3; }
.text-heading  { font-size: 18px; font-weight: 500; line-height: 1.4; }
.text-subhead  { font-size: 16px; font-weight: 500; }
.text-body     { font-size: 13px; font-weight: 400; }
.text-label    { font-size: 10px; font-weight: 500; letter-spacing: wide; }
```

### KPI value scale (fluid)
For dashboard numbers that must adapt to container width:
```css
.kpi-value-fluid         /* clamp(1.05rem, 0.95vw + 0.75rem, 1.75rem) */
.kpi-value-fluid-xl      /* clamp(1.2rem, 1.3vw + 0.8rem, 2rem) */
.kpi-value-fluid-compact /* clamp(1rem, 0.85vw + 0.7rem, 1.3rem) */
```
All use `font-variant-numeric: tabular-nums` for aligned number columns.

---

## Easing curves

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1)     /* enter animations, responsive feedback */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)    /* on-screen movement */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)     /* drawers, sheets */
```

---

## Elevation / Shadow

| Level | Token / class | Use |
|---|---|---|
| **Card** | `shadow-[0_8px_22px_rgba(12,33,53,0.08)]` | Standard card elevation |
| **Hover card** | `.premium-card-hover` — adds `translateY(-2px)` + stronger shadow on hover | Interactive cards |
| **Dialog / Drawer** | `shadow-2xl` (Tailwind) | Overlays |

---

## Spacing rhythm

No formal spacing scale token — uses Tailwind's default 4px base. Key patterns observed:

- **Page padding**: `px-4 py-4` mobile, `px-5 py-5` desktop
- **Card internal**: `p-4` default, `p-5` for spacious variants
- **Section gaps**: `gap-3` (dense), `gap-4` (standard), `gap-6` (loose)
- **Form groups**: `space-y-4`
- **Inline icon + text**: `gap-2` (tight), `gap-3` (standard)

---

## Component library

All components are custom-built (no Radix, no shadcn). Located in `src/components/`.

### Core UI (`src/components/ui/`)

#### `Button`
```
variants: default | outline | ghost | danger
sizes:    xs (h-8) | sm (h-10 px-3) | md (h-10 px-4, default) | lg (h-11 px-5)
```
- Default: `bg-brand-700`, `hover:scale-[1.02]`, `active:scale-[0.98]`
- Rounded: `rounded-xl`
- Has `motion-reduce:transform-none`

#### `Card`
```
rounded-2xl border border-slate-200 bg-surface-strong p-4
shadow-[0_8px_22px_rgba(12,33,53,0.08)]
```
Sub-components: `CardTitle` (text-base semibold slate-900), `CardDescription` (text-sm slate-600)

#### `Dialog`
Custom portal component. Enter/exit animation: `scale(0.95) + opacity` → `scale(1) + opacity:1`, 200ms `--ease-out`. Uses `data-state="open|closed"` pattern.

#### `Drawer`
Custom slide-over (right-anchored). 480px wide on desktop, full-width mobile. Has header, scrollable body, optional sticky footer. Easing: `cubic-bezier(0,0,0.2,1)` 300ms. **TODO**: Switch to `--ease-drawer`, add exit animation.

#### `StatusBadge`, `IconBadge`
Semantic color badges using the icon color system above.

#### `Skeleton`
Animated pulse loader. Used during data fetch.

#### `Input`, `Textarea`, `Checkbox`, `RadioGroup`
Standard form controls. Border `slate-200`, focus ring `brand-500`.

### Shared components (`src/components/shared/`)

#### `HelpTip`
Inline `?` icon with tooltip (Radix Tooltip). Used to explain financial and administrative terms inline without cluttering labels.

#### `MetricCard`
Compact KPI tile. Used on resident home (Saldo pendiente, Próxima reserva, Visitantes activos, Paquetes pendientes).

#### `EmptyState`
Centered icon + title + description. Used when collections are empty.

### Feature components (`src/components/features/`)

#### Billing
- `BillingHeroCard` — Financial status summary. States: paid / pending / overdue. Shows saldo pendiente, próximo vencimiento (or "vencido desde"), total pagado.
- `BillingPeriodCard` — Collapsible card per billing period. Expand/collapse via CSS grid trick (`grid-template-rows: 0fr → 1fr`). Shows detail rows with HelpTips and receipt upload section.
- `PaymentReceiptsReviewPanel` — Admin panel for reviewing submitted receipts.

#### Admin Dashboard
- `ExecutiveKpiCard` — Large KPI tile with trend indicator
- `ChartContainer` — Recharts wrapper with optional HelpTip
- `CompactDataTable` — Dense scrollable table
- `OperationalAlertsDrawer` — Slide-over showing all pending alerts
- Various widget components: `VisitorFlowWidget`, `PqrsAgingWidget`, `PackagesBodegaWidget`, etc.

---

## Animation patterns

### CSS animation classes (in `globals.css`)
```
.dialog-overlay      fade in/out 180ms --ease-out (data-state driven)
.dialog-panel        scale(0.95)+opacity → scale(1), 200ms --ease-out
.collapsible-grid    grid-template-rows 0fr→1fr, 220ms --ease-out
.collapsible-content opacity fade, 180ms --ease-out
billingCardIn        @keyframe: translateY(4px)+opacity → 0+1, stagger 60ms per item
```

### Rules
- Duration budget: buttons 100–160ms, small popovers 125–200ms, cards/panels 200–280ms
- Always specify exact CSS properties (never `transition: all`)
- Enter: `ease-out`. On-screen movement: `ease-in-out`. Hover/color: `ease`.
- Never animate `height`, `width`, `padding` directly — use `grid-template-rows` or `clip-path`
- All animations have `@media (prefers-reduced-motion: reduce)` fallbacks

---

## Layout patterns

### App shell
Two-column on desktop: fixed sidebar (240px) + scrollable main content area. Single column (top nav + hamburger) on mobile.

### Admin pages
Typical structure:
```
<Card>              ← page wrapper
  header (title + primary action button)
  filters / tabs
  data table or grid
  optional: drawer for detail/edit
</Card>
```

### Resident pages
```
<Card>              ← page wrapper
  CardTitle + CardDescription
  hero/summary section (BillingHeroCard, etc.)
  list of period/item cards with stagger
</Card>
```

### Grid usage
- KPI cards: `grid-cols-2 gap-3 sm:grid-cols-4`
- Form fields: `grid-cols-1 gap-4 sm:grid-cols-2`
- Dashboard widgets: `grid-cols-1 gap-4 lg:grid-cols-2`

---

## Copy conventions

- Language: Spanish (es-CO default, es-MX for Mexico tenants)
- Currency: formatted via `useTenantCurrency()` hook — handles COP, MXN
- Dates: `es-MX` locale via `toLocaleDateString`
- Status labels: "Al día" / "Pendiente" / "Vencido" (billing), "Activo" / "Inactivo" (people)
- Error messages: actionable, calm. Never "Error 500". Always "No fue posible [acción]. Intenta de nuevo."
- Empty states: title in noun form ("Sin movimientos"), description explains why/what to do
- No em dashes. Use commas, colons, or parentheses instead.

---

## Known gaps / TODOs

- `Drawer`: exit animation missing. Should use `--ease-drawer` on enter.
- No dark mode tokens defined.
- No OKLCH migration yet — all colors in hex. Migration recommended for fine-grained chroma control.
- `transition: all` in some older components — should be replaced with specific properties.
- `MetricCard` on resident home has no skeleton loading state matched to its layout.
