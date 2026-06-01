---
tags: [modulo, admin, encuestas]
tipo: concepto
fuentes: ["BACKLOG.md", "PRODUCT.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Encuestas

Módulo de encuestas internas del portal administrador (`/admin/surveys`). Permite al administrador crear consultas a los residentes sobre temas del conjunto residencial.

## Propósito

Las encuestas son un canal de participación comunitaria. Casos de uso típicos: consulta sobre cambios en el reglamento, preferencias de horario para amenidades, evaluación de servicios de mantenimiento. Se complementa con el módulo de [[comunicaciones]] para notificar a los residentes cuando hay una encuesta activa.

## Flujo general esperado

1. Administrador crea encuesta con título, descripción, preguntas y fecha de cierre
2. El sistema notifica a los residentes (via [[comunicaciones]] o push)
3. Residentes responden desde [[portal-residente]]
4. Administrador ve resultados agregados en este módulo

## Estado: 🔲 pendiente critique

Este módulo no ha pasado por el flujo critique → execute → commit. Ver [[estado-modulos]]. Es uno de los módulos con mayor riesgo de violar el principio de [[absolute-bans|"no modals para flujos complejos"]], ya que la creación de una encuesta con múltiples preguntas es un flujo que debe usar [[drawer-pattern|Drawer]].

## Consideraciones de diseño

El módulo debe seguir el [[layout-patterns|patrón admin page]]. Las encuestas activas deben ser visualmente distintas de las cerradas usando [[componentes|StatusBadge]] con los colores semánticos de [[tokens-color]]. Los resultados pueden mostrarse con gráficos simples (barras o porcentajes), siguiendo los [[tokens-color|icon semantic tints]] para cada opción.

## Multi-tenancy

Las encuestas son por tenant. Un residente de un conjunto no puede ver las encuestas de otro. El campo `tenantId` en cada documento garantiza el aislamiento via [[firebase-firestore]]. Ver [[multi-tenancy]].

## Relaciones

- Véase también: [[comunicaciones]], [[portal-residente]], [[drawer-pattern]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[layout-patterns]], [[componentes]], [[tokens-color]], [[estado-modulos]]

## Fuentes

- [[backlog-md]], [[product-md]]
