---
tags: [diseno, layout, patrones]
tipo: herramienta
fuentes: ["DESIGN.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Patrones de Layout

Dos patrones de layout que deben usarse consistentemente en todos los módulos. Su aplicación garantiza que el [[dashboard-admin|admin]] sea denso pero organizado y que el [[portal-residente|residente]] sea cálido y navegable en mobile.

## Admin Page Layout

Estructura estándar para cualquier módulo del portal admin (`/admin/*`):

```
Card wrapper
└── Header (título de página + botón de acción primaria)
└── Filtros / tabs (opcional)
└── DataTable (con renderMobileRow)
└── Drawer (opcional, para crear/editar)
```

El Card wrapper usa el estilo base de [[componentes|Card]]: `rounded-2xl border border-slate-200 bg-surface-strong p-4 shadow-[...]`. El header siempre tiene el título a la izquierda y el CTA a la derecha. Ver [[componentes|Button]] variante `default`.

## Resident Page Layout

Estructura estándar para el [[portal-residente]]:

```
Card
└── CardTitle + descripción corta
└── Hero section (estado principal — ej: balance al día)
└── Staggered cards (acciones secundarias con animación de entrada)
```

Las staggered cards usan `billingCardIn` con stagger de 60ms. Ver [[animaciones]]. La hero section debe ser el elemento visual más prominente — tamaño `kpi-value-fluid-xl`. Ver [[tipografia]].

## KPI Grid

Para grids de métricas en [[dashboard-admin]]:
- `grid-cols-2 gap-3 sm:grid-cols-4`
- Cada KPI usa `kpi-value-fluid` o `kpi-value-fluid-xl` según jerarquía
- Los colores semánticos de [[tokens-color]] marcan el estado (emerald/amber/red)

## Dashboard Widgets

Para widgets del [[dashboard-admin]]:
- `grid-cols-1 gap-4 lg:grid-cols-2`
- Cada widget es una Card con su propio mini-chart o lista

## Reglas de uso

1. No usar tarjetas de 200px en listas mobile — usar [[data-table-pattern]] con `renderMobileRow`
2. No usar Modal para flujos de más de un paso — usar [[drawer-pattern|Drawer]]
3. La clase `.admin-shell` en el layout admin desactiva Fraunces. Ver [[tipografia]].
4. Los headers en mobile usan `position: fixed`, no `sticky`. Ver [[mobile-first-ios]].

## Relaciones

- Véase también: [[design-md]], [[componentes]], [[tipografia]]
- Depende de: [[tokens-color]], [[animaciones]]
- Se conecta con: [[dashboard-admin]], [[portal-residente]], [[data-table-pattern]], [[drawer-pattern]]

## Fuentes

- [[design-md]]
