---
tags: [modulo, admin, billing, cartera]
tipo: concepto
fuentes: ["domain.ts", "DESIGN.md", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Billing (Cartera)

Módulo de gestión de cartera y cobros del portal administrador (`/admin/billing`). Permite al administrador ver el estado de cuenta de cada unidad, registrar pagos, y gestionar recibos de pago subidos por residentes.

## Entidades principales

Las entidades del módulo están definidas en [[domain-types]]:
- **BillingStatement**: estado de cuenta por unidad. Campos clave: `period`, `amount?`, `paymentAmount?`, `balance`, `dueDate?`, `status` (pending|paid|overdue).
- **PaymentReceipt**: recibo subido por el residente. Estados: pending|approved|rejected. Incluye `rejectedReason?` para retroalimentar al residente.

## Estados y colores semánticos

Los tres estados de cartera se visualizan con los colores semánticos de [[tokens-color]]:
- "Al día" → emerald
- "Pendiente" → amber
- "Vencido" → red

Estos mismos términos aparecen en el [[dashboard-admin]] y en el [[portal-residente]]. La moneda se renderiza via `useTenantCurrency()` — COP para Colombia, MXN para México. Ver [[multi-tenancy]].

## Layout del módulo

Sigue el [[layout-patterns|patrón admin page]]: Card → header con filtros por estado → [[data-table-pattern|DataTable]] con `renderMobileRow` para filas compactas (~56px) en mobile. Ver [[mobile-first-ios]] para el comportamiento del scroll en iOS.

El Drawer de detalle de unidad sigue el [[drawer-pattern|patrón Drawer]]: right-anchored, 480px desktop, full-width mobile.

## Estado: ✅ fixes aplicados

Los fixes corrigen la visualización de estados en mobile, el formato de moneda y las transiciones de [[componentes|StatusBadge]].

## Flujo del residente

El residente puede subir un comprobante de pago desde [[portal-residente]]. El administrador lo ve como `PaymentReceipt` en estado `pending`, lo aprueba o rechaza con motivo. Si rechaza, el residente recibe el `rejectedReason` en su portal.

## Relaciones

- Véase también: [[domain-types]], [[tokens-color]], [[data-table-pattern]]
- Depende de: [[multi-tenancy]], [[firebase-firestore]]
- Se conecta con: [[dashboard-admin]], [[portal-residente]], [[layout-patterns]], [[componentes]]

## Fuentes

- [[domain-types]], [[design-md]], [[backlog-md]]
