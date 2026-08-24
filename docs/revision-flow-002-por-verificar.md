# Revisión de `FLOW-002` — 36 hallazgos SIN VERIFICAR

**Léelo entero antes de tocar uno.** Esta lista NO es una lista de defectos: es una lista de
**sospechas sin confirmar**, y tratarla como si fuera lo primero es la forma más rápida de
perder un día arreglando cosas que no existen.

## De dónde sale, y por qué no está verificada

Revisión adversarial de todo lo que entró a producción el 24 de agosto de 2026 (`5d6df95..`),
con seis lentes independientes —aritmética del dinero, transacciones, reglas, el «% de recaudo»,
el front, y la coherencia de la documentación— y **tres jueces por hallazgo, cada uno con una
lente distinta**: reproducirlo leyendo el código, buscar si ya está cubierto por otra guarda, y
comprobar si es una decisión deliberada del proyecto.

**La fase de verificación se cayó.** De 117 agentes, 59 murieron con `529 Overloaded`, y casi
todos eran jueces. Solo **un** hallazgo llegó a tener sus tres votos:

> **La comprobación de R1 era tautológica y, con centavos, abortaba pagos legítimos.**
> Confirmado 3/3, reproducido y medido a mano, y **corregido y desplegado** (`e10ae1a`), junto
> con su hermano `sumaAsignada > monto`. Ver `functions/src/payments.ts` → `aMoneda` y
> `TOLERANCIA_MONEDA`.

**Los otros 36 llegan con un solo par de ojos.** Un hallazgo de un solo revisor sin refutar es
una hipótesis: este mismo ejercicio produjo, con jueces, un descarte por cada confirmación.

## Cómo trabajarlos

1. **Reproduce antes de arreglar.** El único confirmado se sostuvo porque se midió: 2,2 % de los
   sobrepagos con centavos, 0 con enteros. Si un hallazgo no se puede reproducir, se descarta y se
   anota que se descartó.
2. **Los de documentación son los más baratos y los más probables**, porque los escribí yo hoy y
   la sesión terminó con cuatro cabeceras que se pisan entre sí. Empieza por ahí: son verificables
   leyendo, sin ambigüedad.
3. **Ojo con dos que, si son reales, son de las gordas:** que el anticipo se cree con la bandera
   apagada, y que `bankAccounts` se haya abierto a la portería y no solo al residente. La segunda
   es de mi cambio de esta noche, y el comentario de la regla de `advances` dice explícitamente
   que la portería no debe ver nada — así que si es cierta, es una incoherencia mía.
4. **Vuelve a correr la revisión con los jueces.** El script está en el directorio de workflows de
   la sesión y se puede reanudar: los agentes con prompt sin cambios responden de la caché, así
   que solo se re-ejecutan los jueces que se cayeron.

### Sospechas de gravedad ALTA (9 sin verificar)
- **El informe mensual automático sigue con la fórmula vieja del «% de recaudo»**
  `functions/src/index.ts` · `monthlyFinancialArchive`
- **El ajuste a mano de un cargo sin línea propuesta se acepta en pantalla y se tira al enviar**
  `src/features/billing/reparto.ts (y su uso en src/components/features/finanzas/RecordPaymentModal.tsx)` · `aplicarAjustes / RecordPaymentModal (bloque de líneas editables)`
- **La pantalla anuncia el importe entero como sobrante mientras la vista previa no ha llegado, y para siempre si falla**
  `src/components/features/finanzas/RecordPaymentModal.tsx` · `RecordPaymentModal — bloque `{cuadra && reparto.sobrante > 0 ? ... : null}` junto con `aplicarAjustes``
- **El anticipo se crea aunque `producto-anticipos` esté apagada**
  `functions/src/payments.ts` · `aplicarPago — el bloque `if (sobrante > 0)``
- **El roadmap dice «Producción no se ha tocado» y FLOW-002 está en producción**
  `docs/roadmap-producto.md` · `## Estado de esta revisión → fila «Estado» (v0.9.22, 24 ago)`
