---
tags: [patron, residentes, unidades, firebase]
tipo: tecnica
fuentes: ["sesion-cartera-crm-2026-06", "functions/index.ts"]
fecha_creacion: 2026-06-23
fecha_actualizacion: 2026-06-23
---

# Fusión de unidades duplicadas

Patrón para limpiar **unidades duplicadas** en un conjunto: documentos distintos de la colección `units` con el mismo nombre (mismo `displayName`, distinto doc id). Causan cobros dobles y ensucian los listados de [[billing]] y el directorio de residentes. La causa raíz es histórica (se crearon dos veces); hoy la creación duplicada ya está bloqueada.

## Por qué un callable y no borrar

Una unidad está referenciada por su doc id desde **muchas colecciones**. Borrarla a secas deja cobros, personas y visitantes huérfanos. Por eso la fusión es un callable server-side (`mergeUnits`) que **re-apunta todas las referencias** a la unidad superviviente y borra las duplicadas en una operación auditada. Se hace en Admin SDK por atomicidad y porque `tenantUsers` tiene escritura restringida en reglas (ver [[firebase-firestore]] y [[autenticacion-roles]]).

## Mapa de referencias a `unitId`

`mergeUnits` re-apunta estos campos por cada duplicada:
- `people.unitId`, `tenantUsers.unitId` (+ perfil `users/{uid}.unitId`)
- `billingStatements.unitId`, `paymentReceipts.unitId`
- `reservations.unitId` ([[reservaciones]]), `tickets.unitId` ([[pqrs]])
- `visitorAuthorizations.unitId`, `visitorPasses.unitId` ([[visitantes]])
- `services.unitId`, `paymentVouchers.payerUnitId`
- `billingSchedules.targets[].unitId` (re-mapea el array y deduplica)

Además fusiona `ownerIds`/`residentIds` en la superviviente, borra las duplicadas y deja `writeAuditLog("units.merge", …)`.

> Recordatorio crítico de [[trampas-conocidas]]: `unitId` de personas = **doc id** de la unidad, no el slug.

## UX en Residentes

El panel `DuplicateUnitsPanel` detecta los grupos por nombre (solo aparece si hay duplicados), **sugiere conservar la unidad con más personas**, deja elegir la superviviente (radio) y fusiona con confirmación irreversible. La lista se actualiza en vivo. En [[cartera-campanas|el lote de cobros]], las unidades repetidas también se marcan con la etiqueta "repetida".

## Relaciones

- Véase también: [[billing]], [[cartera-campanas]], [[usuarios]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]], [[autenticacion-roles]]
- Se conecta con: [[visitantes]], [[reservaciones]], [[pqrs]], [[trampas-conocidas]]

## Fuentes

- [[domain-types]]
