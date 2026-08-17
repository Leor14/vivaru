---
tags: [modulo, admin, pqrs, tickets, ia]
tipo: concepto
fuentes: ["domain-types", "PRD-VAI-FEAT-002", "hoja-de-ruta-ia"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-08-17
---

# PQRS (Peticiones, Quejas, Reclamos y Sugerencias)

Módulo de tickets entre residentes y administración (`/admin/pqrs`), con radicado, historial de respuestas, semáforo de plazo y —desde agosto de 2026— una capa asistida por IA que **propone y nunca decide**. Opera en dos variantes (ver [[modulos-variantes]]): `con_sla` y `buzon_simple`.

**Esta página se reescribió el 17 de agosto de 2026.** La versión anterior era de mayo y describía un módulo que ya no existe: entre tanto se añadió el editor de clasificación, el asistente de IA y el modo sombra, y se corrigieron tres defectos del modelo de datos que estaban falseando lo que el módulo registraba.

> **No confundir con [[soporte]].** PQRS es residente → administración del conjunto. Los tickets de soporte son administrador → equipo de Vivaru. Son dominios distintos con colecciones distintas.

## La entidad `Ticket`

Definida en [[domain-types]]. Lo que importa no es la lista de campos sino **quién escribe cada uno**, porque ahí estaban los defectos:

| Campo | Valores | Quién lo escribe |
|---|---|---|
| `category` | `pqrs` · `maintenance` · `billing` | **Nace constante en `pqrs`**, escrito a fuego al crear. El residente no la elige |
| `type` | `petition` · `complaint` · `claim` · `suggestion` · `other` | Lo elige el residente en `con_sla`. En `buzon_simple` **no se envía** y cae al default `other` |
| `priority` | `low` · `medium` · `high` | **Nadie, al crear.** Un ticket nace sin prioridad |
| `status` | `open` · `in_progress` · `responded` · `resolved` · `closed` | La administración |
| `radicado` | `PQRS-######` | Automático al crear |
| `responseHistory[]` | — | **Solo la administración.** El residente no tiene por dónde añadir |
| `classifiedAt` / `classifiedBy` | — | El editor de clasificación, cuando una persona guarda |

**Tres correcciones de agosto de 2026 que conviene entender, porque las tres eran datos falsos con apariencia de decisión humana:**

1. **En `buzon_simple` todo ticket nacía con `type: "petition"`.** El selector se oculta en esa variante pero el estado inicial se enviaba igual — una etiqueta que nadie eligió, justo en el eje donde el contrato de IA exige nulls como puerta dura. Ahora no se envía `type` y `createTicket` cae a su default.
2. **El desplegable del residente no renderizaba las descripciones.** El `map` pintaba solo `label` y el campo `description` llevaba muerto desde siempre: el residente elegía entre cuatro palabras desnudas. Ahora se muestran las cinco definiciones y la regla de precedencia del árbol —«reportar manda sobre pedir»— va escrita arriba del grupo.
3. **El selector de prioridad arrancaba en «Media».** Guardar cualquier corrección escribía también ese default: en la sesión de piloto, 3 de las 7 prioridades guardadas fueron decisiones que nadie tomó. Ahora arranca en «Sin prioridad» —estado real, visible solo mientras el ticket no la tenga— y guardar sin elegir **omite el campo**, no escribe `null`.

## Ciclo de vida

1. El residente crea el ticket desde [[portal-residente]] eligiendo `type` (en `con_sla`).
2. Se genera el `radicado` y el ticket nace `open`, sin prioridad.
3. `onTicketCreated` notifica a administradores y superadministradores.
4. El administrador lo ve en `/admin/pqrs`, puede **fijar o corregir la clasificación** y responder.
5. Al responder pasa a `responded`; `onTicketUpdated` avisa al residente **solo la primera vez**.
6. Cierre en `resolved` o `closed`.

**El [[portal-guardia]] NO crea tickets.** La versión de mayo de esta página lo afirmaba; se comprobó el 17 de agosto de 2026 y no existe esa ruta en el código.

## El editor de clasificación

`/admin/pqrs` permite fijar y corregir `category`, `type` y `priority`. **Antes no existía, y ese era el problema:** el administrador podía responder y cambiar el estado, nada más. `category` nacía constante, `type` lo elegía el residente y `priority` **no se escribía nunca** — el campo solo vivía en el tipo de TypeScript. Un ticket mal clasificado no se podía arreglar.

Importa más allá de la pantalla: es el único sitio donde ocurre la **decisión humana** contra la que el modo sombra compara sus sugerencias. Sin él, la sombra acumularía propuestas contra un hueco.

## Semáforo de plazo (solo `con_sla`)

`src/features/pqrs/sla.ts` calcula **15 días hábiles** desde `radicationDate` y devuelve tres niveles: `green`, `yellow`, `red`. En `buzon_simple` no hay semáforo, ni filtros de tipo, ni categorías: es un buzón de mensajes.

**Trampa de operación:** la antigüedad manda el semáforo. Si se siembra un conjunto de prueba, hay que hacerlo **el mismo día que se vaya a usar** o los tickets nacen ya en rojo. Ver [[trampas-conocidas]].

## La capa de IA

Toda la mecánica común —autorización, banderas, cuotas, telemetría— vive en [[puerta-ia]]; el marco del programa, en [[programa-ia]]. Aquí solo lo propio de PQRS.

### Asistente visible (Fase 3)

Operación `pqrs-asistir`, versión 2. Callable propia `asistirTicketPqrs`: **el cliente manda un `ticketId` y nada más**, y el servidor lee el ticket, el historial y la variante. No es ceremonia: `variante` es lo que decide la puerta dura de nulls, y si la mandara el navegador, esa puerta la estaría decidiendo el cliente.

Propone resumen, clasificación, prioridad con su razón, solicitudes, datos faltantes, próximos pasos, un borrador de respuesta y banderas de seguridad. **No cambia estados, no responde y no calcula plazos.** «Usar esta clasificación» rellena los selectores sin guardar; «copiar al cuadro de respuesta» llena el textarea. Publicar sigue siendo un acto de la persona.

Va detrás de la bandera `ai-pqrs-suggestions` (ver [[banderas-funcionalidad]]). Apagada, el drawer queda como antes de agosto: el editor de clasificación y el pie de respuesta siguen enteros, porque no son de IA.

**Una regla dura que se ganó midiendo:** el borrador no puede afirmar acciones de la administración que no consten en el historial —ni hechas, ni en curso, ni iniciadas—. Bajó las afirmaciones del 21,1% al 6,6%, y ahí se detuvo: 8 de los 10 casos restantes son «estamos verificando», la frase que la propia regla cita como prohibida. **El 0% no lo cumple el modelo sino el sistema**: una comprobación de servidor fuerza revisión humana y la pantalla resalta la frase dentro del borrador.

### Modo sombra (Fase 4)

Dos triggers de Firestore clasifican **en silencio** cada ticket nuevo y guardan la sugerencia junto a la decisión que acabe tomando el administrador. **No muestra nada a nadie** y **no escribe una sola letra en el ticket**.

El par se guarda en la colección `aiAssistance`, un documento por ticket. Vive **fuera** del `Ticket` por un motivo concreto: las reglas de Firestore dejan al **residente** leer su propio ticket, así que un campo ahí dentro sería visible para quien lo escribió y la sombra dejaría de serlo. Ver [[multi-tenancy]] y [[firebase-firestore]].

La sombra **omite** —y anota por qué— en cuatro casos, en este orden: proveedor simulado, ticket o conjunto sembrado (`isExample`), variante `buzon_simple`, y ticket sin texto. Los dos primeros existen para que el conjunto de evaluación no se envenene: un gold set envenenado se detecta comparándolo, pero una referencia de despliegue envenenada **parece que funciona**.

## Layout

[[data-table-pattern|DataTable]] con `renderMobileRow` — fila compacta de ~56 px con radicado, categoría y estado, nunca tarjetas de 200 px ([[absolute-bans]]). El detalle abre en un [[drawer-pattern|Drawer]] con el historial, el editor de clasificación y, si la bandera está encendida, el panel de IA al final y plegado. Prioridad y estado se pintan con [[componentes|StatusBadge]] sobre los [[tokens-color|colores semánticos]].

## Relaciones

- Véase también: [[domain-types]], [[data-table-pattern]], [[drawer-pattern]], [[modulos-variantes]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]], [[puerta-ia]], [[banderas-funcionalidad]]
- Se conecta con: [[portal-residente]], [[portal-guardia]], [[componentes]], [[tokens-color]], [[programa-ia]], [[trampas-conocidas]], [[soporte]]

## Fuentes

- [[domain-types]], [[design-md]], [[backlog-md]]
- `docs/prd/ia/PRD-VAI-FEAT-002-asistente-pqrs.md` — fuente de verdad de la capa asistida
- Código verificado el 17 de agosto de 2026: `src/features/pqrs/`, `src/app/(admin)/admin/pqrs/page.tsx`, `functions/src/ai/sombra-pqrs.ts`, `functions/src/ai/pqrs-gateway.ts`
