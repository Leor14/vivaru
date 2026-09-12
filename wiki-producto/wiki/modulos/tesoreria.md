---
tags: [modulo, finanzas, tesoreria]
tipo: concepto
fuentes: ["PRD-V-FEAT-010"]
fecha_creacion: 2026-09-12
fecha_actualizacion: 2026-09-12
---

# Tesorería: saldo por cuenta, traspasos y caja chica

Vivaru sabía cuánto dinero tenía un conjunto, pero no **en qué cuenta** estaba: ningún código calculaba
el saldo por cuenta. `PRD-V-FEAT-010` lo construyó en cuatro entregas el 10 de septiembre de 2026, y una
quinta el 11, a partir de dos candidatos de Habitanto que David decidió construir aunque la
administradora no los había pedido.

## Qué hay

- **Saldo por cuenta** (`saldosPorCuenta`, en `src/lib/finanzas/tesoreria.ts`). Su total sale del mismo
  cálculo del saldo de fondos que el resto de finanzas, y cuadra con él. Ver [[integridad-financiera]].
- **Traspasos entre cuentas propias** (`treasuryTransfers`): no tocan el libro, **se concilian contra el
  extracto de cada banco**, y se anulan en vez de borrarse.
- **Caja chica** (`pettyCashFunds`), con fondo fijo, reposición y cierre.
- **«Sale de»** en el formulario de egresos y, desde el 11 sep, en el pago de una cuota de
  [[cuentas-por-pagar]]. El servidor y las reglas comprueban que la cuenta es del conjunto.
- La ruta es `/admin/finanzas/tesoreria`.

## Tres distinciones que sostienen el diseño

1. **Un traspaso no es un asiento.** Si fuera un tercer tipo de asiento, el cálculo del libro lo contaría
   como gasto o como ingreso. Tiene tipo propio (`TramoDeTraspaso`), y lo vigila un guardián,
   `tests/traspaso-no-es-asiento.test.ts` — la idea de [[falsacion-de-pruebas]] aplicada a un tipo.
2. **Una caja no es una cuenta.** Guardada en `bankAccounts`, el residente la vería como destino de pago
   en el [[portal-residente]]. Por eso vive aparte y solo la lee la administración.
3. **Un tramo no es un asiento.** El lado de la caja de un traspaso nunca se concilia.

**Y lo que una regla no puede hacer:** cerrar una caja exige saldo cero, pero ese saldo se suma de
egresos y traspasos, y el lenguaje de reglas no suma. Lo sostiene la pantalla, que manda la devolución
del saldo en el mismo lote que el cierre; la regla sostiene lo que sí puede —que se cierra una vez y no
se borra—. Ver [[firebase-firestore]] y [[trampas-conocidas]].

## Bandera

`producto-tesoreria` ([[banderas-funcionalidad]]). En producción, **encendida solo en Las Playas**, con
una demo sembrada (`functions/scripts/sembrar-demo-finanzas.mjs`), igual que el [[presupuesto]] y la
[[medicion-consumos|medición de consumos]]; en staging, en Las Playas y Santa María. Producción no tiene
clientes, así que el primer uso real espera a un conjunto de verdad.

## Relaciones

- Se conecta con: [[cuentas-por-pagar]], [[informe-mensual]], [[presupuesto]], [[billing]]
- Estado: [[estado-modulos]]
