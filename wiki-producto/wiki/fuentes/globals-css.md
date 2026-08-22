---
tags: [fuente, css, tokens, tailwind, diseno]
tipo: fuente
fuentes: ["src/app/globals.css"]
fecha_creacion: 2026-08-22
fecha_actualizacion: 2026-08-22
---

# `globals.css` — la fuente de los tokens

**1.049 líneas y unas 160 variables CSS.** Es el único sitio donde se declaran los tokens del
producto, y por eso lo citan [[tokens-color]], [[tipografia]], [[animaciones]] y
[[layout-patterns]]. Esta página existe porque esas cuatro lo enlazaban y no había nada al otro
lado.

## Lo que hay que saber antes de tocarlo

**Tailwind v4 no tiene `tailwind.config.ts`.** Los tokens se declaran aquí, en `:root`, y se
exponen a las utilidades con `@theme inline` — que es el puente, no un segundo catálogo:
`--color-background: var(--background)` toma el valor de la variable de arriba. Buscar la
configuración en un fichero JS es la primera pérdida de tiempo de quien llega, y el
[[stack-tecnico|stack]] lo advierte.

Arranca con `@import "tailwindcss"` y `@plugin "@tailwindcss/typography"`; no hay `@config`.

## Las cuatro familias de tokens

| Familia | Ejemplos | Dónde se explica |
|---|---|---|
| **Color** | `--background`, `--foreground`, la escala `--brand-*`, los semánticos de shadcn | [[tokens-color]] |
| **Tipografía** | `--font-sans` (Manrope), `--font-display` (Playfair) | [[tipografia]] |
| **Movimiento** | `--ease-in-out`, `--ease-drawer` —la curva de iOS tomada de Ionic— | [[animaciones]] |
| **Superficie y espaciado** | `--surface-strong`, `--surface-soft` | [[layout-patterns]] |

## Dos cosas que explican defectos reales

**`.marketing-theme` hace cascada sobre los semánticos.** El landing no hereda del sistema de
diseño del producto: reasigna las variables dentro de esa clase, y por eso los componentes de
shadcn cambian de piel sin cambiar de código. Es también el origen de una trampa que costó
encontrar —una regla de esa clase ganándole a las variantes responsive—, documentada en
[[trampas-conocidas]] y en [[tailwind-v4-spacing-fix]].

**Hay siete bloques `prefers-reduced-motion`.** La accesibilidad del movimiento no está
centralizada: cada familia de animación apaga la suya. Al añadir una transición nueva hay que
añadir su bloque, o queda fuera de la preferencia del sistema. Ver [[transiciones-navegacion]].

## Relaciones

- Véase también: [[design-md]], [[componentes]]
- Se conecta con: [[landing-marketing]], [[estructura-app-router]]

## Fuentes

- `src/app/globals.css` en el repositorio de Vivaru. **Es el original y manda sobre esta página.**
