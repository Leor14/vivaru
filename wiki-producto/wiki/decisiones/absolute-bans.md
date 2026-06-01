---
tags: [decision, diseno, prohibiciones]
tipo: decision
fuentes: ["PRODUCT.md", "DESIGN.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Absolute Bans

Prohibiciones absolutas de diseño y código en Vivaru. Su violación se clasifica como bug 🔴 — no es un issue de baja prioridad ni una preferencia estética. Son invariantes del sistema que garantizan la coherencia visual y técnica del producto.

## Prohibiciones de CSS/animación

**`transition: all`** — Siempre especificar la propiedad: `transition-colors`, `transition-transform`, `transition-[width]`. El uso de `all` causa animaciones inesperadas en propiedades no deseadas y dificulta el debug. Ver [[animaciones]].

**Animar height/width/padding directamente** — Usar `grid-template-rows` (patrón `collapsible-grid`) o `clip-path`. La animación directa de estas propiedades causa layout thrashing y jank en mobile. Ver [[mobile-first-ios]].

## Prohibiciones de diseño visual

**Side-stripe borders como único acento de card** — La barra de color en el borde izquierdo de una card no puede ser el único indicador de estado o categoría. Siempre acompañar con texto o [[componentes|StatusBadge]].

**Gradient text** — Ningún texto puede usar gradiente CSS (`background-clip: text`). Viola la legibilidad y el sistema de [[tipografia]].

**Glassmorphism decorativo** — Sin `backdrop-filter: blur()` + transparencias decorativas. El fondo institucional de Vivaru (`--background: #f4f7fb`) no es un canvas para efectos frosted glass.

**Grids de cards idénticas sin jerarquía** — Si hay una grilla de cards, siempre debe existir una jerarquía visual (una card más grande, un KPI destacado, una acción primaria). Ver [[layout-patterns]].

**Modals para flujos complejos** — Un formulario de más de un paso va en [[drawer-pattern|Drawer]], no en Modal. Ver [[componentes]] para la distinción Dialog/Modal/Drawer.

## Prohibiciones de copy y UI

**Em dashes en copy UI** — Usar coma o punto en su lugar. Los em dashes (—) no se usan en textos de interfaz de usuario.

**Etiquetas mixtas español/inglés** — Todos los labels, estados, mensajes de error y CTAs en español (es-CO). Nunca mezclar "Dashboard" con "Cartera" en el mismo menú. Ver [[product-md]].

## Anti-referencias visuales

No diseñar tomando como referencia: Notion/Linear, Airbnb, fintech neon-on-dark, SAP/ERP clásico, WhatsApp-green.

## Relaciones

- Véase también: [[product-md]], [[design-md]], [[animaciones]]
- Depende de: —
- Se conecta con: [[tokens-color]], [[tipografia]], [[componentes]], [[drawer-pattern]], [[layout-patterns]]

## Fuentes

- [[product-md]], [[design-md]]
