---
tags: [patron, firebase, firestore, backend]
tipo: tecnica
fuentes: ["domain.ts", "gtm-tecnico"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Firebase y Firestore

Capa de backend de Vivaru. Firebase Auth gestiona la autenticación, Firestore es la base de datos principal y Cloud Functions ejecutan operaciones privilegiadas. Todo el modelo [[multi-tenancy|multi-tenant]] se implementa sobre esta infraestructura.

## Estructura de colecciones

Las colecciones principales del modelo de datos:

| Colección | Descripción |
|---|---|
| `tenants` | Un documento por conjunto residencial |
| `tenantUsers/{tenantId}_{uid}` | Membresía usuario-tenant |
| `plans` | Planes con `maxUnits`, `featuresEnabled[]`, `slaLabel` |
| `tenantSettings/{tenantId}` | Branding per-tenant |
| `auditLogs` | Pista de auditoría global |

Los módulos transaccionales (statements, tickets, visitors, packages) tienen colecciones propias con `tenantId` en cada documento. Los tipos están en [[domain-types]].

## Reglas de seguridad

`firestore.rules` tiene 700+ líneas que enforzan el aislamiento multi-tenant. El patrón base es:
```js
allow read, write: if request.auth.token.tenantId == resource.data.tenantId;
```

Las reglas de Storage (ítem B2 del [[gtm-tecnico|GTM Fase 0]]) están pendientes de implementación. Ver [[roadmap-tecnico]].

## Cloud Functions

Las funciones privilegiadas que no deben ejecutarse desde el cliente:

| Función | Propósito |
|---|---|
| `createTenant` | Crea el documento tenant |
| `createTenantWorkspace` | Configura colecciones iniciales |
| `createTenantAdmin` | Crea el usuario admin del tenant |
| `createTenantOperationalUser` | Crea usuarios con rol operativo |
| `provisionResidentTemporaryAccess` | Onboarding de residente con contraseña temporal |

Los esquemas Zod de [[form-validation]] también se usan en las Functions para validar inputs. Ver [[form-validation]].

## Auditoría

La colección `auditLogs` registra operaciones sensibles: creación de tenants, cambios de plan, provisioning de usuarios, aprobaciones de pago. El [[superadmin]] la consulta para investigar incidentes.

## Tests de reglas (GTM Fase 0)

El ítem A1 del [[gtm-tecnico|GTM técnico]] son los tests de las reglas Firestore. Antes de ir a producción, cada regla debe tener un test que verifique que el aislamiento funciona y que los roles solo acceden a lo que deben.

## Relaciones

- Véase también: [[multi-tenancy]], [[autenticacion-roles]], [[domain-types]]
- Depende de: [[stack-tecnico]]
- Se conecta con: [[form-validation]], [[superadmin]], [[gtm-tecnico]], [[roadmap-tecnico]], [[correos-mensajeria]]

## Fuentes

- [[domain-types]], [[gtm-tecnico]]
