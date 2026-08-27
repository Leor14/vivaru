---
tags: [arquitectura, notificaciones, mensajeria, billing]
tipo: tecnica
fuentes: ["sesion-cartera-crm-2026-06", "notification-catalog.ts"]
fecha_creacion: 2026-06-23
fecha_actualizacion: 2026-08-27
---

# Notificaciones a residentes

Sistema de avisos in-app (+ email opcional) que el administrador dispara hacia los residentes. Es distinto de los correos de identidad de [[correos-mensajeria]]: aquí el canal principal es la notificación dentro de la app, y el email es un refuerzo configurable por tenant. Lo usa intensamente la [[cartera-campanas|Cartera]].

## Catálogo editable por tenant

Hay un **catálogo de copias** (`notification-catalog.ts`, espejado en front y functions) con una clave por tipo de aviso. Cada entrada define título, cuerpo, variables, y plantillas de email. El administrador puede **editar el copy por conjunto** desde Perfil del edificio → Notificaciones, y activar/desactivar el email por tipo (OFF por defecto). Un *resolver* combina el override del tenant con el default. Ver [[multi-tenancy]] y [[configuracion]].

> **«OFF por defecto» no es un matiz: hoy es el estado de TODA la producción.** Medido el 27 de
> agosto de 2026: las **13** claves del catálogo tienen `emailDefault: false` y **ninguno** de los
> 8 `tenantSettings` tiene `notificationTemplates`. Es decir, **a ningún residente le llega correo
> en ningún conjunto** — solo la notificación in-app. Lo abre el administrador, conjunto por
> conjunto y aviso por aviso, con el interruptor **«También por correo»** de Ajustes → Portal del
> residente. Consecuencia que sorprende: `PRD-V-FLOW-003` puede estar desplegado y su bandera
> encendida, y **no registrar una sola entrega**, porque el correo nunca se intenta. Ver
> [[trampas-conocidas]].

## Claves de Cartera

- `billing_new` — cobro nuevo individual (incluye la variable `{concepto}`).
- `billing_batch` — aviso agrupado de un lote.
- `billing_overdue` — cartera vencida (mora).
- `billing_receipt` — recibo disponible.
- `billing_reminder` — recordatorio de pago (manual o programado).
- `payment_adjusted` — comprobante aceptado con monto ajustado.
- `payment_rejected` — comprobante no aceptado, con motivo.

Otras claves cubren PQRS, reservas, reglamento, encuestas y acuerdos de comité — ver [[comunicaciones]] y [[reglamento]].

## Entrega y destinatarios

`deliverResidentNotifications` crea la notificación in-app para los `residentUids` y, **si el tipo tiene email activo**, envía por Resend. La puerta es una sola línea —`if (!copy.emailEnabled) return;`, en `index.ts:595`— y **está antes de resolver destinatarios**: con el email apagado no se lee ni una dirección. Si el envío sale y `producto-entrega-de-correo` está encendida, cada correo deja su fila en `emailDeliveries` — ver [[correos-mensajeria]]. Los destinatarios se resuelven con `listResidentUidsByUnit`, que consulta `tenantUsers` con rol `resident` **activos**. Consecuencia clave: un cobro pendiente cuya unidad **no tiene residente con cuenta activa** no se notifica; `sendBillingReminder` reporta cuántas unidades quedaron sin destinatario para que el admin las dé de alta (ver [[usuarios]]).

## Disparadores (triggers y crons)

La mayoría son Cloud Functions de [[firebase-firestore]]:
- Triggers: `onBillingStatementCreated` (cobro nuevo), `onPaymentVoucherCreated`, `onTicketUpdated`, `onReservationUpdated`, `onRegulationDocumentCreated`, `onSurveyUpdated`.
- Callables: `notifyBillingBatch`, `sendBillingReminder`, `notifyResidentReceipt`.
- Crons: `updateOverdueStatements` (mora), `publishScheduledCharges` (cobros programados), `sendScheduledReminders` (recordatorios programados).

Todas referencian el secret `RESEND_API_KEY` (ver [[trampas-conocidas]] sobre el orden de despliegue).

## Relaciones

- Véase también: [[correos-mensajeria]], [[cartera-campanas]], [[billing]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[configuracion]], [[usuarios]], [[comunicaciones]], [[portal-residente]]

## Fuentes

- [[domain-types]]
