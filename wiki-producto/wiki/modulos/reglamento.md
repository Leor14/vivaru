---
tags: [modulo, admin, reglamento, documentos]
tipo: concepto
fuentes: ["domain.ts", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Reglamento (Documentos)

Módulo de gestión de documentos del conjunto residencial (`/admin/regulations`). Centraliza el reglamento de propiedad horizontal, actas de asamblea y circulares para que administradores y residentes puedan consultarlos. Incluye los acuerdos de comité, cuya gobernanza opera en dos variantes (ver [[modulos-variantes]]): `formal` (acuerdos con firma digital) o `informativo` (se publican sin firma).

## Entidades principales

El tipo `TenantDocument` en [[domain-types]] define la entidad:
- `title`: nombre del documento
- `category`: reglamento | acta | circular
- `audience`: all | admins — algunos documentos solo son para administradores

## Categorías de documentos

| Categoría | Descripción | Audiencia típica |
|---|---|---|
| `reglamento` | Reglamento de propiedad horizontal | all |
| `acta` | Actas de asamblea | all u owners |
| `circular` | Comunicados formales archivados | all |

## Vista del residente

Los documentos con `audience: all` son accesibles desde [[portal-residente]]. El residente puede descargar el reglamento, consultar actas históricas o leer circulares archivadas. Los documentos `audience: admins` solo los ve el administrador.

## Estado: 🔲 pendiente critique

Este módulo no ha pasado por el flujo critique → execute → commit. Ver [[estado-modulos]]. El critique debe verificar la funcionalidad de carga de archivos PDF y que el viewer no use un modal de pantalla completa (flujos complejos deben usar [[drawer-pattern|Drawer]] per [[absolute-bans]]).

## Layout esperado

Debe seguir el [[layout-patterns|patrón admin page]] con lista de documentos por categoría. Las [[animaciones|tarjetas de documento]] deben usar el hover premium de [[componentes|Card]]: `translateY(-2px)` + sombra más fuerte (`.premium-card-hover`).

## Conexión con Firebase Storage

Los archivos PDF se almacenan en Firebase Storage con reglas de acceso por `tenantId`. Las reglas de Storage son parte del ítem B2 del [[gtm-tecnico|GTM técnico Fase 0]]. Ver [[firebase-firestore]].

## Relaciones

- Véase también: [[domain-types]], [[portal-residente]], [[drawer-pattern]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[layout-patterns]], [[componentes]], [[estado-modulos]], [[gtm-tecnico]]

## Fuentes

- [[domain-types]], [[backlog-md]]
