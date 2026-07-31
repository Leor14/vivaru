---
tags: [diseno, componentes, ui]
tipo: herramienta
fuentes: ["DESIGN.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Componentes

Biblioteca de componentes UI de Vivaru. Cada componente tiene variantes definidas, tokens de [[tokens-color|color]] fijos, comportamientos de [[animaciones|animación]] especificados y restricciones de uso documentadas.

## Button

Variantes: `default` (fondo `--brand-700`), `outline` (borde brand), `ghost` (sin fondo), `danger` (fondo red semántico).
Tamaños: `xs`, `sm`, `md`, `lg`.
Estilo base: `rounded-xl`, `hover:scale-[1.02]`, transición en `transform` y `background-color` (nunca `transition: all` — ver [[absolute-bans]]).

## Card

Estilo base: `rounded-2xl border border-slate-200 bg-surface-strong p-4 shadow-[0_8px_22px_rgba(12,33,53,0.08)]`.
Hover premium (`.premium-card-hover`): `translateY(-2px)` + sombra más fuerte, 200ms `--ease-out`. Ver [[animaciones]].

## Dialog

Para confirmaciones simples (una sola decisión sí/no). Animación: `scale(0.95)+opacity(0)` → `scale(1)+opacity(1)`, 200ms `--ease-out`, controlada por `data-state`. Los flujos de más de un paso deben usar [[drawer-pattern|Drawer]], no Dialog.

## Drawer

Right-anchored, 480px en desktop, full-width en mobile. Animación de apertura con `--ease-drawer` en 300ms. Ver [[drawer-pattern]] para la especificación completa.

## HelpTip

Icono `?` inline que despliega un Radix Tooltip via `createPortal`. El portal garantiza que el tooltip no sea clippeado por contenedores con `overflow: hidden`. Crítico en mobile — ver [[mobile-first-ios]].

## DataTable

Acepta la prop `renderMobileRow` para renderizar filas compactas (~56px) en lugar de tarjetas de 200px. Ver [[data-table-pattern]] para el patrón completo. Usado en [[billing]], [[pqrs]], [[visitantes]], [[usuarios]].

## StatusBadge e IconBadge

StatusBadge: muestra el estado semántico (Al día / Pendiente / Vencido) con el color correspondiente de [[tokens-color]]. IconBadge: combina un icono Lucide con un tint semántico de los icon semantic tints.

## Skeleton

Animación `animated-pulse` para estados de carga. Implementado en [[usuarios]] y [[configuracion]]. La duración del skeleton debe reflejar el tiempo real de carga — no poner skeletons de 3 segundos si el dato llega en 300ms.

## Relaciones

- Véase también: [[acciones-de-fila]], [[design-md]], [[tokens-color]], [[animaciones]]
- Depende de: [[absolute-bans]]
- Se conecta con: [[drawer-pattern]], [[data-table-pattern]], [[mobile-first-ios]], [[layout-patterns]]

## Fuentes

- [[design-md]]
