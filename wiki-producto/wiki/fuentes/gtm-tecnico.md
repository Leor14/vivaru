---
tags: [fuente, gtm, roadmap]
tipo: fuente
fuentes: ["gtm-tecnico"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Fuente: GTM Técnico

Documentación del plan de go-to-market técnico de Vivaru. Define las cuatro fases de preparación para producción, desde seguridad básica hasta escalado con presencia en México.

## Contenido principal

El GTM técnico prioriza trabajo antes de adquirir los primeros clientes. No es un roadmap de features sino de infraestructura, legal y operaciones. El detalle completo de cada fase vive en [[roadmap-tecnico]].

## Resumen de fases

**Fase 0 (semanas 1–4)**: Fundamentos de seguridad y decisiones de marca. Incluye App Check (B1), tests de reglas Firestore (A1), Storage rules (B2), Backups (B5) y decisión de marca Vivaru (C9). Paralelo: aspectos legales C2/C3/C4. Ver [[firebase-firestore]] para el contexto técnico de A1.

**Fase 1 (semanas 4–8)**: Infraestructura operativa. Cubre Penetest (C1), renombrado HOGARU→Vivaru (A8), exportación de datos (A4), offboarding (A5), email transaccional con A6+B3, branding (A3), dominio propio (B4), observabilidad (B6), aviso de privacidad (C5) y playbook de onboarding (C6).

**Fase 2 (semanas 8–14)**: Enforcement de límites de plan (A2), feature flags (A7), contrato comercial (C7) y plan de incidentes (C8). El enforcement de planes conecta con [[multi-tenancy]] y los campos `maxUnits` y `featuresEnabled[]` de la colección `plans`.

**Fase 3+**: Subdominio custom, app nativa, analytics agregados.

**Fase 4 (post 5–10 clientes)**: Nivel 2 comercial, PAC mexicano, SPEI, entidad legal en México. Este hito dispara el [[multi-tenancy|modelo Nivel 2]] definido en el comercial.

## Conexión con modelo comercial

El GTM técnico está coordinado con el modelo comercial Nivel 1 (sin pagos embebidos, sin DIAN/SAT en código, factura desde Colombia, activación en 72h). La transición al Nivel 2 ocurre después de 5–10 clientes estables.

## Relaciones

- Véase también: [[roadmap-tecnico]], [[multi-tenancy]]
- Depende de: [[firebase-firestore]], [[autenticacion-roles]]
- Se conecta con: [[stack-tecnico]], [[configuracion]], [[usuarios]]

## Fuentes

- Notas internas de planificación Vivaru (no versionadas en el repo principal)
