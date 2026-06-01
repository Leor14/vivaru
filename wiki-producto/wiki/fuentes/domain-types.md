---
tags: [fuente, dominio, tipos]
tipo: fuente
fuentes: ["domain.ts"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Fuente: domain.ts

Archivo de tipos TypeScript del dominio de Vivaru. Define las entidades principales que fluyen entre Firebase, Cloud Functions y la UI. Es la fuente de verdad para nombres de campos y posibles valores de estados.

## Contenido principal

`domain.ts` contiene las interfaces de todas las entidades del sistema. Cualquier módulo que consuma Firestore debe respetar estos tipos. Los errores de naming (como `authorizationType: "larga_duracion"` sin acento) son trampas documentadas en [[trampas-conocidas]].

## Entidades principales

**Tenant**: representa un conjunto residencial. Campos clave: `id`, `name`, `nit?`, `city`, `status` (trial|active|suspended), `planId`, `onboardingStatus`, `currency?`. El campo `branding` contiene `logoUrl?`, `primaryColor` y `accentColor` por tenant. Ver [[multi-tenancy]] y [[configuracion]].

**SessionUser**: usuario autenticado. Campos clave: `uid`, `email`, `fullName`, `role`, `tenantId?`, `unitId?`, `unitLabel?`. El campo `mustChangePassword` es controlado por [[middleware-ts]] para redirigir al residente si tiene contraseña temporal. Ver [[autenticacion-roles]].

**Communication**: comunicado del administrador. Tiene `audience` con valores `all|owners|tenants`. Ver [[comunicaciones]].

**Reservation**: reserva de amenidad o mudanza. El campo `kind` puede ser `amenity|mudanza`. Para mudanzas existe el subobjeto `mudanza{}` con `requiresElevator?`, `depositPaid?`, `depositAmount?`. Ver [[reservaciones]].

**Ticket (PQRS)**: tiene `category` (pqrs|maintenance|billing), `type` (petition|complaint|claim|suggestion|other), `radicado?` y `responseHistory[]`. Ver [[pqrs]].

**PackageItem**, **VisitorPass**, **BillingStatement**, **PaymentReceipt**, **TenantDocument**: ver módulos [[paquetes]], [[visitantes]], [[billing]], [[reglamento]] respectivamente.

## Valores de estado importantes

| Entidad | Campo | Valores posibles |
|---|---|---|
| Tenant | status | trial, active, suspended |
| VisitorPass | status | scheduled, inside, completed |
| BillingStatement | status | pending, paid, overdue |
| Ticket | status | open, in_progress, resolved, responded, closed |
| Reservation | status | pending, approved, rejected, cancelled |
| PackageItem | status | pending, delivered |

## Relaciones

- Véase también: [[firebase-firestore]], [[multi-tenancy]], [[autenticacion-roles]]
- Depende de: —
- Se conecta con: [[billing]], [[pqrs]], [[reservaciones]], [[visitantes]], [[paquetes]], [[comunicaciones]]

## Fuentes

- Archivo original: `/src/types/domain.ts` en el repositorio Vivaru
