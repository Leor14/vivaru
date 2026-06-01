---
tags: [modulo, marketing, lead-magnet, diagnostico]
tipo: tecnica
fuentes: ["consolidacion-landing-2026"]
fecha_creacion: 2026-05-31
fecha_actualizacion: 2026-05-31
---

# Diagnóstico de Caos Operativo

Lead magnet del [[landing-marketing|landing]] de Vivaru. Cuestionario de 12 preguntas en ~5 minutos que evalúa la madurez digital de un conjunto residencial. El resultado es un reporte personalizado que sirve como calificador de leads para el equipo comercial.

## Ruta y acceso

- **URL:** `/diagnostico`
- **Archivo:** `src/app/(marketing)/diagnostico/page.tsx`
- **Entry points:** Botón "Hacer el diagnóstico" en [[landing-marketing|sección Pain]] (componente `LeadMagnetPromo` dentro de `Pain.tsx`)

## Lógica de negocio

Toda la lógica vive en `src/lib/marketing/`:

| Archivo | Responsabilidad |
|---|---|
| `diagnostic-schema.ts` | Esquema Zod del cuestionario — valida respuestas del formulario |
| `diagnostic-score.ts` | Algoritmo de puntuación — calcula nivel de madurez digital |
| `diagnostic-recommendations.ts` | Genera recomendaciones personalizadas según el resultado |
| `emails/lead-notification.ts` | Dispara notificación al equipo interno cuando se completa |

## Niveles de madurez (output)

El score produce tres niveles de diagnóstico alineados con la propuesta de valor de Vivaru:

1. **Crítico** — conjunto en caos operativo total (Excel + WhatsApp + papel)
2. **Básico** — herramientas parciales sin integración
3. **Ordenado** — procesos establecidos, listo para escalar

## HITL pendiente — H11

La generación de PDF del reporte personalizado está pendiente. Actualmente el resultado se muestra solo en pantalla. Ver [[landing-marketing]] → tabla de HITLs.

## Analytics

Los eventos de conversión del diagnóstico se tracean via `track()` de `src/lib/marketing/analytics.ts` con PostHog. Eventos clave: `diagnostic_start`, `diagnostic_complete`, `diagnostic_result_view`.

## Relaciones

- Véase también: [[landing-marketing]], [[roadmap-tecnico]]
- Depende de: [[landing-marketing]]
- Se conecta con: [[pain-section]], [[analytics]]

## Fuentes

- [[consolidacion-landing-2026]]
