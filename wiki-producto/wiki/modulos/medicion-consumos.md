---
tags: [modulo, finanzas, consumos]
tipo: concepto
fuentes: ["PRD-V-FEAT-008"]
fecha_creacion: 2026-09-12
fecha_actualizacion: 2026-09-15
---

# Medición de consumos con foto

Vivaru no podía cobrar el agua medida: no tenía catálogo de servicios medidos, ni lecturas, ni cargo. La
administradora lo describió como la tarea que más le cuesta —fotografía cada medidor y manda las fotos
por correo, en un archivo aparte—, y al 9 de septiembre de 2026 había cero lecturas y ninguno de los ocho
conceptos de cobro servía para el agua. `PRD-V-FEAT-008` lo construyó en tres entregas.

## Cómo funciona

- **Catálogo de servicios medidos** (`meteredServices`), que escribe la administración.
- **Lecturas con foto** (`meterReadings`), que registra la callable `registerMeterReading`. La lectura
  anterior (`previous`) la pone el servidor, y por eso dejó de ser escritura directa; la foto va a
  Storage con su propia regla. El residente ve las suyas en el [[portal-residente]], y el cliente no
  escribe lecturas.
- **Cierre, reapertura y cobro del período**: `closeMeterPeriod`, `reopenMeterPeriod` y
  `billConsumptionPeriod` (lógica en `functions/src/medicion-de-consumos.ts`). El cobro genera los
  cargos en [[billing]].
- La pantalla es `/admin/finanzas/medidores`.

## Dos decisiones que no se ven

- **Es una tercera base de reparto, no un mecanismo nuevo.** Junto al coeficiente y al área del
  [[cartera-campanas|cobro por reparto]], el servidor escribe `distributionBasis: "consumption"`. El tipo de
  `src/types/domain.ts` no lo declaró hasta el 12 sep; desde entonces lo vigila un guardián.
- **La cuenta `1.11` tiene `systemKey` propio, `consumo_medido`**, porque `servicios_publicos` ya es la
  cuenta de egreso 2.2 del plan. Y el consumo necesitó un concepto de cargo propio: `aplicarPago` saca la
  cuenta del concepto, no del `accountCode`. Ver [[integridad-financiera]].

## Dos trampas de pantalla

**El campo de la lectura no llevaba el período en su `key`**, así que al cambiar de mes seguía mostrando
la lectura del anterior. Ninguna prueba unitaria lo veía; ahora lo vigila
`tests/campo-no-controlado-con-periodo.test.ts`. Ver [[form-validation]] y [[trampas-conocidas]].

**Y abría en el mes en curso**, que a mitad de mes no tiene ninguna lectura, porque la ronda se lee a fin
de mes. La administración veía todas las unidades en blanco y los totales en cero, con meses registrados
detrás del selector. Lo vio David en la demo de Lomas el 15 sep (contrato de la semilla, H.51). Desde
`bb238da`, si el mes en curso está vacío, la pantalla abre en el último con lecturas y lo dice en una
franja. Busca mes a mes con una consulta por período y `limit(1)`, sin `orderBy`, como exige
`tests/consulta-sin-orderby-sin-indice.test.ts` ([[firebase-firestore]]).

## Bandera y estado

`producto-medicion-de-consumos` ([[banderas-funcionalidad]]). **Medido el 15 sep, resolviendo conjunto por
conjunto:** en producción está encendida en las dos demos —Las Playas, con 24 lecturas con foto sin cobrar, y
Lomas de Sayilbedra, con 192 lecturas de mayo a agosto y la foto de cada medidor— y apagada en los otros
ocho; en staging, en Las Playas, Palmas y el ensayo de Lomas. Todas por override. Producción no tiene
clientes, así que el primer uso real espera a un conjunto de verdad, como la [[tesoreria]] y el
[[presupuesto]].

## Relaciones

- Se conecta con: [[billing]], [[cartera-campanas]], [[tesoreria]], [[presupuesto]]
- Estado: [[estado-modulos]]
