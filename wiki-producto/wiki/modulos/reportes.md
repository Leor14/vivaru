---
tags: [modulo, admin, reportes]
tipo: concepto
fuentes: ["BACKLOG.md", "PRODUCT.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Reportes

Módulo de reportes operativos y financieros del portal administrador (`/admin/reports`). Consolida datos de los módulos principales para generar vistas de resumen exportables.

## Propósito

El administrador necesita reportes para rendir cuentas ante la asamblea de propietarios, tomar decisiones sobre el presupuesto y comunicar el estado del conjunto. Los reportes deben ser exportables a PDF o Excel.

## Tipos de reporte esperados

- **Reporte de cartera**: resumen de [[billing|BillingStatements]] por período, mostrando unidades al día, pendientes y vencidas
- **Reporte de visitas**: historial de [[visitantes|VisitorPasses]] por rango de fechas
- **Reporte de PQRS**: tickets abiertos y cerrados por categoría y período, desde el módulo [[pqrs]]
- **Reporte de reservaciones**: uso de amenidades por mes, desde [[reservaciones]]

## Estado: 🔲 pendiente critique

Este módulo no ha pasado por el flujo critique → execute → commit. Ver [[estado-modulos]]. Es el módulo de mayor complejidad técnica por la necesidad de agregar datos de múltiples colecciones de Firestore. Ver [[firebase-firestore]].

## Consideraciones de diseño

Los reportes deben seguir el principio "admin density without chaos" de [[product-md]]: muchos datos visibles, pero con jerarquía clara. Los KPIs de resumen usan la escala de [[tipografia|kpi-value-fluid]]. Los filtros de fecha y tipo de reporte siguen el [[layout-patterns|patrón admin page]].

## Exportación

La exportación de datos es el ítem A4 del [[gtm-tecnico|GTM técnico Fase 1]]. El formato de salida (PDF, Excel, CSV) debe decidirse antes de implementar este módulo para evitar refactores.

## Relaciones

- Véase también: [[billing]], [[visitantes]], [[pqrs]], [[reservaciones]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[tipografia]], [[layout-patterns]], [[estado-modulos]], [[gtm-tecnico]]

## Fuentes

- [[backlog-md]], [[product-md]]
