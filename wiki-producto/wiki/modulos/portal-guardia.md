---
tags: [modulo, guardia, mobile-first, seguridad]
tipo: concepto
fuentes: ["PRODUCT.md", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Portal Guardia

Portal mobile-first para el personal de seguridad del conjunto residencial (`/guard/*`). Diseñado para uso con una mano, en condiciones de iluminación variable, con exactamente 4 funciones operativas.

## Las 4 funciones

El guardia tiene acceso solo a las operaciones necesarias para su turno:

1. **Visitantes**: ver visitas agendadas del día, verificar QR, registrar check-in y check-out. Ver [[visitantes]].
2. **Paquetes**: registrar llegada de paquetes y confirmar entrega al residente. Ver [[paquetes]].
3. **PQRS**: crear tickets de mantenimiento o novedades del edificio. Ver [[pqrs]].
4. **Calendario/Reservaciones**: ver las reservas del día para coordinar acceso a amenidades. Ver [[reservaciones]].

## Diseño del portal

El portal usa bottom navigation con las 4 funciones para acceso con pulgar en mobile. El estado: ✅ bottom nav + calendario implementados.

Los headers usan `position: fixed` + `pt-[57px]` per [[mobile-first-ios]]. La baja fricción es prioritaria: el guardia debe poder completar un check-in de visita en menos de 10 segundos.

## RBAC y acceso

El rol `guard` solo tiene acceso a `/guard/*`. El [[middleware-ts]] bloquea cualquier intento de acceder a `/admin` o `/resident`. El guardia no puede ver datos de cartera, configuración del tenant ni gestionar usuarios. Ver [[autenticacion-roles]].

## Notas del guardia

El tipo `VisitorPass` en [[domain-types]] incluye `guardNotes[]`, un array que permite al guardia añadir observaciones sobre cada visita (ej: "visitante llegó en vehículo, placa XYZ-123"). Estas notas son visibles para el administrador desde [[visitantes]].

## Conexión con el admin

Las acciones del guardia (check-ins, registros de paquetes, tickets de mantenimiento) se sincronizan en tiempo real con el portal admin. El administrador ve inmediatamente cualquier novedad registrada por el guardia.

## Relaciones

- Véase también: [[mobile-first-ios]], [[autenticacion-roles]], [[middleware-ts]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[visitantes]], [[paquetes]], [[pqrs]], [[reservaciones]], [[domain-types]]

## Fuentes

- [[product-md]], [[backlog-md]]
