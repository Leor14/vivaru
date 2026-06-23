---
tags: [modulo, admin, billing, cartera]
tipo: concepto
fuentes: ["domain.ts", "DESIGN.md", "BACKLOG.md", "sesion-cartera-crm-2026-06"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-06-23
---

# Billing (Cartera)

Módulo de cartera y cobros del portal administrador (`/admin/billing`). En junio 2026 se reconvirtió en un **CRM de cobros**: el administrador crea cobros (individuales o en lote), notifica a los residentes, hace seguimiento del recaudo y cierra/archiva períodos. El detalle del CRM (campañas, embudo, cierre) vive en [[cartera-campanas]].

## Entidades principales

Definidas en [[domain-types]]:
- **BillingStatement**: cobro por unidad. Campos: `period`, `concept?`, `campaignId?`, `amount?`, `paymentAmount?`, `balance`, `dueDate?`, `status` (pending|paid|overdue), `reminderCount?`, `archived?`.
- **BillingCampaign**: una corrida de lote — ver [[cartera-campanas]].
- **BillingSchedule** / **BillingReminderJob**: cobros y recordatorios programados, publicados por crons (ver [[firebase-firestore]]).
- **PaymentReceipt**: comprobante del residente; ahora con `amount` declarado y ligado al cobro vía `statementId`.

## Tipos de cobro (concepto)

Cada cobro tiene un `concept` (best practice de PH): **Mantenimiento y Administración** (default, priorizado en los listados), Cuota extraordinaria, Multa/sanción, Reparación/daño, Interés de mora, Parqueadero/amenidad, Otro. El residente ve el concepto en su [[portal-residente]] y se incluye en la notificación de cobro (catálogo en [[notificaciones-residentes]]).

## Crear cobro: destinatario, lote y programación

El formulario "Crear nuevo cobro" combina **destinatario** (Una unidad / Lote) × **tiempo** (inmediato / programado):
- **Lote** arranca con todas las unidades activas y permite destildar; marca las **unidades con nombre repetido** (que se resuelven con [[fusion-unidades]]).
- **Programar para** una fecha futura → el cobro queda en `billingSchedules` y un cron lo publica ese día y notifica. Un **banner persistente** confirma el resultado y dónde verlo (campaña o cobro individual).

## Comprobantes semi-ágil

El residente sube el comprobante **con el monto pagado** desde [[portal-residente]]. El administrador lo revisa junto al cobro ligado y, en un clic, **Aprobar y registrar** aplica el pago a la cartera (sin doble captura). Puede **ajustar el monto** y avisar al residente, o **rechazar** con motivo — ambos disparan notificación (ver [[notificaciones-residentes]]). Los comprobantes aprobados se archivan en la carpeta de sistema "Comprobantes de pago" en Documentos.

## Estados, colores y layout

Los estados usan los colores semánticos de [[tokens-color]] ("Al día"→emerald, "Pendiente"→amber, "Vencido"→red), consistentes con el [[dashboard-admin]]. La moneda via `useTenantCurrency()` (COP/MXN — ver [[multi-tenancy]]). Sigue el [[layout-patterns|patrón admin page]] con [[data-table-pattern|DataTable]] y [[mobile-first-ios]]; la edición usa el [[drawer-pattern|Drawer]].

## Estado: ✅ CRM completo (jun 2026)

Comprobantes semi-ágil, tipos de cobro, lote/programación, trazabilidad y cierre de períodos implementados. Diferido: optimización de memoria por agregados (ver [[roadmap-tecnico]]).

## Relaciones

- Véase también: [[cartera-campanas]], [[notificaciones-residentes]], [[domain-types]]
- Depende de: [[multi-tenancy]], [[firebase-firestore]]
- Se conecta con: [[dashboard-admin]], [[portal-residente]], [[fusion-unidades]], [[tokens-color]]

## Fuentes

- [[domain-types]], [[design-md]], [[backlog-md]]
