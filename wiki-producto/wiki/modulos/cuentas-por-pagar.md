---
tags: [modulo, finanzas, egresos]
tipo: concepto
fuentes: ["PRD-V-FLOW-008"]
fecha_creacion: 2026-09-12
fecha_actualizacion: 2026-09-12
---

# Cuentas por pagar en cuotas

Una factura que se paga a plazos —la póliza del seguro del inmueble, en once cuotas— se registraba en
Vivaru como un solo egreso, con un solo vencimiento y un solo asiento, y la administradora llevaba el
cuadro de pagos a mano. De los 52 egresos de producción, 32 no tenían vencimiento. Desde el 4 de
septiembre de 2026 (`PRD-V-FLOW-008`) un egreso puede llevar un **calendario de cuotas**, y cada cuota
se paga, se anula y deja su propio asiento en el libro.

## Cómo funciona

- **No hay colección nueva**: `installments` y `paidAmount` viven dentro de `expenses`. La deuda con el
  proveedor se deriva de las **cuotas vivas**, no de `amount − paidAmount` (`pendienteDelEgreso`, en
  `src/lib/finanzas/nucleo-estado-financiero.ts`, con su espejo en `functions/`). Es la cifra que el
  [[informe-mensual]] publica como deuda a proveedores.
- **Cuatro callables** con Admin SDK —`payExpenseInstallment`, `voidExpenseInstallment`,
  `voidExpenseWithInstallments` y `saveExpensePlan`, en `functions/src/egresos-en-cuotas.ts`—. El pago
  corre en transacción y crea el asiento que después concilia la
  [[integridad-financiera|conciliación bancaria]].
- **La regla congela el plan entero.** El lenguaje de reglas no recorre listas, así que en vez de
  comprobar cuota por cuota exige que ni `installments` ni `paidAmount` cambien desde el cliente. El
  patrón está en [[firebase-firestore]].
- La pantalla es `/admin/finanzas/egresos`, con su panel de cuotas. Desde la [[tesoreria]] (11 sep), el
  pago de una cuota elige además de qué cuenta sale.

## Bandera

`producto-egresos-en-cuotas`, con la precedencia que explica [[banderas-funcionalidad]]. **Medido el 12
sep resolviendo conjunto por conjunto:** encendida en los **10** conjuntos de producción —ocho por el
valor global y dos, Las Playas y Santa María, por un override que dice lo mismo— y en staging solo en
Santa María. Con esos overrides puestos, apagarla en todos exige el kill switch.

## Trampas que dejó

- **`changedKeys()` no ve una clave añadida**: la regla que vetaba `voidReason` lo dejaba pasar en un
  egreso que no lo tenía. Se usa `affectedKeys()`. Ver [[trampas-conocidas]].
- **El propio formulario deshacía un pago** al editar la descripción, porque reenviaba el array sin lo
  que sella el servidor. Por eso el plan pasó a callable (`R8`, cerrado el 4 sep).
- **La deuda tenía cinco consumidores y dos la reimplementaban**: hay que buscar el concepto, no quién
  llama a la función.
- El banco `tests/egresos-en-cuotas.rules.test.ts`, contra el emulador ([[pruebas-reglas-emulador]]),
  vigila que la regla no rompa los egresos sin plan, y su [[falsacion-de-pruebas|falsación]] lo
  demuestra.

## Relaciones

- Se conecta con: [[informe-mensual]], [[tesoreria]], [[integridad-financiera]], [[billing]]
- Estado: [[estado-modulos]]
