---
tags: [diseno, tokens, color]
tipo: herramienta
fuentes: ["DESIGN.md", "consolidacion-landing-2026", "globals-css"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-31
---

# Tokens de Color

Sistema de tokens CSS que define la paleta completa de Vivaru. Todos los valores son variables CSS custom. El **SaaS** los define como variables en `:root`. El [[landing-marketing|landing]] los define en `@theme` de Tailwind v4 dentro de `globals.css`, generando utilidades de clase automáticamente (ej: `--color-navy` → `bg-navy`, `text-navy`). Nunca usar valores hexadecimales hardcodeados en componentes.

## Paleta de marca — SaaS (`/admin`, `/resident`, `/guard`)

| Token | Valor | Uso |
|---|---|---|
| `--brand-700` | `#0b3c5d` | Botones primary, nav activo — color principal |
| `--brand-800` | `#092f49` | Hover de botones y nav |
| `--brand-50` | `#e7f1fb` | Fondos tint, backgrounds secundarios |
| `--background` | `#f4f7fb` | Fondo de página |
| `--surface-strong` | `#ffffff` | Cards, modals, drawers |
| `--slate-900` | `#152536` | Headings, texto principal |
| `--slate-500` | `#607286` | Texto secundario, labels |

## Colores semánticos de estado

Usados en [[billing]], [[pqrs]], [[visitantes]] y [[portal-residente]]:
- **Emerald** — "Al día" (pagos al corriente, visita completada)
- **Amber** — "Pendiente" (pago pendiente, ticket en progreso)
- **Red** — "Vencido" (pago vencido, ticket urgente)

La regla: nunca usar estos colores para propósitos distintos a su semántica. Un elemento "al día" siempre es emerald — no azul, no verde oscuro.

## Icon semantic tints

Para iconos y badges de módulos, los tints disponibles en pares muted/active son:
- **sky**: módulos de comunicación ([[comunicaciones]], [[visitantes]])
- **mint**: módulos de estado positivo
- **peach**: alertas suaves
- **sand**: elementos neutros
- **lavender**: módulos de configuración ([[configuracion]], [[usuarios]])

## Elevación y sombras

- Card: `shadow-[0_8px_22px_rgba(12,33,53,0.08)]`
- Hover: `.premium-card-hover` — translateY(-2px) + sombra más fuerte
- Dialog/Drawer: `shadow-2xl`

Los [[absolute-bans|bans activos]] prohíben glassmorphism decorativo y gradientes de texto, que violan la paleta institucional.

## Paleta de marca — Landing (`/mx`, route group marketing)

Definidos en `@theme` de `globals.css` (Tailwind v4). Generan utilidades automáticamente en kebab-case. ⚠️ En Tailwind v4, los nombres deben ser kebab-case — las clases camelCase del v3 (`bg-brand-greenResident`) ya no funcionan.

| Token CSS | Clase Tailwind | Valor | Uso en landing |
|---|---|---|---|
| `--color-navy` | `bg-navy`, `text-navy` | `#0B3C5D` | Headings h2, logotipo, Topbar |
| `--color-brand-blue` | `bg-brand-blue` | `#4B5FD4` | Plan Profesional, iconos Finanzas |
| `--color-brand-purple-deep` | `bg-brand-purple-deep` | `#7C3AED` | Icono Comunidad, plan |
| `--color-brand-teal` | `bg-brand-teal` | `#0D9488` | Icono Operaciones |
| `--color-brand-green-succ` | `bg-brand-green-succ` | `#22C55E` | Check icons de features |
| `--color-brand-green-resident` | `bg-brand-green-resident` | `#16A34A` | Tab Residente en Perspectives |
| `--color-brand-plum-dark` | `bg-brand-plum-dark` | `#581C87` | Tab Portería en Perspectives |
| `--color-brand-amber` | `bg-brand-amber` | `#F59E0B` | Icono Portería digital |
| `--color-brand-red` | `bg-brand-red` | `#EF4444` | Icono Gobernanza |

## Tokens de espaciado — Landing (⚠️ colisión con max-w-*)

Los tokens de espaciado semántico también viven en `@theme`:

| Token | Valor | Uso |
|---|---|---|
| `--spacing-xs` | 4px | Gaps mínimos |
| `--spacing-sm` | 8px | `mt-sm`, separaciones pequeñas |
| `--spacing-md` | 16px | `mt-md`, espaciado de cards |
| `--spacing-lg` | 24px | `p-lg`, padding de cards |
| `--spacing-xl` | 32px | `py-xl`, secciones |
| `--spacing-xxl` | 64px | `py-xxl`, secciones grandes |
| `--spacing-3xl` | 96px | Secciones hero |

⚠️ Estos tokens colisionan con `max-w-sm`, `max-w-md`, `max-w-lg`, `max-w-xl`, `max-w-3xl` en Tailwind v4. El fix está en [[tailwind-v4-spacing-fix]] — sin él, los textos se renderizan a 8–96px de ancho.

## Sin dark mode (deuda técnica)

No existen tokens de dark mode ni en el SaaS ni en el landing. Si se necesita en el futuro, requerirá una migración completa de hex a OKLCH. Ver [[design-md]] para el registro de esta deuda técnica.

## Relaciones

- Véase también: [[design-md]], [[tipografia]], [[componentes]], [[tailwind-v4-spacing-fix]]
- Depende de: [[product-md]]
- Se conecta con: [[billing]], [[pqrs]], [[animaciones]], [[absolute-bans]], [[landing-marketing]]

## Fuentes

- [[design-md]], [[consolidacion-landing-2026]], [[globals-css]]
