---
tags: [decision, finanzas, contabilidad, auditoria]
tipo: decision
fuentes: ["sesion-auditoria-ux-2026-07", "FIN-001", "PRD-V-PLAT-003"]
fecha_creacion: 2026-07-03
fecha_actualizacion: 2026-08-22
---

# Integridad Financiera — Reversos, Confirmaciones y Mora Real

Reglas contables que gobiernan el módulo financiero ([[billing]], Libro y fondos,
[[cartera-campanas]]). Las tres primeras salieron de la [[auditoria-ux-jul-2026]]; las dos
últimas, de `FIN-001` y de escribir [[portafolio-prd|PRD-V-PLAT-003]].

## 1. Los asientos contables no se borran: se reversan

El Libro de movimientos ya no permite eliminar un asiento manual. La acción es **"Reversar"**: crea un asiento inverso con **mismo tipo y monto NEGATIVO** (`sourceType: "reversal"`, trazado con `sourceId`) y marca el original `reversedByEntryId` — queda visible como "Anulado". La elección de monto negativo (y no tipo opuesto) mantiene simétricas todas las agregaciones de `computeFundPosition`, incluida la exclusión de la categoría "alicuota". El borrado físico (`deleteLedgerEntry`) quedó reservado al ciclo automático de egresos. Convención exigible ante auditores y jueces: el histórico es intocable.

## 2. Un cobro nunca sale con un solo clic

"Registrar cobro" en [[billing|Cartera]] abre un modal de confirmación con preview (destinatario, concepto, monto, período, vencimiento) en sus 4 caminos: individual/lote × inmediato/programado. Razón: el cobro **emite notificación al residente** ([[notificaciones-residentes]]) y no siempre puede anularse. El modelo a seguir era el de "Cerrar y archivar período", que la auditoría destacó como fortaleza.

## 3. Mora solo si hay días de mora

El widget de mora del [[dashboard-admin]] contaba "0 días vencido" y aun así ofrecía "Enviar aviso". Ahora `daysOverdue` cuenta desde el fin de mes del `period` cuando no hay `dueDate` (la misma regla con la que `computeStatementStatus` declara la mora) y el widget filtra `days > 0`. Complemento: el saldo de fondos negativo se pinta en rojo con banner "Fondo insuficiente".

Además: advertencia suave de **monto atípico** en egresos (mediana de la categoría ±10x, `expense-anomaly.ts`) — atrapa el cero de más o de menos al digitar.

## 4. Un pago se aplica entero o no se aplica — `FIN-001`

**En producción desde el 18 de agosto de 2026**, y cerrada del todo el 20.

Antes, aplicar un pago eran varias escrituras sueltas desde el navegador: si una fallaba, la
cuota podía quedar pagada sin su asiento, o al revés. Ahora hay **un solo comando de servidor,
transaccional e idempotente**: cuota, asiento y comprobante van juntos o no va ninguno, y
repetir la llamada no cobra dos veces. Revertir es su simétrico — deshace los tres y devuelve el
saldo.

**El recibo lo emite el servidor DENTRO de esa transacción, no el navegador después.** Hasta el
20 de agosto lo construía el cliente al terminar, así que **un fallo dejaba un pago sin recibo**;
y revertir no anulaba el papel, dejaba una tarea manual que nadie perseguía. Las dos cosas
estaban bloqueadas por la frase «eso es meterse en lo fiscal», que dejó de ser cierta cuando
[[estado-modulos|Vivaru decidió no manejar lo fiscal]]: el comprobante es un **recibo interno**,
la factura la emite el cliente.

**Tres defectos salieron de MIRAR la salida, no de la suite** —una pantalla y un PDF—, y ninguna
prueba los habría cazado: la administración no tenía dónde ver los recibos emitidos; el pie del
PDF anulado seguía diciendo «conserve este comprobante»; y los recibos anteriores al cambio
salían como `No. undefined`. **Cuando se construye algo que alguien mira, alguien tiene que
mirarlo** — la misma lección que [[trampas-conocidas]] repite en otras formas.

**Lo viejo no se migra a propósito.** Los recibos anteriores conservan su forma antigua y se leen
con las dos: cambiarle el número a un papel que alguien ya descargó es peor que soportar dos
formatos. Su pariente sigue abierto: los asientos anteriores a `FIN-001` **no se pueden revertir**
porque no guardan `operationKey`.

## 5. La exclusión que evita el doble conteo va a cambiar de criterio

**Es la contrapartida de la regla 1, y hay que leerla junto a ella.**

`computeFundPosition` excluye del ingreso del Libro los asientos de categoría `alicuota`, porque
el recaudo de cuotas ya se cuenta por la vía de [[cartera-campanas|Cartera]], que es la fuente
completa. Sumar los dos duplicaría.

**Hoy eso funciona por accidente:** el comando de pago escribe `alicuota` en **todos** los
asientos de cobro, sea una cuota, una multa o un parqueadero. Así que todo queda excluido y todo
se cuenta una vez.

**`PRD-V-PLAT-003` lo cambia**, y ahí está la trampa: cuando el asiento lleve la cuenta del
concepto de verdad, una multa **dejará de ser `alicuota`** y entrará en el ingreso del Libro
mientras sigue contándose en Cartera. **Se contaría dos veces**, y justo en los conjuntos que esa
PRD dice arreglar.

**La corrección es dejar de mirar la categoría y mirar el ORIGEN del asiento** (`sourceType:
"billingStatement"`). Es lo que el propio comentario del código decía querer; excluir por
`"alicuota"` era una coincidencia con fecha de caducidad. **Las dos piezas van en el mismo
despliegue**: separarlas es desplegar el defecto.

## Relaciones

- Véase también: [[kpis-formula-unica]], [[acciones-de-fila]]
- Se conecta con: [[reportes]], [[triaje-auditoria-ux]], [[trampas-conocidas]]

## Fuentes

- Commits `8b387e9` y `8e503a2`
