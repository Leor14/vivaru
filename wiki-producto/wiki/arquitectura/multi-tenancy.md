---
tags: [arquitectura, multi-tenancy, firestore, seguridad]
tipo: tecnica
fuentes: ["domain.ts", "gtm-tecnico"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Multi-tenancy

Vivaru implementa un modelo multi-tenant lógico sobre una única instancia de Firestore. Cada documento en cada colección lleva el campo `tenantId`, y el aislamiento entre conjuntos residenciales se enforza a nivel de reglas de seguridad.

## Modelo de datos

No hay bases de datos separadas por tenant. Todo comparte el mismo Firestore, pero cada documento está etiquetado con `tenantId`. La membresía de un usuario a un tenant se gestiona en la colección `tenantUsers/{tenantId}_{uid}`, que es la fuente de verdad combinada con los Custom Claims de [[autenticacion-roles|Firebase Auth]].

## Aislamiento

Las `firestore.rules` (700+ líneas) verifican en cada operación que `request.auth.token.tenantId == resource.data.tenantId`. Esto garantiza que un admin del edificio A nunca pueda leer ni escribir datos del edificio B, aunque use la misma aplicación. Ver [[firebase-firestore]].

## Colecciones clave del modelo

| Colección | Descripción |
|---|---|
| `tenants` | Un documento por conjunto residencial |
| `tenantUsers/{tenantId}_{uid}` | Membresía usuario-tenant |
| `plans` | Planes disponibles con `maxUnits`, `maxNotificationsPerMonth`, `featuresEnabled[]`, `slaLabel` |
| `tenantSettings/{tenantId}` | Branding por tenant: logo, color primario, nombre comercial |
| `auditLogs` | Pista de auditoría de operaciones sensibles |

## Planes y límites

La colección `plans` define los límites de cada tenant. El campo `planId` en [[domain-types|Tenant]] referencia el plan activo. El enforcement de límites (A2 del [[gtm-tecnico|GTM técnico]]) está pendiente para la Fase 2 del roadmap. Ver [[roadmap-tecnico]].

## Branding por tenant

Cada tenant puede tener logo propio, color primario y nombre comercial via `tenantSettings/{tenantId}`. Esto permite que cada conjunto residencial vea la app "con su marca" sin deployar instancias separadas. La configuración se edita desde [[configuracion]].

## Provisioning via Cloud Functions

La creación de tenants y usuarios se realiza exclusivamente via Cloud Functions para garantizar consistencia: `createTenant`, `createTenantWorkspace`, `createTenantAdmin`, `createTenantOperationalUser`, `provisionResidentTemporaryAccess`. Ninguna de estas operaciones debe hacerse desde el cliente directamente.

## Relaciones

- Véase también: [[autenticacion-roles]], [[firebase-firestore]]
- Depende de: [[domain-types]]
- Se conecta con: [[configuracion]], [[usuarios]], [[stack-tecnico]], [[roadmap-tecnico]]

## Fuentes

- [[domain-types]], [[gtm-tecnico]]