- **La PRD deja como «Abierta» la vista previa del reparto, que ya la calcula el servidor**
  `docs/prd/funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md` · `Tabla de cabecera → fila «Estado» («**Abierta:** §11.3 …»)`
- **La PRD y el runbook dan por vivo el defecto de writeAuditLog, que está corregido y desplegado**
  `docs/despliegue-flow-002-produccion.md` · `## Un hueco conocido que NO bloquea esto`
- **El índice de PRD dice que falta el front de FLOW-002 y que producción está sin tocar**
  `docs/prd/README.md` · `Tabla de PRD funcionales → fila «PRD-V-FLOW-002 — Anticipos y aplicación del pago a varios cargos»`
- **Las cabeceras de CLAUDE.md y pendientes.md dan commits que ya no son los de los remotos**
  `CLAUDE.md` · `## Estado actual — lo primero, y lo que más cambia (primer párrafo)`

### Sospechas de gravedad MEDIA
- **El «Histórico de cartera» que exporta /admin/billing contradice el «% recaudo» de su propia pantalla**
  `src/app/(admin)/admin/billing/page.tsx` · `handleSaveCarteraHistory`
- **En /admin/billing conviven dos «% recaudo» con el mismo rótulo y distinta fórmula**
  `src/app/(admin)/admin/billing/page.tsx` · `campaignRows`
- **El reporte de comité pinta una línea de «% recaudo» que contradice sus propias barras y no expone lo liquidado**
  `src/features/reports/use-committee-report.ts` · `useCommitteeReport (trends.byMonth y executive.collectionRate)`
- **Se puede enviar el reparto de la propuesta anterior: desmarcar un cargo y registrar antes de que llegue la nueva vista previa**
  `src/components/features/finanzas/RecordPaymentModal.tsx` · `RecordPaymentModal — efecto de `previewPaymentAllocationCallable`, `reparto`, `cuadra` y `handleSubmit``
- **El efecto de reset depende de `people`, una suscripción viva: cualquier cambio en personas borra el formulario abierto y saca de la pantalla del recibo**
  `src/components/features/finanzas/RecordPaymentModal.tsx` · `RecordPaymentModal — `useEffect(..., [open, statement, people])``
- **La cuenta bancaria que declaró el residente puede estar inactiva: el select sale en blanco y la aprobación falla sin causa visible**
  `src/components/features/billing/PaymentReceiptsReviewPanel.tsx` · `PaymentReceiptsReviewPanel — `cuentaElegida` y el `<select>` alimentado por `bankAccountsActivas``
- **Las claves de idempotencia de pagos no llevan el conjunto, y el atajo idempotente no comprueba el tenant**
  `functions/src/payments.ts` · `aplicarPago y revertirPago — `opRef`/`revRef` y sus salidas tempranas `if (opSnap.exists)` / `if (revSnap.exists)``
- **Se crea un anticipo con `producto-anticipos` APAGADA, y nace congelado**
  `functions/src/payments.ts` · `aplicarPago — `if (sobrante > 0) { … tx.set(advanceRef, …) }`, sin guarda de la bandera `anticipos``
- **CF3 compara `remaining` y `amount` con igualdad exacta: un anticipo cruzado y descruzado ya no se puede anular**
  `functions/src/advances.ts` · `anularAnticipo — `if ((advance.remaining ?? 0) !== (advance.amount ?? 0)) throw failed-precondition("Ese anticipo ya se aplicó a algún cargo…")``
- **`sobrante > 0` sin umbral crea anticipos y asientos de polvo (~1e-13)**
  `functions/src/payments.ts` · `aplicarPago — la guarda `if (sobrante > 0)` que decide crear `advances` + el `ledgerEntries` de `category: "anticipo"``
- **La PRD nombra dos banderas que no existen**
  `docs/prd/funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md` · `§11.4 Índices, jobs y banderas → viñeta «Banderas»`
- **CA13 y §9 (el aviso con los cargos cubiertos y el saldo a favor) no están construidos y ningún documento lo registra**
  `docs/pendientes.md` · `«No queda nada de `FLOW-002` sin mirar.» (sección «EL PORTAL DEL RESIDENTE — VALIDADO»)`
