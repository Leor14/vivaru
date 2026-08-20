# RESPUESTA-A-002 — Albert → Vivaru

> Respuesta a `DECISIONES-A-001` (v0.1, 19-ago-2026). Cerramos las dos contradicciones que nos señalasteis —tenéis razón en las dos—, confirmamos las seis decisiones con su implicación de código, corregimos nuestra propia frase «sin PII», y respondemos lo único que nos pedís de vuelta: la fecha de A1.

| | |
|---|---|
| **De** | Equipo de Albert CRM |
| **Para** | David (Vivaru / Qintilab) |
| **Responde a** | `DECISIONES-A-001` v0.1 |
| **Proyecto** | `albert-crm-1-1c162` · functions en `us-central1` |
| **Fuentes nuevas citadas** | `apps/web/src/lib/firebase/crm.ts:52` (`contactSchema`), `:159` (`addTimeline`), `:575-635,717-820` (mensajes de timeline) |

Convención (igual que en A-001): ✅ **existe hoy** · 🔧 **requiere construcción** · ⚖️ **decisión de producto**.

---

## Las dos contradicciones — las resolvemos como decís, y una es peor de lo que parecía

### Contradicción 1 · `consent` en dos sitios → **se queda solo en el contacto**

Tenéis razón: nuestro bloque de A1 lo metía en `dealSchema` y B2 lo recomendaba en el contacto. **Dos fuentes de verdad para el mismo hecho jurídico es un bug esperando a pasar.** Lo resolvemos como pedís:

- **`consent` NO va en `dealSchema`.** Retiramos ese sub-objeto de la extensión de A1. El bloque tipado del deal queda **solo** con `externalRef`, `estimatedUnits`, `country`.
- **`consent` va en `contactSchema`** (`crm.ts:52`), que hoy es un `z.object` cerrado con `name/email/phone/whatsapp/company/jobTitle/leadSource/priority/responsibleId/tags/notes/lastActivityAt`. Añadimos, opcional:

```ts
// añadido a contactSchema, opcional
consent: z.object({
  policyVersion: z.string().trim().min(1).max(40),
  acceptedAt:    z.string().datetime(),   // fecha puesta por el servidor de Vivaru
}).optional(),
```

Una sola fuente de verdad, en la entidad-persona. Confirmado.

### Contradicción 2 · deal sin contacto no puede guardar consentimiento → **cerrada por vuestro compromiso, sin tocar el esquema**

También correcta. `contactId` es `optionalIdSchema` y un deal nace sin contacto (`crm.ts:71`); con el consentimiento en el contacto, un deal huérfano no tendría dónde alojarlo.

**Aceptamos vuestro cierre y no hacemos `contactId` obligatorio.** Hacerlo rompería a los usuarios actuales de Albert que crean deals sueltos. Como Vivaru se compromete a **crear siempre el contacto antes del deal**, por vuestra vía nunca llega un deal sin sitio para el consentimiento. Lo dejamos anotado como **invariante del lado de Vivaru**, no como regla del esquema. ✅

### Punto 3 · el `vivaruLeadId` del log de supresión sí reidentifica → **corregimos nuestra frase**

Aceptamos la corrección. Llamar «sin PII» al registro de auditoría de la supresión fue impreciso: mientras el lead exista de vuestro lado, `vivaruLeadId` es un **seudónimo que reidentifica** (dato personal seudonimizado, no anónimo). Lo tratamos así en la política escrita:

- **Qué se conserva:** `vivaruLeadId`, `dealId`, `at`, actor — el mínimo para **demostrar que se ejerció el derecho de supresión** (que es una obligación legal, no una violación).
- **Base legal de la conservación:** cumplimiento de la propia obligación de acreditar la supresión (Ley 1581 / LFPDPPP).
- **Cuánto vive:** se rige por su **propia ventana de retención** —candidata a definirse junto con B3—, no «para siempre». La política dirá el número.

O sea: no afirmamos que no sea dato personal; declaramos por qué se guarda y por cuánto. ⚖️ (el «cuánto» se cierra con B3).

---

## Las seis decisiones — confirmadas

### A1 · Bloque tipado, con índice — **confirmado** ✅🔧

Aceptado el bloque tipado sobre el mapa genérico. Estado final de la extensión de `dealSchema` (todo opcional, aditivo, no rompe deals existentes):

```ts
externalRef:    z.object({ system: z.literal("vivaru"),
                           leadId: z.string().trim().min(1).max(120) }).optional(),
estimatedUnits: z.coerce.number().int().min(0).optional(),
country:        z.string().trim().length(2).optional(),   // ISO-3166-1 alpha-2
// consent: RETIRADO — vive en contactSchema (contradicción 1)
```

- **Índice sobre `externalRef.leadId`: sí.** Lo añadimos a `firestore.indexes.json`. Vuestra consulta «¿este lead ya está en el CRM?» es un `where("externalRef.leadId","==",vivaruLeadId)` dentro de `tenants/vivaru/deals`; sin índice, Firestore la resuelve pero degrada al crecer. Con volumen pequeño no lo notaréis, pero el índice es barato y lo dejamos puesto desde el día uno.
- `country` en ISO alpha-2, confirmado.

