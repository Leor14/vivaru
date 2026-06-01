---
tags: [patron, drawer, modal, ux]
tipo: tecnica
fuentes: ["DESIGN.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Patrón Drawer

El Drawer es el componente para flujos complejos de más de un paso. Reemplaza al modal cuando el formulario tiene múltiples campos, sub-acciones o requiere navegación interna. Esta distinción está en [[absolute-bans]]: usar Modal para flujos complejos es un bug 🔴.

## Cuándo usar Drawer vs Dialog vs Modal

| Componente | Usar para |
|---|---|
| Dialog | Confirmaciones simples (¿Estás seguro? Sí/No) |
| Modal | Formularios de un solo paso con pocos campos |
| Drawer | Flujos de 2+ pasos, formularios densos, detalles con acciones |

## Especificaciones técnicas

- **Posición**: right-anchored (viene desde el borde derecho)
- **Ancho desktop**: 480px fijo
- **Ancho mobile**: 100% del viewport
- **Animación de apertura**: `translateX(100%)` → `translateX(0)`, 300ms con `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`
- **Sombra**: `shadow-2xl` (misma que Dialog)
- **Z-index**: sobre el overlay, bajo notificaciones del sistema

## Exit animation (deuda técnica)

La animación de cierre está pendiente (registrado en [[design-md]] y [[animaciones]]). La implementación correcta es `data-state="closed"` → `translateX(100%)` con la misma curva `--ease-drawer`. Sin este fix, el Drawer desaparece abruptamente al cerrarse.

## Uso en módulos

Los Drawers de detalle están implementados en [[billing]] (detalle de unidad + historial de pagos), [[pqrs]] (detalle de ticket + formulario de respuesta), [[visitantes]] (detalle de visita), [[usuarios]] (crear/editar usuario). Los módulos pendientes [[reservaciones]], [[comunicaciones]], [[encuestas]] deben seguir este mismo patrón.

## Scroll interno

El Drawer tiene scroll interno independiente del resto de la página. Esto permite que flujos con muchos campos sean navegables sin afectar el scroll de la tabla o lista subyacente.

## Relaciones

- Véase también: [[componentes]], [[animaciones]], [[design-md]]
- Depende de: [[absolute-bans]]
- Se conecta con: [[billing]], [[pqrs]], [[visitantes]], [[usuarios]], [[reservaciones]], [[mobile-first-ios]]

## Fuentes

- [[design-md]]
