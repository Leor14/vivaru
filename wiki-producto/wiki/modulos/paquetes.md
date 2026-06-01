---
tags: [modulo, admin, paquetes, paqueteria]
tipo: concepto
fuentes: ["domain.ts", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Paquetería

Módulo de gestión de paquetes y correspondencia del portal administrador (`/admin/packages`). Registra la llegada de paquetes, notifica al residente y confirma la entrega.

## Entidades principales

El tipo `PackageItem` en [[domain-types]] define la entidad:
- `unitId`, `unitLabel`: unidad destinataria
- `reference`: referencia del paquete (número de guía, descripción)
- `status`: pending | delivered
- `arrivedAt`: timestamp de llegada

## Flujo del paquete

1. El guardia o administrador registra la llegada del paquete con `reference` y la unidad
2. El sistema notifica al residente (via el módulo de [[comunicaciones]] o notificación push)
3. El residente pasa a recogerlo → el guardia confirma la entrega desde [[portal-guardia]]
4. Estado pasa a `delivered`

## Vista del residente

El residente puede ver sus paquetes pendientes desde [[portal-residente]] con estado `pending`. Al recogerlo, el estado cambia a `delivered` y desaparece de su bandeja activa.

## Estado: 🔲 pendiente critique

Este módulo no ha pasado por el flujo critique → execute → commit. Es probable que tenga inconsistencias con [[layout-patterns]] y posibles violaciones de [[absolute-bans]], especialmente en el layout mobile. Ver [[estado-modulos]].

## Layout esperado

El módulo debe seguir el [[layout-patterns|patrón admin page]] con [[data-table-pattern|DataTable]] y `renderMobileRow`. La diferencia entre paquetes `pending` y `delivered` debe ser inmediatamente visible usando [[componentes|StatusBadge]] con los colores de [[tokens-color]].

## Conexión con el guardia

El [[portal-guardia]] incluye la función de registro y entrega de paquetes como una de sus 4 funciones clave. Ver [[portal-guardia]].

## Relaciones

- Véase también: [[domain-types]], [[data-table-pattern]], [[layout-patterns]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[portal-residente]], [[portal-guardia]], [[comunicaciones]], [[estado-modulos]]

## Fuentes

- [[domain-types]], [[backlog-md]]