- **pendientes.md declara pendiente en producción la migración de saldos que su propia cabecera da por hecha**
  `docs/pendientes.md` · `### Lo que hizo falta y la PRD no preveía → «El orden de despliegue importa…»`
- **§7.5 y CF8 prometen que un conjunto suspendido queda en solo lectura, y las callables de anticipos no miran el estado del conjunto**
  `docs/prd/funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md` · `§7.5 Multi-tenancy y ciclo de vida / CF8`
- **El consejo gana detalle financiero POR UNIDAD que el resto del modelo le niega, y sin bandera**
  `vivaru/firestore.rules` · `match /advances/{docId} y match /advanceApplications/{docId} — la cláusula tenantRole(resource.data.tenantId, 'committee') del allow read`
- **bankAccounts se abrió a TODOS los miembros, no solo a los residentes: la portería lee las cuentas del conjunto**
  `vivaru/firestore.rules` · `match /bankAccounts/{docId} — la rama (tenantMember(resource.data.tenantId) && resource.data.active == true) del allow read`

### Sospechas de gravedad BAJA
- **El StatTile «Brecha» conserva el rótulo que el tooltip de su propio gráfico renombró a «Pendiente»**
  `src/app/(admin)/admin/billing/page.tsx` · `trendSummary / StatTile label="Brecha"`
- **Estados de la vista previa que no se limpian: «Calculando…» se queda encendido y `sobranteSeraAnticipo` sobrevive al cierre del diálogo**
  `src/components/features/finanzas/RecordPaymentModal.tsx` · `RecordPaymentModal — `calculando`, `sobranteSeraAnticipo` y la rama de guarda del efecto de vista previa`
- **El mensaje que bloquea el botón dice «suma más que el importe» también cuando el problema es una línea en cero**
  `src/features/billing/reparto.ts (mensaje en src/components/features/finanzas/RecordPaymentModal.tsx)` · `repartoCuadra / el aviso `!cuadra` de RecordPaymentModal`
- **Revertir un pago que se fue entero a anticipo escribe un asiento de importe cero**
  `functions/src/payments.ts` · `revertirPago — el respaldo `const reparto = Array.isArray(op.allocations) && op.allocations.length > 0 ? … : [{ statementId, ledgerEntryId, amount: montoDeCartera }]``
- **Cruzar un anticipo cubriendo la deuda entera puede dejar el cargo en «pendiente» con saldo de 0,00**
  `functions/src/advances.ts` · `cruzarAnticipo — `const cruzadoDespues = cruzadoAntes + aplicado` pasado a `calcularSaldo` (cuyo umbral es `bruto > 0`, en functions/src/payments.ts)`
- **§11.4 declara dos índices compuestos que no se crearon y que el código dice no necesitar**
  `docs/prd/funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md` · `§11.4 Índices, jobs y banderas → viñeta «Índices»`
- **El contrato de datos dice que el servidor escribe personId en el anticipo, y nadie lo escribe**
  `docs/prd/funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md` · `§7.1 Colección nueva: `advances` (fila `personId`) y §7.6 Retención y borrado`
- **El runbook describe un delta a producción que no es el que se desplegó**
  `docs/despliegue-flow-002-produccion.md` · `Cabecera («`origin/develop` = `218383b` · `origin/master` = `5d6df95`»)`
- **El veto de sourceType no protege el asiento del anticipo frente a una sobrescritura completa**
  `vivaru/firestore.rules` · `match /ledgerEntries/{docId} — allow create, update con !(request.resource.data.get('sourceType','') in ['billingStatement','advance'])`
- **La semilla de trial vuelve a escribir openingBalance dentro de bankAccounts, el campo que la migración sacó de ahí**
  `vivaru/functions/src/trial-seed.ts` · `seedTrialWorkspace — la llamada set("bankAccounts", bankAccountId, { ... openingBalance: 0, active: true, ... })`
