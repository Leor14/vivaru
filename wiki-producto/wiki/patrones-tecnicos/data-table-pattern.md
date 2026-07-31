---
tags: [patron, datatable, mobile, tabla]
tipo: tecnica
fuentes: ["DESIGN.md", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Patrón DataTable

Componente de tabla de datos con soporte nativo para mobile. La diferencia clave respecto a soluciones convencionales: en lugar de convertir las filas de tabla en tarjetas de 200px (patrón prohibido per [[absolute-bans]]), usa filas compactas de ~56px con la prop `renderMobileRow`.

## La prop renderMobileRow

```tsx
<DataTable
  data={statements}
  columns={columns}
  renderMobileRow={(row) => (
    <div className="flex items-center justify-between py-3 px-4">
      <div>
        <p className="text-body font-medium">{row.unitLabel}</p>
        <p className="text-label text-slate-500">{row.period}</p>
      </div>
      <StatusBadge status={row.status} />
    </div>
  )}
/>
```

La prop es opcional — si no se provee, la tabla se comporta como una tabla HTML estándar en todos los tamaños. Si se provee, en mobile (`< 640px`) se renderizan las filas custom en lugar de las columnas de desktop.

## Altura de fila mobile

La altura objetivo es ~56px. Esta altura permite mostrar entre 10–12 filas en la pantalla de un iPhone 13 sin scroll excesivo. Las filas de 200px (cards) solo permiten 3–4 items, lo que destruye la eficiencia operativa del administrador.

## Módulos que usan DataTable

- [[billing]]: columnas desktop + filas compactas mobile con estado y balance
- [[pqrs]]: radicado + categoría + prioridad en fila compacta
- [[visitantes]]: nombre visitante + estado + tiempo
- [[usuarios]]: nombre + rol + estado

## Scroll y layout

La tabla está contenida en un div con `overflow-x: auto` para permitir scroll horizontal en desktop si hay muchas columnas. En mobile, `renderMobileRow` elimina la necesidad de scroll horizontal — las filas compactas caben en el ancho del teléfono.

El contenedor usa `overflow-x: auto` (no `overflow-x: hidden`) para no romper `position: sticky` en los headers de columna. Ver [[mobile-first-ios]].

## Relaciones

- Véase también: [[acciones-de-fila]], [[componentes]], [[layout-patterns]], [[mobile-first-ios]]
- Depende de: [[absolute-bans]]
- Se conecta con: [[billing]], [[pqrs]], [[visitantes]], [[usuarios]]

## Fuentes

- [[design-md]], [[backlog-md]]
