---
tags: [modulo, admin, visitantes, seguridad]
tipo: concepto
fuentes: ["domain.ts", "DESIGN.md", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Visitantes

Módulo de control de acceso de visitantes (`/admin/visitors`). Permite al administrador y al guardia registrar entradas, verificar pases QR y consultar el historial de visitas.

## Entidades principales

El tipo `VisitorPass` en [[domain-types]] define la entidad:
- `visitorName`, `documentNumber`: identificación del visitante
- `qrCodeValue`: código QR único para verificación
- `status`: scheduled | inside | completed
- `checkInAt?`, `checkOutAt?`: timestamps de entrada y salida
- `guardNotes[]`: observaciones del guardia

## Flujo de visita

1. El residente pre-registra una visita desde [[portal-residente]] con nombre y documento → genera `VisitorPass` en estado `scheduled`
2. El guardia verifica el QR en [[portal-guardia]] → estado pasa a `inside`
3. Al salir, el guardia registra el check-out → estado `completed`

## Compartir QR

El QR generado puede ser compartido por el residente via Web Share API: `navigator.canShare({files})` → `navigator.share()` → fallback a `link.download`. Este patrón está documentado en [[mobile-first-ios]].

## Layout del módulo

Sigue el [[layout-patterns|patrón admin page]]: Card → filtros por estado y fecha → [[data-table-pattern|DataTable]] con `renderMobileRow`. Los estados usan [[componentes|StatusBadge]] con los colores semánticos de [[tokens-color]].

## Estado: ✅ fixes aplicados

Los fixes aplican filas compactas mobile, corrigen la visualización del QR y aseguran que el estado `inside` (visita activa) sea inmediatamente visible en el dashboard.

## Vista del guardia

El [[portal-guardia]] tiene acceso directo a este módulo como una de sus 4 funciones clave. Puede ver las visitas agendadas del día, escanear QR y añadir `guardNotes`.

## Relaciones

- Véase también: [[domain-types]], [[mobile-first-ios]], [[data-table-pattern]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[portal-residente]], [[portal-guardia]], [[dashboard-admin]], [[componentes]]

## Fuentes

- [[domain-types]], [[design-md]], [[backlog-md]]
