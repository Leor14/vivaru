---
tags: [patron, unidades, firestore, data-quality]
tipo: tecnica
fuentes: ["sesion-auditoria-ux-2026-07"]
fecha_creacion: 2026-07-03
fecha_actualizacion: 2026-07-03
---

# Resolución unitId → Nombre Humano

Patrón que garantiza que **ningún ID de Firestore llegue a la UI**. Antes, tablas de [[visitantes]], [[reservaciones]], [[reglamento]] y las notificaciones mostraban compuestos como `torre1-G1bWNzZJuakw9KRoAx7p` cuando el lookup de unidad fallaba.

## Causa raíz (dos mitades)

**Escritura:** `activateResidency` (functions) tenía un fallback `${tower}-${unitId}` cuando la lectura del doc de unidad fallaba; ese compuesto se **denormalizaba para siempre** en reservas, paquetería y notificaciones. Corregido: el fallback ahora es legible (`tower` o `"Unidad"`), nunca incrusta el docId.

**Lectura:** cada página hacía su propio `find()+?? id` — 5 patrones distintos cuyo fallback era el ID crudo. Además el lookup fallaba por el mismatch doc-id vs slug documentado en [[trampas-conocidas]].

## El resolver único

`src/utils/unitLabel.ts` — `buildUnitIndex(units)` (índice por doc-id **y** slug) + `resolveUnitName(ref, index)` con cascada:

1. doc id → 2. slug (`unitId`) → 3. **recupera compuestos históricos** extrayendo los 20 chars finales y buscándolos por id → 4. texto ya humano pasa tal cual → 5. `"Unidad no vinculada"` — jamás el ID crudo.

El paso 3 es la clave: **arregla la data vieja al vuelo sin migrarla** (decisión fix-forward, sin backfill). Test en `tests/unit-label.test.ts` con la regla de que ninguna salida matchee `/[A-Za-z0-9]{20}/`.

## Regla para código nuevo

Toda celda, chip o notificación que muestre una unidad pasa por `resolveUnitName`. Es hermano del parser `lib/utils/unit.ts` (que separa torre/apto de etiquetas) — no confundirlos. Se conecta con [[fusion-unidades]] (dedup de unidades) y [[firebase-firestore]].

## Relaciones

- Véase también: [[torres-canonicas]], [[data-table-pattern]]
- Se conecta con: [[multi-tenancy]], [[notificaciones-residentes]], [[auditoria-ux-jul-2026]]

## Fuentes

- Commit `320de3c` + deploy de `activateResidency` a ambos proyectos
