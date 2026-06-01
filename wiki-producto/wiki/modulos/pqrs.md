---
tags: [modulo, admin, pqrs, tickets]
tipo: concepto
fuentes: ["domain.ts", "DESIGN.md", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# PQRS (Peticiones, Quejas, Reclamos y Sugerencias)

Módulo de gestión de tickets del portal administrador (`/admin/pqrs`). Centraliza las comunicaciones formales entre residentes y administración, con radicado, historial de respuestas y priorización.

## Entidades principales

El tipo `Ticket` en [[domain-types]] define la entidad:
- `category`: pqrs | maintenance | billing
- `type`: petition | complaint | claim | suggestion | other
- `radicado?`: número de radicado generado al crear el ticket
- `status`: open | in_progress | resolved | responded | closed
- `priority?`: low | medium | high
- `responseHistory[]`: historial de respuestas del administrador

## Ciclo de vida del ticket

1. Residente crea el ticket desde [[portal-residente]] con categoría y tipo
2. Se genera el `radicado` automáticamente
3. Administrador lo ve en `/admin/pqrs` con estado `open`
4. Administrador responde → estado pasa a `responded`
5. Si requiere seguimiento → `in_progress`
6. Resolución final → `resolved` o `closed`

## Layout del módulo

El módulo usa [[data-table-pattern|DataTable]] con `renderMobileRow` — fix aplicado para tabla mobile. La fila mobile es compacta (~56px) mostrando radicado, categoría y estado. El detalle completo del ticket abre en un [[drawer-pattern|Drawer]] con el historial de respuestas.

Los tickets de alta prioridad se destacan con [[componentes|StatusBadge]] en color red del [[tokens-color|sistema de colores semánticos]].

## Estado: ✅ tabla mobile corregida

El fix asegura que la tabla mobile no genere tarjetas de 200px (patrón prohibido per [[absolute-bans]]) sino filas compactas navegables.

## Vista del guardia

El [[portal-guardia]] también puede crear tickets de tipo `maintenance` para reportar novedades del edificio. Estos llegan al módulo PQRS del admin con `category: maintenance`.

## Relaciones

- Véase también: [[domain-types]], [[data-table-pattern]], [[drawer-pattern]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[portal-residente]], [[portal-guardia]], [[componentes]], [[tokens-color]]

## Fuentes

- [[domain-types]], [[design-md]], [[backlog-md]]
