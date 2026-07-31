---
tags: [fuente, auditoria, ux, calidad]
tipo: fuente
fuentes: ["vivaru_ux_audit.html", "sesion-auditoria-ux-2026-07"]
fecha_creacion: 2026-07-03
fecha_actualizacion: 2026-07-03
---

# Auditoría UX/UI — Julio 2026

Reporte externo de auditoría de la interfaz de administrador (`vivaru_ux_audit.html`), realizado con interacción manual módulo a módulo sobre el tenant demo Santa María. Documentó **42 hallazgos** con IDs `VIV-###` clasificados en 9 críticos, 13 altos, 14 medios y 6 bajos, y propuso un plan en 3 olas.

Sus tres tesis centrales: (1) filtración de IDs de Firestore a la UI — resuelto con [[resolucion-unit-id]]; (2) el campo Torre/Bloque como texto libre fragmentaba filtros y KPIs — resuelto con [[torres-canonicas]]; (3) inconsistencia de patrones de interacción entre módulos — resuelto con [[acciones-de-fila]].

## Lo que aportó y lo que no

El reporte acertó en las causas raíz, pero **~una cuarta parte de sus hallazgos no aplicaban** tal como los describía: varios guards ya existían en el código (el "111% de morosos" era síntoma de datos, no de cálculo), otros eran basura del seed del demo, y dos eran decisiones de negocio disfrazadas de bug. El proceso de verificación contra código está documentado en [[triaje-auditoria-ux]] — leerlo antes de ejecutar cualquier reporte externo futuro.

## Hallazgos de mayor impacto confirmados

- IDs crudos en tablas de [[visitantes]], [[pqrs]], [[reglamento]] y [[reservaciones]] → [[resolucion-unit-id]].
- Torres duplicadas (`T1`/`torre 1`/`torre1`) → [[torres-canonicas]].
- Asientos contables borrables y cobros sin confirmación → [[integridad-financiera]].
- El mismo KPI con 3 valores entre Panel, módulo y [[reportes|Reporte de Comité]] → [[kpis-formula-unica]].

## Relaciones

- Véase también: [[triaje-auditoria-ux]], [[trampas-conocidas]]
- Se conecta con: [[estado-modulos]], [[dashboard-admin]]

## Fuentes

- Archivo original: `~/Downloads/vivaru_ux_audit.html` (jul 2026)
