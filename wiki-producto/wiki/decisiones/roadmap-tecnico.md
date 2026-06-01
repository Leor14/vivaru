---
tags: [decision, roadmap, gtm, tecnico]
tipo: decision
fuentes: ["gtm-tecnico"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Roadmap Técnico (GTM)

Plan de go-to-market técnico de Vivaru organizado en fases. No es un roadmap de features de producto sino de infraestructura, seguridad, legal y operaciones necesarias para adquirir los primeros clientes de forma responsable.

## Fase 0 — Semanas 1 a 4: Fundamentos

Prioridad máxima antes de mostrar el producto a ningún cliente:

| ID | Tarea | Área |
|---|---|---|
| B1 | Firebase App Check | Seguridad |
| A1 | Tests de reglas Firestore | Seguridad |
| B2 | Storage rules | Seguridad |
| B5 | Backups | Operaciones |
| C9 | Decisión de marca Vivaru | Estrategia |
| C2/C3/C4 | Legal (en paralelo) | Legal |

Los tests de reglas [[firebase-firestore|Firestore]] (A1) son críticos — garantizan que el [[multi-tenancy|aislamiento multi-tenant]] funciona correctamente antes de tener datos reales de clientes.

## Fase 1 — Semanas 4 a 8: Infraestructura operativa

| ID | Tarea |
|---|---|
| C1 | Penetest |
| A8 | Renombrar HOGARU→Vivaru en toda la plataforma |
| A4 | Exportación de datos (formato a definir antes de [[reportes]]) |
| A5 | Offboarding de tenants |
| A6+B3 | Email transaccional (conecta con onboarding de [[usuarios]]) |
| A3 | Branding final aplicado |
| B4 | Dominio propio |
| B6 | Observabilidad (logs, alertas) |
| C5 | Aviso de privacidad |
| C6 | Playbook de onboarding |

## Fase 2 — Semanas 8 a 14: Enforcement y contratos

| ID | Tarea |
|---|---|
| A2 | Enforcement de límites de plan (conecta con `plans` en [[multi-tenancy]]) |
| A7 | Feature flags |
| C7 | Contrato comercial |
| C8 | Plan de incidentes |

## Fase 3+: Escalado

- Subdominio custom por tenant
- App nativa (iOS/Android)
- Analytics agregados multi-tenant

## Fase 4: Nivel 2 (post 5–10 clientes)

La transición al modelo Nivel 2 ocurre cuando hay 5–10 clientes estables. Implica:
- PAC mexicano (procesamiento de pagos en México)
- SPEI (transferencias bancarias mexicanas)
- Entidad legal en México
- Pagos embebidos en la plataforma

## Relaciones

- Véase también: [[gtm-tecnico]], [[multi-tenancy]], [[firebase-firestore]]
- Depende de: —
- Se conecta con: [[superadmin]], [[usuarios]], [[configuracion]], [[reportes]]

## Fuentes

- [[gtm-tecnico]]