### A2 · `amount: 0`, sin campo nuevo — **confirmado** ✅

Sin `is_estimate`. `amount: 0` al entrar, cifra al calificar, `estimatedUnits` como señal. Reconfirmamos el porqué técnico: el ingreso ganado se computa solo sobre `Ganado` (`revenue-engine.ts:89`, `insights.ts:229`) y el forecast pondera `amount × closeProbability`, así que un `0` aporta `0`. El efecto en ticket promedio de deals abiertos lo asumís; nada más que hacer aquí.

### B1 · Supresión: anonimizar histórico, borrar contacto — **confirmado, y vuestra segunda petición es más necesaria de lo que creíais** ✅🔧

Aceptado el modelo (anonimizar timeline, borrar contacto). Vuestras dos peticiones sobre la callable:

**1) Dos llaves.** Hecho: `eraseByExternalRef` aceptará **ambas firmas** — `{ tenantId, vivaruLeadId }` (vuestra vía habitual) y `{ tenantId, dealId }` (operación manual cuando el cruce se rompió).

**2) Que la anonimización alcance el texto libre. Aquí hay un detalle que verificamos y que conviene que sepáis, porque cambia el alcance:**

El PII en el timeline **no viene de `notes` ni de `productOrService`** — esos campos **no se copian** al timeline. Viene del propio **`message`** de cada evento, que **embebe el nombre y el título**:

- `Contacto creado: ${payload.name}` (`crm.ts:610`)
- `Contacto actualizado: ${payload.name}` (`crm.ts:579`)
- `Contacto eliminado: ${contact.name}` (`crm.ts:635`)
- `Deal creado/actualizado/movido: ${title}` (`crm.ts:721,760,802`)

Es decir: **aunque borremos el contacto, el timeline sigue diciendo `Contacto creado: Juan Pérez`.** El nombre sobrevive en el `message`, no en un campo estructurado. Por eso la anonimización **no puede limitarse a vaciar campos**: tiene que **reescribir el `message`** de cada evento del deal/contacto a una forma sin PII (p. ej. `Contacto creado: [suprimido]`, conservando tipo de evento y fecha). Eso es exactamente lo que da la métrica de RevOps (secuencia + tiempos) sin el dato personal.

Sobre `notes`/`productOrService`: como el modelo **borra el deal entero**, esos campos desaparecen con él; no hace falta tratarlos aparte. Solo eran un riesgo si sobrevivieran copiados en el timeline, y no se copian. Verificado.

Resumen del alcance real de la callable: borra contacto → reescribe `message` de eventos de timeline del deal y del contacto → purga aprobaciones → borra deal → deja log de supresión seudonimizado (punto 3). 🔧 mediano, como anticipamos.

### B2 · Consentimiento en el contacto — **confirmado** ✅

En `contactSchema`, con la forma de arriba. `acceptedAt` lo pone vuestro servidor. Y como Vivaru crea siempre contacto (contradicción 2), siempre hay dónde. Cerrado.

### B3 · Retención: criterio sí, N después — **confirmado, y `updatedAt` es la elección correcta** ✅⚖️

**Criterio `updatedAt` del deal: aceptado, y coincide con cómo está el código.** `updatedAt` se reescribe en cada `upsertDeal` (`crm.ts:695`, `updatedAt: activityAt`), así que refleja actividad real del deal y no la fecha de creación ni la última tarea. Es el campo menos ambiguo, como decís.

**La N queda parametrizable, no cableada.** Construimos la función programada (Cloud Scheduler → callable que reutiliza la lógica de B1) con la N como **parámetro de configuración**, no como constante. Vuestra propuesta de partida **24 meses sin actividad → anonimización** queda anotada como default candidato, sujeta a que cerréis vuestra política. Cuando llegue el número, es un cambio de config, no de código. ⚖️ (la N es vuestra/conjunta; la maquinaria es nuestra).

### C2 · Usuario de servicio del tenant, con nombre no humano — **confirmado** ✅

Usuario de servicio del tenant, sin Cloud Function intermedia. Aceptamos vuestra condición de auditoría —**nombre obviamente no humano**— y es fácil: `createTenantUser` (`functions/src/index.ts`) guarda `displayName` tanto en Auth como en `users/{uid}` y `tenants/{tenantId}/users/{uid}`. Lo damos de alta con:

- **`displayName` visible:** `integracion-vivaru` (como proponéis).
- **`role`:** `sales` (puede crear/editar deals y contactos; `canWriteTenantData`).
- **Ojo de precisión:** en `createdBy`/`updatedBy` **no** queda `integracion-vivaru`, queda el **`uid`** de ese usuario (los campos de auditoría guardan `uid`, `audit.ts:5,7`). El nombre legible se resuelve mirando el doc del usuario. Es decir: la auditoría es rastreable a «integracion-vivaru», pero vía el `uid`, no como string literal. Correo y `uid` se fijan en el alta de A5 y os los devolvemos por el canal que digáis.

### D1 · Carencias compartidas — **recibido, y respondemos claro** ✅⚖️

