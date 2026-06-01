---
tags: [modulo, admin, reservaciones, amenidades]
tipo: concepto
fuentes: ["domain.ts", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Reservaciones

Módulo de gestión de reservas del portal administrador (`/admin/reservations`). Permite aprobar y rechazar reservas de amenidades y mudanzas solicitadas por los residentes.

## Entidades principales

El tipo `Reservation` en [[domain-types]] define la entidad con campos clave:
- `amenityId?`, `amenity`: amenidad reservada
- `date`, `startTime?`, `endTime?`, `slot?`: horario
- `exclusiveUse?`: si la reserva bloquea la amenidad completa
- `kind?`: `amenity | mudanza`
- `mudanza?`: subobjeto con `requiresElevator?`, `depositPaid?`, `depositAmount?`, `receiptUrl?`, `additionalNotes?`
- `status`: pending | approved | rejected | cancelled

## Flujo de aprobación

El residente solicita una reserva desde [[portal-residente]]. El administrador la ve en este módulo con estado `pending` y puede aprobarla o rechazarla. Las mudanzas requieren verificación adicional del depósito y coordinación del elevador.

## Caso especial: mudanzas

Las mudanzas son un tipo especial de reserva (`kind: mudanza`) con lógica adicional. El subobjeto `mudanza` incluye información sobre el depósito de garantía (`depositPaid`, `depositAmount`, `receiptUrl`) y notas adicionales. El administrador debe verificar el comprobante antes de aprobar. El Drawer de detalle sigue el [[drawer-pattern|patrón Drawer]].

## Estado: 🔲 pendiente critique

Este módulo aún no ha pasado por el flujo critique → execute → commit. Puede tener violaciones de [[absolute-bans]], inconsistencias con [[tokens-color]] y problemas de [[mobile-first-ios]]. Ver [[estado-modulos]].

## Layout esperado

Debe seguir el [[layout-patterns|patrón admin page]]: Card → filtros por estado/fecha → [[data-table-pattern|DataTable]] con `renderMobileRow`. El Drawer de detalle debe usar [[drawer-pattern|ease-drawer]] para la animación de apertura.

## Relaciones

- Véase también: [[domain-types]], [[drawer-pattern]], [[data-table-pattern]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[portal-residente]], [[layout-patterns]], [[absolute-bans]], [[estado-modulos]]

## Fuentes

- [[domain-types]], [[backlog-md]]
