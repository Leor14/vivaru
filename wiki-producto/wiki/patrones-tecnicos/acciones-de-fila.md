---
tags: [patron, ui, interaccion, destructivas]
tipo: tecnica
fuentes: ["sesion-auditoria-ux-2026-07"]
fecha_creacion: 2026-07-03
fecha_actualizacion: 2026-07-03
---

# Acciones de Fila — Patrón Único

Regla adoptada tras la [[auditoria-ux-jul-2026]] para que la UI "se sienta hecha por un solo equipo":

> **Lo frecuente y no destructivo va inline; lo destructivo o lo que emite comunicación externa vive en el menú contextual `…` (`RowActionsMenu`).**

`RowActionsMenu` (`src/components/shared/row-actions-menu.tsx`) ofrece `onView/onEdit/onDelete`, `items` custom con `danger` y `separatorBefore`. Complementa a [[data-table-pattern]] (prop `renderActions`) y al [[drawer-pattern]].

## Aplicación por módulo

| Módulo | Inline (frecuente) | En el menú `…` |
|---|---|---|
| [[visitantes]] | QR | Editar, Eliminar |
| Documentos | Destacar, Abrir, Descargar | Eliminar |
| [[usuarios]] | Toggle Desactivar/Reactivar | Editar, Reenviar acceso, Eliminar |
| Libro y fondos | — | Reversar (ver [[integridad-financiera]]) |
| [[reglamento|Acuerdos]] | Cargar PDF (1ª vez), Firmas, Mandar a firma | Reemplazar PDF, Eliminar |
| Conciliación | Conciliar / Deshacer | Eliminar línea |
| [[paquetes]] | — | Notificar al residente, Marcar entregado |

## Excepción documentada

En [[usuarios]] el toggle de estado queda **inline a propósito**: su tooltip de bloqueo ("No puedes desactivar tu propia cuenta", "Es el último administrador activo") no sobrevive dentro de un menú, y esa affordance fue destacada como fortaleza por la auditoría. Regla general: si mover una acción al menú pierde una salvaguarda visible, la salvaguarda gana.

## Reglas asociadas de la misma familia

- Semántica de color: "Enviado" es azul informativo, el amarillo se reserva a advertencias.
- Selección de unidad **siempre por select** (agrupado por [[torres-canonicas|torre canónica]]), nunca input de texto — aplicado en [[reservaciones|Crear reserva]].
- Resultados de [[encuestas]] muestran todas las opciones aunque tengan 0 votos; escalas numéricas en orden natural.

## Relaciones

- Véase también: [[componentes]], [[form-validation]]
- Se conecta con: [[triaje-auditoria-ux]], [[dashboard-admin]]

## Fuentes

- Commits `ad6cbaa` (Grupo 2) y `8e503a2` (Grupo 3)
