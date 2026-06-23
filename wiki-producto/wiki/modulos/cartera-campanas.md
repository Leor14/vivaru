---
tags: [modulo, admin, billing, cartera, crm]
tipo: concepto
fuentes: ["sesion-cartera-crm-2026-06", "domain.ts"]
fecha_creacion: 2026-06-23
fecha_actualizacion: 2026-06-23
---

# Cartera — Campañas y CRM de cobro

Capa CRM del módulo [[billing]]. Convierte la cartera de "una tabla plana con todo mezclado" en envíos rastreables (campañas), listados separados por pestaña, embudo de recaudo y cierre de períodos. Las notificaciones que dispara viven en [[notificaciones-residentes]].

## Campaña como entidad

Una **BillingCampaign** (colección `billingCampaigns`) es una corrida de lote — inmediata o programada al publicarse. Agrupa N `BillingStatement` vía `campaignId`; los cobros sueltos quedan con `campaignId = null`. El lote inmediato la crea en el front; el lote programado la crea el cron `publishScheduledCharges` (ver [[firebase-firestore]]). Cada campaña cachea concepto, período, monto unitario y `sentAt`; los totales (recaudado/pendiente/% recaudo) se derivan de sus statements de [[domain-types]].

## Listados por pestaña

Cuatro vistas fijas (no se crean listados arbitrarios), con **Mantenimiento y Administración** priorizado:
- **Campañas** — índice de lotes con % recaudo y estado.
- **Cobros individuales** — `campaignId == null` (multas, reparaciones, ajustes).
- **Por unidad** — la tabla completa y destino del "Ver detalle" de una campaña.
- **Cartera vencida** — todos los cobros con saldo, **incluida la mora de períodos cerrados** (lee el set completo, sin filtrar `archived`).

## Trazabilidad CRM

Al abrir una campaña aparece un **embudo**: Emitidos → Notificados → Pagados · % recaudo, con una capa inferior que muestra "Notificación enviada · fecha", "Recordatorios enviados: N" y los recordatorios programados (cancelables). Cada cobro lleva `reminderCount`.

## Recordatorios (Enviar / Programar)

"Recordar a pendientes" abre un menú: **Enviar ahora** o **Programar**. El programado (`billingReminderJobs`) lo dispara el cron `sendScheduledReminders`, que **recalcula los pendientes de la campaña en ese momento** (no congela la lista). El callable `sendBillingReminder` solo alcanza a residentes con cuenta activa y reporta cuántas unidades quedaron sin destinatario — ver [[notificaciones-residentes]].

## Cierre de períodos (control de crecimiento)

Cerrar un **mes pasado** genera un reporte Excel en la carpeta de sistema "Cierres de cartera" de Documentos y marca `archived=true` (estándar PH: el mes vigente no se cierra). La mora **no se pierde**: se arrastra a la pestaña Cartera vencida.

**Contrato de seguridad:** `archived` se filtra **solo** en las tablas vivas. El gráfico histórico, los tableros financieros, el [[reportes|reporte de comité]] y la vista del [[portal-residente]] leen el set completo → el análisis por período queda intacto. Es reversible (Reabrir). El detalle del contrato está en [[trampas-conocidas]].

## Relaciones

- Véase también: [[billing]], [[notificaciones-residentes]], [[fusion-unidades]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]], [[domain-types]]
- Se conecta con: [[portal-residente]], [[reportes]], [[trampas-conocidas]], [[roadmap-tecnico]]

## Fuentes

- [[domain-types]]
