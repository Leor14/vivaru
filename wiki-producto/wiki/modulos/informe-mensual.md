---
tags: [modulo, finanzas, informes]
tipo: concepto
fuentes: ["PRD-V-FLOW-007", "PRD-V-PLAT-004"]
fecha_creacion: 2026-09-12
fecha_actualizacion: 2026-09-12
---

# Informe mensual anclado al banco

El Decreto 462 obliga a publicar un informe económico mensual, y la sanción por no hacerlo es la
remoción del administrador. El informe automático de Vivaru era un resumen de ocho líneas, sin saldo del
banco ni firma. Además, los tres consumidores del cálculo pasaban el saldo de apertura en cero, así que
Santa María, con 5.000.000 en el banco, recibía un «Fondo insuficiente» falso. `PRD-V-FLOW-007` ancló el
informe al saldo real del banco ([[integridad-financiera]]) y lo volvió **emitible y firmable**.

## Cómo funciona

- **Un núcleo de cálculo compartido**, idéntico byte a byte en `functions/src/` y en `src/lib/finanzas/`
  (`nucleo-estado-financiero.ts`), con un guardián que compara los dos espejos. La deuda a proveedores
  que publica sale de las cuotas vivas de [[cuentas-por-pagar]].
- **Borrador, emitido, firmado y, si hace falta, anulado.** La función programada `monthlyFinancialArchive`
  escribe el borrador el día 1; `regenerateMonthlyReport`, `issueMonthlyReport`, `signMonthlyReport` y
  `voidMonthlyReport` son callables. **Emitir recalcula y congela las cifras**: después de emitido,
  corregir un asiento ya no las mueve.
- **`monthlyReports` no se escribe desde el cliente**: todas sus reglas de escritura son `false`, y lo
  escribe el servidor. Lo lee la administración y, una vez emitido, el consejo ([[rol-consejo]]).
- **El PDF se rehace con cada firma**, en el servidor y con las cifras congeladas; la fecha de la firma se
  pinta en la zona del país del conjunto. Se archiva en el repositorio documental ([[reglamento]]) con
  una categoría propia, `informe_mensual`, que solo ve la administración.
- **Desde el 12 sep, el detalle por unidad —quién debe y cuánto— vive aparte**, en
  `monthlyReportReceivables`, con el mismo id y solo para la administración. El consejo lee el informe
  emitido, y una regla de Firestore no oculta campos: ver [[multi-tenancy]].
- La pantalla es `InformeMensualCard`, en `/admin/reports` ([[reportes]]).

## Bandera y estado

`producto-informe-mensual` ([[banderas-funcionalidad]]). **Medido el 12 sep resolviendo conjunto por
conjunto:** encendida en los **10** conjuntos de producción, todos por el valor global —el override del
canario se retiró ese día—, y en tres de staging. Las entregas 1 y 2 están en producción desde el 3 y el 4 sep. **La
entrega 3, publicar el informe al residente, espera al abogado ecuatoriano**, igual que la mora legal
(`FLOW-006`).

## Trampas que dejó

- **El menos del PDF**: `−` (U+2212) salía como `ˆ`, porque la fuente estándar va en WinAnsi, y no
  fallaba nada. Ninguna suite lee el papel. Ver [[trampas-conocidas]].
- **Las pruebas de denegación pasan aunque no haya regla**, por el deny por defecto: hace falta su mitad
  positiva ([[falsacion-de-pruebas]]).
- **Una regla no protege lo que escribe una callable**: que un conjunto suspendido no emita lo comprueba
  el servidor.

## Relaciones

- Se conecta con: [[rol-consejo]], [[reportes]], [[presupuesto]], [[cuentas-por-pagar]], [[tesoreria]]
- Estado: [[estado-modulos]]
