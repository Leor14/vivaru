---
tags: [diseno, animaciones, motion]
tipo: herramienta
fuentes: ["DESIGN.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Animaciones

Sistema de animación de Vivaru. Define curvas de easing, presupuestos de duración por tipo de elemento, keyframes reutilizables y las prohibiciones absolutas de motion que se clasifican como bug si se violan.

## Curvas de easing

| Variable CSS | Valor | Uso |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Entradas — elementos que aparecen |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Movimiento en pantalla — reordenamiento |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Apertura del Drawer — énfasis en el arranque |

## Presupuestos de duración

- Botones (escala, color): 100–160ms
- Popovers y tooltips: 125–200ms
- Cards y paneles: 200–280ms
- Drawers: 300ms (apertura); exit animation pendiente — usar `--ease-drawer`

## Keyframes reutilizables

**`collapsible-grid`**: expande/colapsa contenido usando `grid-template-rows: 0fr → 1fr`, 220ms `--ease-out`. Evita animar `height` directamente (causa reflow y jank).

**`billingCardIn`**: `@keyframe` con `translateY(4px) + opacity(0)` → `translateY(0) + opacity(1)`. Stagger de 60ms entre tarjetas consecutivas. Usado en [[billing]].

## Prohibiciones absolutas

Las siguientes prácticas son bug 🔴 per [[absolute-bans]]:
- `transition: all` — siempre especificar la propiedad: `transition-colors`, `transition-[width]`, `transition-transform`
- Animar `height`, `width` o `padding` directamente — usar `grid-template-rows` o `clip-path`

## Accesibilidad

Todos los keyframes deben tener fallback para `@media (prefers-reduced-motion: reduce)`. El patrón estándar:
```css
@media (prefers-reduced-motion: reduce) {
  .elemento { animation: none; transition: none; }
}
```

## Deuda técnica

La exit animation del Drawer está faltante (registrado en [[design-md]]). Al cerrar, el Drawer desaparece sin animación. La solución es `data-state="closed"` → `translateX(100%)` con `--ease-drawer`.

## Relaciones

- Véase también: [[design-md]], [[componentes]], [[drawer-pattern]], [[transiciones-navegacion]]
- Depende de: [[absolute-bans]]
- Se conecta con: [[tokens-color]], [[billing]], [[layout-patterns]], [[mobile-first-ios]], [[onboarding-guiado]]

El velo de navegación con el logo —dónde se aplica, dónde deliberadamente no, y por qué la frecuencia de uso decide si algo debe animarse— vive en [[transiciones-navegacion]].

## Fuentes

- [[design-md]]
