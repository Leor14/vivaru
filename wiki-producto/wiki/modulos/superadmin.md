---
tags: [modulo, superadmin, consola-global]
tipo: concepto
fuentes: ["PRODUCT.md", "domain.ts"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Superadmin

Consola global del equipo interno de Vivaru (`/superadmin`). Permite gestionar todos los tenants, planes, usuarios globales y configuraciones de la plataforma desde un único panel.

## Propósito

El superadmin es la herramienta de operaciones internas de Vivaru. No es accesible para administradores de conjuntos. Las operaciones típicas incluyen: crear nuevos tenants, cambiar el `status` de un tenant (trial|active|suspended), asignar planes, monitorear el uso y resolver incidentes.

## Funciones clave

- **Gestión de tenants**: crear, activar, suspender y configurar tenants. El `status` del `Tenant` en [[domain-types]] se gestiona desde aquí.
- **Provisioning**: crear el workspace inicial de un tenant via Cloud Functions (`createTenant`, `createTenantWorkspace`, `createTenantAdmin`). Ver [[firebase-firestore]].
- **Planes**: asignar y cambiar el `planId` de cada tenant. Ver la colección `plans` en [[multi-tenancy]].
- **Monitoreo global**: ver el estado de todos los tenants, uso de notificaciones vs límites de plan, tenants en trial próximos a vencer.
- **Auditoría**: consultar la colección `auditLogs` para investigar incidentes. Ver [[firebase-firestore]].

## RBAC

El rol `superadmin` tiene acceso irrestricto a todos los tenants y datos de la plataforma. Es el único rol que puede leer documentos de tenants distintos. Las [[firebase-firestore|reglas Firestore]] tienen una excepción explícita para `request.auth.token.role == 'superadmin'`. Ver [[autenticacion-roles]].

## GTM técnico

El renombrado HOGARU→Vivaru (ítem A8 del [[gtm-tecnico|GTM Fase 1]]) se ejecuta desde esta consola o via scripts de migración. La consola también es el punto de partida para el [[roadmap-tecnico|enforcement de límites de plan]] (A2, Fase 2).

## Relaciones

- Véase también: [[autenticacion-roles]], [[multi-tenancy]], [[firebase-firestore]]
- Depende de: [[domain-types]], [[stack-tecnico]]
- Se conecta con: [[configuracion]], [[usuarios]], [[gtm-tecnico]], [[roadmap-tecnico]]

## Fuentes

- [[product-md]], [[domain-types]]
