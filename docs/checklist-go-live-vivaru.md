# Checklist Go-Live — Vivaru (lente GTM)

> Qué falta para empezar a cargar clientes. Priorizado por bloqueo real. Lo que ya está
> construido (auth/onboarding por enlace, correos Resend, cartera/CRM, reportes, libro,
> notificaciones, alta de tenant por superadmin con planes) no se repite aquí.

## P0 — Bloqueantes para el PRIMER cliente real

1. **Carga inicial de datos del conjunto.** El alta de tenant existe, pero falta el camino
   robusto para arrancar con la realidad del cliente: import masivo de **residentes** (hoy
   unidades sí en lote, residentes uno a uno) y, crítico, **saldos iniciales de cartera**
   (cada unidad con su deuda actual) y **saldo inicial del libro/fondos**. Sin esto el
   cliente no puede operar desde el día 1. *(Parcial.)*
2. **Marco legal y de privacidad.** Términos de servicio, política de privacidad y
   tratamiento de datos personales (Habeas Data Ley 1581 CO / LFPDPPP MX). Manejas PII de
   residentes + datos financieros; es un bloqueo legal, no técnico. *(No evidente → gap.)*
3. **URL de acción branded de Auth (pendiente conocido).** Fijar en Firebase Console la URL
   de acción → `/restablecer`, para que onboarding/reset abran la página branded en español
   (hoy abre la de Firebase en inglés). Requiere cuenta Owner. *(Pendiente, en CLAUDE.md.)*
4. **Respaldos + monitoreo de errores.** Backups de Firestore programados, monitoreo
   (Sentry/alertas) y un mínimo plan de incidentes, antes de datos reales de clientes que
   pagan. *(No evidente → gap.)*

## P1 — Para escalar la carga de clientes (semanas siguientes)

5. **Monetización de Vivaru (cobro a los conjuntos).** Hay concepto de planes (planId,
   página de planes, estados trial→active→suspended). Falta definir/operar el **cobro**
   (precio por unidades, ciclo, factura). Puede ser **manual al inicio**, pero debe estar
   definido y con control de estado por impago.
6. **Onboarding asistido + soporte.** Guía de implementación para el cliente, materiales, y
   un canal de soporte (la consola superadmin ya tiene "support" → operarlo). SLA básico.
7. **Revisión de seguridad.** Auditoría de reglas Firestore/Storage, RBAC y **aislamiento
   multi-tenant** antes de volumen; idealmente un pentest ligero. Manejas dinero + PII.
8. **QA de flujos críticos.** Cobertura end-to-end de onboarding, cartera/comprobantes,
   notificaciones y reportes, para no romper en clientes reales.
9. **Pasarela de pagos de residentes** (PSE/Wompi/Mercado Pago CO-MX-EC). Gran acelerador de
   adopción y de recaudo; hoy es comprobante manual (funciona → **no bloqueante**, pero alto
   valor temprano).

## P2 — Por segmento o más adelante

10. **Facturación electrónica fiscal.** SRI Ecuador **congelado → EC bloqueado** para factura
    fiscal de cuotas. Evaluar DIAN (CO) / CFDI (MX) si el conjunto debe emitir factura por la
    administración. Define a qué clientes puedes venderles "con factura".
11. **Scale-readiness (Etapa 1).** El build actual sirve para los primeros ~100–300 conjuntos
    típicos (≤150 unidades). **Antes de aceptar un conjunto grande (>500 unidades)** hay que
    hacer la Etapa 1 (rollups + paginación servidor). No bloquea el arranque; condiciona a
    quién le vendes. Ver `reporte-escalabilidad-vivaru.md`.
12. **App/PWA para residentes.** Instalable + push nativo; mejora adopción y retención.
13. **Analítica de producto.** Adopción/retención por conjunto, para GTM y customer success.

## Lectura GTM (resumen)

- **Lo técnico-core ya está** (operación del conjunto: cartera, reportes, comunicaciones,
  visitantes, libro). El producto **opera**.
- **Lo que falta para "cargar clientes" es de arranque y confianza**, no de features de
  operación: (a) **carga inicial de datos + saldos**, (b) **legal/privacidad**, (c)
  **respaldos/monitoreo**, (d) el **pendiente de auth branded**.
- **Monetización y soporte** pueden arrancar manuales para los primeros clientes.
- **Pagos de residentes, facturación fiscal y scale-readiness** se priorizan según el
  segmento al que le vendas primero (recomendado: conjuntos típicos ≤150 unidades en CO/MX,
  evitando EC fiscal hasta destrabar SRI).
