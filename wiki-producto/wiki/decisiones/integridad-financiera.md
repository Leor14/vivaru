---
tags: [decision, finanzas, contabilidad, auditoria]
tipo: decision
fuentes: ["sesion-auditoria-ux-2026-07"]
fecha_creacion: 2026-07-03
fecha_actualizacion: 2026-07-03
---

# Integridad Financiera — Reversos, Confirmaciones y Mora Real

Tres reglas contables adoptadas tras la [[auditoria-ux-jul-2026]] que gobiernan el módulo financiero ([[billing]], Libro y fondos, [[cartera-campanas]]).

## 1. Los asientos contables no se borran: se reversan

El Libro de movimientos ya no permite eliminar un asiento manual. La acción es **"Reversar"**: crea un asiento inverso con **mismo tipo y monto NEGATIVO** (`sourceType: "reversal"`, trazado con `sourceId`) y marca el original `reversedByEntryId` — queda visible como "Anulado". La elección de monto negativo (y no tipo opuesto) mantiene simétricas todas las agregaciones de `computeFundPosition`, incluida la exclusión de la categoría "alicuota". El borrado físico (`deleteLedgerEntry`) quedó reservado al ciclo automático de egresos. Convención exigible ante auditores y jueces: el histórico es intocable.

## 2. Un cobro nunca sale con un solo clic

"Registrar cobro" en [[billing|Cartera]] abre un modal de confirmación con preview (destinatario, concepto, monto, período, vencimiento) en sus 4 caminos: individual/lote × inmediato/programado. Razón: el cobro **emite notificación al residente** ([[notificaciones-residentes]]) y no siempre puede anularse. El modelo a seguir era el de "Cerrar y archivar período", que la auditoría destacó como fortaleza.

## 3. Mora solo si hay días de mora

El widget de mora del [[dashboard-admin]] contaba "0 días vencido" y aun así ofrecía "Enviar aviso". Ahora `daysOverdue` cuenta desde el fin de mes del `period` cuando no hay `dueDate` (la misma regla con la que `computeStatementStatus` declara la mora) y el widget filtra `days > 0`. Complemento: el saldo de fondos negativo se pinta en rojo con banner "Fondo insuficiente".

Además: advertencia suave de **monto atípico** en egresos (mediana de la categoría ±10x, `expense-anomaly.ts`) — atrapa el cero de más o de menos al digitar.

## Relaciones

- Véase también: [[kpis-formula-unica]], [[acciones-de-fila]]
- Se conecta con: [[reportes]], [[triaje-auditoria-ux]], [[trampas-conocidas]]

## Fuentes

- Commits `8b387e9` y `8e503a2`
