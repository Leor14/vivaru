---
tags: [modulo, admin, dashboard]
tipo: concepto
fuentes: ["PRODUCT.md", "DESIGN.md", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Dashboard Admin

Vista principal del portal administrador (`/admin`). Implementa el principio "status at a glance" de [[product-md]]: el administrador debe poder evaluar el estado del conjunto en segundos, sin necesidad de navegar a módulos individuales.

## Estructura de la página

Sigue el patrón de [[layout-patterns|admin page layout]]: Card wrapper → header (título + acción) → KPI grid → widgets de dashboard. Los KPIs usan la escala fluid definida en [[tipografia]]: `kpi-value-fluid`, `kpi-value-fluid-xl` y `kpi-value-fluid-compact` según la densidad de la grilla.

El grid de KPIs usa `grid-cols-2 gap-3 sm:grid-cols-4`. Los widgets de dashboard usan `grid-cols-1 gap-4 lg:grid-cols-2`. Ver [[layout-patterns]].

## Métricas clave

El dashboard muestra indicadores de los módulos principales: resumen de [[billing|cartera]] (cuántas unidades al día / pendientes / vencidas), visitas activas de [[visitantes]], paquetes pendientes de [[paquetes]], y tickets abiertos de [[pqrs]]. Los colores semánticos siguen la convención de [[tokens-color]]: emerald para "Al día", amber para "Pendiente", red para "Vencido".

## Estado: ✅ fixes aplicados

Los fixes implementados corrigen problemas de layout en mobile, aseguran que las transiciones usen propiedades específicas (nunca `transition: all` per [[absolute-bans]]), y que los KPIs fluid respondan correctamente en todos los breakpoints.

## Accesos rápidos

El dashboard incluye accesos directos a las acciones más frecuentes del administrador: registrar pago, crear ticket, ver reservas pendientes. Estos botones usan la variante `default` del [[componentes|Button]] con `rounded-xl` y el color `--brand-700`.

## Relaciones

- Véase también: [[layout-patterns]], [[tipografia]], [[tokens-color]]
- Depende de: [[billing]], [[visitantes]], [[paquetes]], [[pqrs]]
- Se conecta con: [[componentes]], [[absolute-bans]], [[mobile-first-ios]]

## Fuentes

- [[product-md]], [[design-md]], [[backlog-md]]
