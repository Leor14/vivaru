---
tags: [modulo, admin, comunicaciones, comunicados]
tipo: concepto
fuentes: ["domain.ts", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Comunicaciones

Módulo de comunicados del portal administrador (`/admin/communications`). Permite al administrador publicar avisos, circulares y anuncios dirigidos a todo el conjunto o a grupos específicos de residentes.

## Entidades principales

El tipo `Communication` en [[domain-types]] define la entidad:
- `title`, `body`: contenido del comunicado
- `audience`: all | owners | tenants — segmentación del destinatario
- `publishedAt`: timestamp de publicación
- `authorName`: nombre del administrador que publica

## Audiencias

La segmentación por `audience` es una de las funciones clave del módulo. El administrador puede dirigir comunicados solo a propietarios, solo a inquilinos, o a todos. Esto es relevante para avisos de asamblea (solo propietarios) vs mantenimientos generales (todos).

## Vista del residente

Los comunicados publicados aparecen en el [[portal-residente]] según la audiencia configurada. Un residente con rol `tenant` no ve los comunicados dirigidos solo a `owners`. Ver [[domain-types|SessionUser.role]].

## Estado: 🔲 pendiente critique

Este módulo no ha pasado por el flujo critique → execute → commit. Ver [[estado-modulos]]. El critique debe verificar que el editor de `body` no use un modal para el flujo de creación (flujos complejos deben usar [[drawer-pattern|Drawer]] per [[absolute-bans]]).

## Layout esperado

Debe seguir el [[layout-patterns|patrón admin page]]: Card → lista de comunicados ordenados por `publishedAt` → Drawer para crear/editar. El botón de crear comunicado usa la variante `default` del [[componentes|Button]].

## Relaciones

- Véase también: [[domain-types]], [[drawer-pattern]], [[layout-patterns]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[portal-residente]], [[paquetes]], [[estado-modulos]], [[absolute-bans]]

## Fuentes

- [[domain-types]], [[backlog-md]]
