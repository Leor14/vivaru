---
tags: [fuente, diseno, sistema-diseno]
tipo: fuente
fuentes: ["DESIGN.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Fuente: DESIGN.md

Especificación completa del sistema de diseño de Vivaru. Define tokens CSS, escala tipográfica, componentes clave, reglas de animación y patrones de layout para los cuatro portales.

## Contenido principal

DESIGN.md es la fuente de verdad para cualquier decisión visual. Cubre desde los valores exactos de los [[tokens-color|tokens CSS de color]] hasta los presupuestos de duración para cada tipo de animación. Todo desarrollador y diseñador debe consultar este documento antes de implementar un componente nuevo.

## Tokens y colores

El token primario `--brand-700: #0b3c5d` se usa en botones y navegación activa. El hover es `--brand-800: #092f49`. El fondo de página es `--background: #f4f7fb` y las cards usan `--surface-strong: #ffffff`. Los colores semánticos son emerald (Al día), amber (Pendiente) y red (Vencido), usados en [[billing]] y [[pqrs]]. Ver [[tokens-color]] para la lista completa.

## Tipografía y escala

Manrope es la fuente UI (`--font-sans`). Fraunces es display (`--font-display`) pero está suprimida dentro de `.admin-shell`. La escala va desde `.text-label` (10px/500) hasta `.text-display` (22px/500). Los valores KPI fluid (`kpi-value-fluid`, `kpi-value-fluid-xl`, `kpi-value-fluid-compact`) aplican en [[dashboard-admin]]. Ver [[tipografia]].

## Componentes documentados

Los componentes clave incluyen Button (variants: default/outline/ghost/danger; sizes: xs/sm/md/lg; `rounded-xl`), Card (`rounded-2xl`), Dialog (scale+opacity 200ms), [[drawer-pattern|Drawer]] (right-anchored, 480px desktop), HelpTip con createPortal, DataTable con `renderMobileRow`, StatusBadge e IconBadge. Ver [[componentes]].

## Animaciones

El presupuesto de duración es: botones 100–160ms, popovers 125–200ms, cards/panels 200–280ms. Las curvas son `--ease-out` para entradas, `--ease-in-out` para movimiento, `--ease-drawer` para drawers. La prohibición más importante: nunca `transition: all`. Ver [[animaciones]].

## Gaps conocidos

DESIGN.md registra explícitamente tres deudas técnicas: exit animation del Drawer faltante, ausencia de tokens dark mode, y uso de hex en lugar de OKLCH. También hay componentes viejos con `transition: all` que deben corregirse. Ver [[trampas-conocidas]] y [[absolute-bans]].

## Relaciones

- Véase también: [[product-md]], [[tokens-color]], [[tipografia]], [[componentes]]
- Depende de: —
- Se conecta con: [[animaciones]], [[layout-patterns]], [[drawer-pattern]], [[data-table-pattern]]

## Fuentes

- Archivo original: `/DESIGN.md` en el repositorio Vivaru