Agradecemos que lo convirtáis en decisión y no en espera. Nuestra postura, con la franqueza que pedís:

| Capacidad | Respuesta de Albert |
|---|---|
| **Precio de plan** | Perfecto que **lo cableéis vosotros sin esperarnos**. No bloquea nada de este lado; los límites de plan hoy ni se aplican (A5c). Si luego conviene compartir modelo, se comparte. |
| **Motor de mensajería** (consentimiento/supresión/frecuencia) | **La tomamos como candidata a componente compartido y la llevamos a priorización de producto.** ⚖️ Coincidimos en que sin control de opt-out y frecuencia, el `consent` que acabamos de diseñar no tiene quién lo respete en el envío. **Aún no está en un roadmap comprometido**; en cuanto producto la priorice (o la descarte), os lo decimos claro —como quedamos— para que no la escribáis esperándonos. Hoy no podemos daros un sí firme, solo que está sobre la mesa. |
| **Agenda de demos** | Recibido que **no la pedís**. No la construimos; el formulario aguanta para una persona prospectando. |

---

## Alta del tenant (A5) — recibido

Anotado para ejecutar (lo hace un superadmin de Albert, `createTenant` + `createTenantUser`):

- **`tenantId`:** `vivaru`
- **Nombre:** Vivaru
- **Rol de comerciales:** `sales`
- **`tenant_admin`:** vuestro (para que «en prueba» no dependa de nadie más) — el correo nos lo pasáis por el canal aparte, no en el documento. ✅
- **Usuario de servicio:** `integracion-vivaru`, rol `sales` (C2).

Devolvemos tras el alta: el `uid` del `tenant_admin`, el `uid` y correo del usuario de servicio, y confirmación del doc `tenants/vivaru`.

---

## Lo único que pedís de vuelta: la fecha de A1

Aquí somos honestos sobre qué podemos y qué no podemos afirmar en un documento:

**Lo técnico (esto sí lo podemos comprometer):** A1 es **pequeño y aditivo**. Son tres piezas: extender `dealSchema` con el bloque opcional + extender `contactSchema` con `consent` + añadir el índice sobre `externalRef.leadId`. **No hay migración de datos** (todo opcional, los deals existentes siguen válidos), no toca el camino de escritura salvo dejar de descartar los campos nuevos, y no cambia reglas. En esfuerzo de ingeniería es **cuestión de días, no de semanas** — reconfirmamos la estimación de A-001.

**Lo que no podemos hacer aquí (⚖️):** poner una **fecha de calendario** en firme es una decisión de planificación de producto, no un hecho de código, y comprometerla por escrito sin que el owner de Albert la fije sería inventarla — justo lo que ninguno de los dos quiere. Lo que sí hacemos: **elevar A1 como el primer incremento**, por delante de B1 y del precio de plan, porque es lo único que os deja parados. **La ventana concreta (esta semana vs. la que viene) os la confirma el owner por el canal de coordinación** en cuanto veamos este documento — y entendemos que de esa respuesta depende qué hace Vivaru mientras tanto, así que no la dejamos colgando: es lo primero que cerramos.

> En una frase: **el trabajo de A1 cabe en días y va primero; la fecha exacta os la damos por el canal de coordinación, no la fijamos aquí para no inventarla.**

---

## Resumen — un renglón por punto

| # | Punto | Respuesta de Albert |
|---|---|---|
| **Contra. 1** | `consent` duplicado | **Resuelto:** solo en el contacto; retirado de `dealSchema`. |
| **Contra. 2** | deal huérfano sin consentimiento | **Cerrado por vuestra invariante** (siempre creáis contacto); no tocamos `contactId`. |
| **Punto 3** | `vivaruLeadId` reidentifica | **Corregido:** seudónimo, no anónimo; base legal + ventana propia de retención. |
| **A1** | bloque tipado + índice | ✅ Confirmado; `consent` fuera; índice sobre `externalRef.leadId`. |
| **A2** | `amount: 0` | ✅ Convención, sin campo nuevo. |
| **B1** | supresión | ✅ Anonimizar timeline (reescribir `message`, que es donde vive el nombre) + borrar contacto; callable por las dos llaves. |
| **B2** | consentimiento | ✅ En el contacto. |
| **B3** | retención | ✅ Criterio `updatedAt`; N parametrizable (default 24m, sujeto a vuestra política). |
| **C2** | identidad de escritura | ✅ Usuario de servicio `integracion-vivaru`, rol `sales`; auditoría vía su `uid`. |
| **D1** | carencias | Precio: vuestro. Mensajería: ⚖️ a priorización, sin sí firme hoy. Agenda: no se construye. |
| **A5** | alta del tenant | ✅ Recibido; ejecuta superadmin; devolvemos `uid`s tras el alta. |
| **Pedido** | fecha de A1 | A1 va primero (días); **fecha exacta por el canal de coordinación**, no fijada aquí. |

---

*Albert CRM — respuesta a DECISIONES-A-001 · afirmaciones citadas al código del repo `albertcrm` · el único punto que no cerramos por escrito es la fecha de calendario de A1 (decisión del owner), y el default de la N de B3 (vuestra política).*
