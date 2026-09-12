---
tags: [modulo, finanzas, asamblea]
tipo: concepto
fuentes: ["PRD-V-FEAT-009"]
fecha_creacion: 2026-09-12
fecha_actualizacion: 2026-09-12
---

# Presupuesto contra ejecución

Por ley, la asamblea ordinaria revisa cada primer trimestre si el presupuesto estuvo bien hecho y si hay
déficit. Vivaru tenía lo ejecutado, pero no lo presupuestado. `PRD-V-FEAT-009` (10 sep 2026) añadió el
presupuesto anual y su comparación con lo ejecutado **sin una sola pieza en functions**. Como los 95
asientos de producción son de 2026, su primer uso legal será la asamblea del primer trimestre de 2027.

## Cómo funciona

- **Colección `budgets`**, con id `${tenantId}_${year}`. Las reglas validan la forma
  (`presupuestoBienFormado`) y la aprobación (`aprobacionValida`), y solo se edita en borrador. Ver
  [[firebase-firestore]].
- **El cálculo** vive en `src/lib/finanzas/presupuesto.ts` (`compararPresupuesto`), y la pantalla en
  `/admin/finanzas/presupuesto`, con una hoja imprimible para la asamblea.
- **Lo ejecutado no se recalcula**: se lee del mismo cálculo que el Reporte de Comité
  (`useCommitteeReport`), porque las cuotas no están en los asientos que suma el núcleo del
  [[informe-mensual]] —`esRecaudoDeCartera` las salta—. Lo vigila
  `tests/presupuesto-lee-lo-ejecutado-del-informe.test.ts`. Ver [[reportes]] y [[kpis-formula-unica]].

## Trampas que dejó

- **Los códigos de cuenta llevan punto** (`2.3`): con `updateDoc`, una clave así se leería como ruta de
  campo. Por eso las líneas van en un array y se guardan con `setDoc`. Ver [[trampas-conocidas]].
- **La fecha del acta no pasa por `Date`**, que la leería en UTC y la correría un día. Las reglas solo
  validan su forma, así que aceptan una fecha futura.
- **Sin presupuesto cargado, cada egreso salía como «Sobre-ejecución».** Se corrigió distinguiendo «no
  hay presupuesto» de «lo ejecutado lo supera»: la misma familia de «sin datos no es lo peor» del
  [[dashboard-admin]].

## Bandera y estado

`producto-presupuesto-anual` ([[banderas-funcionalidad]]); ninguna función del servidor la comprueba.
**Medido el 12 sep:** en producción está encendida solo en Las Playas, con un presupuesto 2026 aprobado de
demo; en staging, en Las Playas y Palmas. Como la [[tesoreria]] y la
[[medicion-consumos|medición de consumos]], espera a un conjunto real.

## Relaciones

- Se conecta con: [[informe-mensual]], [[reportes]], [[tesoreria]], [[integridad-financiera]]
- Estado: [[estado-modulos]]
