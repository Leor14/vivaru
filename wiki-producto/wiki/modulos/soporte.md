---
tags: [modulo, soporte, operacion]
tipo: tecnica
fuentes: ["PRD-V-FEAT-001-tickets-soporte", "sesion-soporte-2026-08"]
fecha_creacion: 2026-08-01
fecha_actualizacion: 2026-08-01
---

# Soporte — el canal del cliente hacia Vivaru

Tickets que el administrador de un conjunto escala al equipo de Vivaru. Vive en `/admin/soporte` para el cliente y en `/superadmin/support` para quien atiende. Especificado en `docs/prd/funcionales/PRD-V-FEAT-001-tickets-soporte.md` — ver [[portafolio-prd]].

Antes existía la colección `supportTickets`, pero era **solo-superadmin**: una bitácora interna donde el equipo anotaba incidencias. El cliente no tenía forma de escribir. Convertirla en un canal de dos lados fue el trabajo de agosto de 2026.

## La excepción que define el módulo

Soporte es la única funcionalidad operativa que **no** pasa por `assertTenantOperable`. Todo lo demás en Vivaru queda en solo lectura cuando el conjunto está `suspended` o `expired` — ver [[ciclo-de-vida-tenant]]. Soporte no, y la razón está escrita en el código:

> El soporte es el canal por el que un cliente suspendido deja de estarlo.

Bloquearlo sería encerrar al cliente fuera justo cuando más necesita hablar.

## Estados

`abierto` → `en_proceso` → `esperando_respuesta` → `resuelto` → `cerrado`

`cerrado` es terminal. Desde `resuelto` el cliente puede reabrir dentro de **7 días**; después ya no. La cola pendiente cuenta solo `abierto` y `en_proceso`: si `esperando_respuesta` contara, crecería con tickets que Vivaru no puede avanzar y dejaría de servir para priorizar. Este criterio de «un indicador, una definición» es el mismo de [[kpis-formula-unica]].

## Permisos

| Rol | Puede | No puede |
|---|---|---|
| `tenant_admin` | Crear, responder, adjuntar, reabrir dentro de la ventana | Cambiar estado, ver notas internas, escribir en `resuelto`/`cerrado` |
| `superadmin` | Todo, incluidas notas internas | Crear tickets a nombre de un cliente |
| `resident`, `security_guard` | Nada | Todo — soporte es del administrador |

Las notas internas viven en una **subcolección** `supportTickets/{id}/internal/{noteId}`, no en un campo del documento. No es preferencia de modelado: las reglas de Firestore no filtran campos. Un permiso de lectura sobre el documento expone todos sus campos, así que una nota interna guardada como campo sería visible para el cliente. Ver [[firebase-firestore]].

## Escritura solo desde el servidor

`allow create, update: if false` para todos. Las seis operaciones son callables: `createSupportTicket`, `replyToSupportTicket`, `updateSupportTicketStatus`, `reopenSupportTicketCallable`, `closeSupportTicketCallable` y `addSupportNote`. La decisión es la de siempre en [[multi-tenancy]]: hay lógica de negocio, permisos cruzados y correo, así que el cliente no escribe directo.

## Límites

5 tickets abiertos por conjunto, 10 al día, 3 adjuntos por mensaje de 5 MB cada uno, solo imágenes y PDF. El tope de adjuntos **no puede imponerse en las reglas de Storage** —suman permisos, nunca los restan— así que vive en la callable, que además lee tamaño y tipo reales del archivo ya subido en vez de fiarse de lo que declare el cliente. Es una de las trampas registradas en [[trampas-conocidas]].

## Correo

Los avisos salen por [[correos-mensajeria]] hacia `dev@qintilab.com`, donde el equipo comercial de DevQintilab los revisa una vez al día. Las respuestas por correo **no** entran al hilo: quien atiende responde dentro del producto. La entrega solo puede confirmarse en producción, porque staging no tiene el secret de Resend.

## Estado

**Productivo y verificado de punta a punta desde el 1 de agosto de 2026**, incluida la llegada del correo a DevQintilab. Desplegado en el orden de siempre: reglas, cuatro índices, seis callables, front.

Cierre automático por inactividad, SLA y base de conocimiento quedaron para fases posteriores, tal como registra [[estado-modulos]].
