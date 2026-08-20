# RESPUESTA-A-001 — Albert → Vivaru

> Respuesta a `CONSULTA-A-001` (v0.2, 19-ago-2026). Un veredicto **sí / no / así lo haríamos** por pregunta, con el detalle y la cita a `archivo:línea` del repositorio de Albert detrás de cada afirmación. Marcamos explícitamente qué **existe hoy** vs. qué **requiere construcción**, y qué es **hecho de código** vs. **decisión de producto** pendiente de ratificar.

| | |
|---|---|
| **De** | Equipo de Albert CRM |
| **Para** | David (Vivaru / Qintilab) |
| **Responde a** | `CONSULTA-A-001` v0.2 |
| **Proyecto** | `albert-crm-1-1c162` · functions en `us-central1` |
| **Fuentes** | `shared/src/schemas/*.ts` · `functions/src/index.ts` · `apps/web/src/lib/firebase/{crm,saas-admin,leads}.ts` · `firestore.rules` |

### Convención de este documento

- ✅ **Existe hoy** — es así en el código, sin trabajo adicional.
- 🔧 **Requiere construcción** — no existe; proponemos cómo lo haríamos y su tamaño.
- ⚖️ **Decisión de producto** — no es un hecho de código; alguien tiene que decidir.

Y aceptamos de entrada las tres cosas que dais por cerradas (tenant, «convertido» en deals, volumen pequeño) y las dos que adoptáis (formato de `crmRef`, correo en minúsculas). Construimos pequeño, como pedís.

---

## Bloque A · Bloquean la implementación

### A1 · ¿Se pueden añadir campos propios a un `deal`? — **la que más bloquea**

**Veredicto: hoy NO se puede; lo construimos — así lo haríamos.** 🔧⚖️

**Confirmación de vuestro diagnóstico (es correcto).**
`dealSchema` (`shared/src/schemas/crm.ts:68`) es un `z.object` **cerrado**: no lleva `.passthrough()` ni `.catchall()`, así que Zod **descarta silenciosamente** cualquier clave desconocida. Y el camino de escritura lo sella dos veces: `upsertDeal` valida con `dealSchema.safeParse(deal)` y luego construye el documento con `const payload = { ...parsed.data, ... }` (`crm.ts:676,684`). Es decir, aunque enviarais `vivaruLeadId`, **nunca llegaría a Firestore**: se cae en el `safeParse` y otra vez en el *spread*. Los únicos textos libres son `notes` (max 800) y `productOrService` (max 120), y coincidimos con vosotros: **no sirven** — son campos de humano, se rompen el primer día.

**No hay campos personalizados por tenant hoy.** Confirmado: no existe ningún mapa de extensión ni `customFields` en el esquema ni en el camino de escritura.

**Así lo haríamos (propuesta concreta).** Extendemos `dealSchema` con un bloque de integración **tipado y opcional**, no un mapa genérico. Un mapa `Record<string,string>` os desbloquearía, pero pierde validación y ensucia el reporting; para lo que necesitáis (una llave de cruce + dos campos de calificación + consentimiento del bloque B) preferimos campos con forma:

```ts
// añadido a dealSchema, todo opcional para no romper deals existentes
externalRef:    z.object({                // llave de cruce bidireccional
  system: z.literal("vivaru"),
  leadId: z.string().trim().min(1).max(120),
}).optional(),
estimatedUnits: z.coerce.number().int().min(0).optional(),   // calificación
country:        z.string().trim().length(2).optional(),      // ISO-3166-1 alpha-2
consent:        z.object({                // ver B2
  policyVersion: z.string().trim().min(1).max(40),
  acceptedAt:    z.string().datetime(),   // fecha puesta por VUESTRO servidor
}).optional(),
```

- `externalRef.leadId` es vuestro `vivaruLeadId`. Con eso, el cruce es bidireccional: vuestro `crmRef` apunta al deal (`albert:deal:{tenantId}:{dealId}`) y el deal sabe de dónde vino (`externalRef.leadId`).
- **Unidades y país** los ponemos como campos propios porque, como decís, tarifáis por unidad y país; tenerlos tipados nos deja además calificar y (a futuro) reportar por país sin *parsear* texto.
- Índice: si vais a **buscar deals por `vivaruLeadId`**, añadimos un índice sobre `externalRef.leadId` (`firestore.indexes.json`). Barato.

**Lo que hace falta decidir (⚖️):** un bloque genérico `externalRefs` (mapa, extensible a otros sistemas futuros) vs. el bloque tipado de arriba. Recomendamos el tipado por lo pequeño y concreto del caso. Confirmadnos y lo cableamos; es la pieza que os deja empezar.

---

### A2 · `amount` obligatorio y admite `0`. ¿Un `0` ensucia el forecast?

**Veredicto: un `0` NO ensucia nada — así está construido; pero hay una convención mejor.** ✅⚖️

`amount` es `z.coerce.number().min(0)` (`crm.ts:73`): obligatorio, y `0` es válido. **El motor de forecast no confunde un `0` con revenue**, porque el pipeline pondera por **etapa**, no por la mera existencia de un monto:

- El ingreso «ganado» se calcula **solo sobre deals en `Ganado`** (`revenue-engine.ts:89`, `insights.ts:229`). Un deal recién entrado en `Nuevo` con `amount: 0` **no entra** en ese cálculo.
- El *forecast* ponderado usa `amount × closeProbability`; con `amount: 0` su contribución es `0`. No infla ni deprime el número: simplemente no aporta hasta que le pongáis cifra.

**Riesgo real (menor):** los tableros de «valor total del pipeline» **suman `amount` de deals abiertos**. Muchos `0` no distorsionan el total (suman 0), pero sí bajan el **ticket promedio** si alguien lo mira sobre deals abiertos. Es cosmético.

**Así lo haríamos (convención, sin cambiar código):** crear el deal con `amount: 0` al entrar, y **rellenar el monto al calificar** (que es cuando conocéis las unidades). Si preferís marcarlo como estimado, el bloque `estimatedUnits` de A1 sirve de señal («esto aún no es una cifra en firme»). No necesitamos un campo «is_estimate» aparte salvo que lo queráis explícito — decidilo vosotros.

---

### ~~A3~~ · **RESUELTA** — `contactId` opcional

Confirmado y sin cambios: `contactId` es `optionalIdSchema` (`crm.ts:71`), un deal nace sin contacto. ✅

---

### ~~A4~~ · **RESUELTA** — más el punto menor sobre el pipeline

Aceptamos vuestra corrección. Y respondemos el punto menor que movéis a A5 —**dónde vive el pipeline y quién puede tocarlo**— porque es importante para vuestra etapa «en prueba»:

**Veredicto: vuestra etapa «en prueba» está a salvo mientras vosotros seáis quienes editáis el pipeline.** ✅

- El pipeline del tenant vive en el documento **`tenants/{tenantId}/config/pipeline`**, campo `stages` (`crm.ts:176` lectura, `crm.ts:203` escritura vía `savePipelineStages`).
- **Quién puede cambiarlo:** solo `superAdmin` o `tenant_admin` del tenant (`firestore.rules:53-55`). Un `sales` **no** puede tocarlo.
- **Preservación:** `ensureRequiredStages` (`crm.ts:68-78`) reinyecta `Ganado`/`Perdido` en cada guardado, pero **respeta el resto de las etapas tal cual las envíes**. «en prueba» sobrevive salvo que un `tenant_admin` la borre a propósito. Nosotros (Albert) **no** tenemos ningún proceso que reescriba vuestros stages por debajo; el único automatismo es añadir los dos terminales si faltaran.

Conclusión: si el `tenant_admin` de `vivaru` es vuestro, nadie de nuestro lado va a borrar «en prueba».

---

### A5 · Alta del tenant `vivaru` y de sus usuarios

Respondemos las cinco sub-preguntas:

**a) ¿Cómo se crea un tenant y quién lo hace?** ✅
Callable `createTenant` (`functions/src/index.ts`), protegida por `assertSuperAdmin` → **solo un superadmin de Albert** lo crea. Toma `{ tenantId, name }` (`createTenantSchema`: `tenantId` en minúsculas/números/guion, 3–40 chars) y escribe el doc `tenants/{tenantId}` con `status: "active"`. También hay flujo en la consola `/admin` (`createTenantWithProfile`). **Lo hacemos nosotros**; vosotros nos dais el `tenantId` deseado (`vivaru`) y el nombre.

**b) ¿Qué roles hay y cuál es «comercial que trabaja sus oportunidades»?** ✅
Roles (`shared/src/schemas/rbac.ts`): globales `superadmin`, `platform_support`; de tenant `tenant_admin`, `sales`, `viewer`, `finance`. El **comercial es `sales`**: es exactamente quien puede **crear y editar** deals/contactos/tareas (`canWriteTenantData = superadmin | tenant_admin | sales`, `firestore.rules:45-47`). `viewer` solo lee; `finance` aprueba. Para que un comercial además configure el pipeline, ese usuario tiene que ser `tenant_admin`.

**c) ¿Límites por plan que os afecten?** ✅ (buena noticia)
**Hoy los límites de plan NO se aplican.** Existen como **metadato** de la suscripción (`saas-admin.ts:264` lee `limits.deals` solo para mostrarlo en la consola), pero **ningún camino de escritura los verifica**: no hay gate por número de usuarios ni de deals ni de contactos en functions ni en `crm.ts`. Los valores que veis en la consola (Starter 5/1000/250, Growth 20/20000/6000, etc.) son **informativos**. Para vuestro volumen pequeño no hay ningún tope que os frene. *(Si en el futuro cableáramos enforcement, os avisaríamos con antelación; hoy no existe.)*

**d) ¿Cómo identificáis a un usuario? (forma de `salesReps.crmRef`)** ✅
El identificador es el **`uid` de Firebase Auth** (string ~28 chars), generado por `createTenantUser` (`getAuth().createUser(...)`, `index.ts`). Ese mismo `uid` es lo que se guarda en:
- `deal.responsibleId` (asesor responsable),
- `createdBy` / `updatedBy` (auditoría),
- los docs `users/{uid}` y `tenants/{tenantId}/users/{uid}`.

Guardad ese `uid` en `salesReps.crmRef`. Si queréis simetría con el formato de deals, podéis envolverlo como `albert:user:{uid}`, pero **el valor que resuelve es el `uid` crudo**.

**e) ¿Dónde vive la config del pipeline y quién la cambia?** ✅
Respondido en A4: `tenants/{tenantId}/config/pipeline`, editable por `superAdmin`/`tenant_admin` (`firestore.rules:53-55`).

---

## Bloque B · Datos personales (mantiene G3 abajo)

Reconocemos que esto es lo único que os mantiene una puerta cerrada, y que nuestra v2 no lo tocó. Aquí va en serio.

### B1 · ¿Qué mecanismo de supresión ofrece Albert?

**Veredicto: hoy NO existe supresión adecuada; hay borrado crudo parcial. Lo construimos — así lo haríamos.** 🔧⚖️

**Qué existe hoy (y por qué no basta):**
- Se puede **hard-delete** de un deal con `deleteDoc(tenants/{tenantId}/deals/{dealId})` (`crm.ts:815`), permitido a `canWriteTenantData` (superadmin/tenant_admin/sales).
- Pero es un borrado **sin cascada**: **no** toca el `timeline` del tenant (`tenants/{tenantId}/timeline`, historial de transiciones, `crm.ts:717`), **no** toca aprobaciones (`/approvals`), **no** toca el contacto (`/contacts/{contactId}`, que es donde viven nombre/correo/teléfono de la persona).
- **No hay anonimización**, **no hay borrado por `vivaruLeadId` ni por `dealId` vía callable**, y **no hay purga** de subcolecciones.

En términos de Ley 1581 / LFPDPPP: borrar el deal **no** borra el dato personal (vive en el contacto y en el timeline). Por eso, como decís, **el tratamiento no es reversible hoy**.

**Así lo haríamos (callable de supresión):**

```ts
// callable autenticada, ejecutable por tenant_admin de vivaru o superadmin
eraseByExternalRef({ tenantId, vivaruLeadId })  // o { tenantId, dealId }
```

que en una transacción/batch:
1. localiza el deal por `externalRef.leadId` (índice de A1) o por `dealId`;
2. **borra o anonimiza el contacto** vinculado (`contactId`) — según lo que decidáis en el punto siguiente;
3. **purga el timeline** del deal (`entityId === dealId`) y sus aprobaciones;
4. borra el deal;
5. deja un **registro de auditoría de la supresión** (sin PII: solo `vivaruLeadId`, `dealId`, `at`, actor) para poder **demostrar que se ejerció el derecho** — esto es lo que os pide la ley, no lo contrario.

**Decisión que necesitamos de vosotros (⚖️) — el histórico de transiciones:** ¿lo queréis **borrado**, **anonimizado** (se conserva la secuencia de etapas y fechas, sin datos de la persona) o **conservado**? Recomendación: **anonimizar** el timeline (mantiene la métrica agregada de RevOps: cuánto tardó, por qué se perdió) y **borrar** el contacto (que es el dato personal). Así se satisface la supresión sin perder el aprendizaje comercial. Confirmadnos la política y la implementamos.

### B2 · ¿Dónde guardamos el consentimiento que viaja con el lead?

**Veredicto: depende de A1, y la respuesta es el bloque `consent` que ya propusimos.** 🔧

Tenéis razón: sin campos propios no hay dónde ponerlo, y meterlo en `notes` sería indefendible. La solución es el sub-objeto `consent` del A1:

```
consent: { policyVersion: "1.4", acceptedAt: "2026-08-19T14:03:00Z" }
```

- `policyVersion` = qué versión de vuestra política aceptó.
- `acceptedAt` = fecha **puesta por vuestro servidor** (no confiamos en reloj de cliente), en ISO datetime.

Queda **junto al deal**, viaja con él, y sobrevive a las ediciones porque es un campo tipado, no texto. Con eso, un deal en Albert **siempre** puede demostrar bajo qué consentimiento entró. Si preferís que el consentimiento cuelgue del **contacto** en vez del deal (porque el titular es la persona, no la oportunidad), también podemos ponerlo en `contactSchema` — decidilo; nuestra recomendación es **en el contacto**, porque es la entidad-persona y sobrevive aunque el deal se recree.

### B3 · ¿Tenéis política de retención?

**Veredicto: NO existe hoy. La decidimos juntos.** 🔧⚖️

Confirmado: **no hay retención ni TTL** en Firestore para leads ni para deals. Un lead o deal que nunca prospera **vive indefinidamente**. No es un reproche mutuo —vosotros tampoco la tenéis— y coincidimos en que conviene decidirla **a la vez en los dos lados** para que no queden datos personales huérfanos en ninguno.

**Así lo propondríamos:** una política escrita (p. ej. «lead/deal sin actividad > N meses → anonimización automática») implementada con una **función programada** (Cloud Scheduler + callable) que reutilice la lógica de supresión de B1. Pequeña, y encaja con vuestro «decidir juntos». Necesitamos de vosotros el **N** y el criterio de «sin actividad» (last `updatedAt`/`lastActivityAt`).

---

## Bloque C · Confirmaciones

### C1 · ¿Podemos leer nuestros propios deals en tiempo real con los claims del tenant?

**Veredicto: SÍ, sin nada que os lo impida. El trigger queda fuera del camino crítico.** ✅

`firestore.rules:75-77`: `match /deals/{docId} { allow read: if canReadTenant(tenantId); }`, y `canReadTenant` incluye a todos los roles del tenant (`superadmin | tenant_admin | sales | viewer | finance`, `firestore.rules:41-43`). Un usuario de `vivaru` con claims válidos puede **suscribirse en vivo** (`onSnapshot`) a `tenants/vivaru/deals` y leer todo su pipeline en tiempo real. No hace falta el trigger para leer. Si más adelante quisierais *empujar* la conversión a un sistema externo, el código del trigger `onDealWon` que os dimos sigue en pie; hoy no lo necesitáis.

### C2 · ¿Sigue haciendo falta OIDC si somos tenant? ¿Qué identidad en `createdBy`/`updatedBy`?

**Veredicto: NO hace falta OIDC. Escribís como usuario del tenant. La identidad la ponéis vosotros.** ✅⚖️

Confirmado: siendo tenant, reutilizáis los **guards de rol + App Check** existentes; no hay que montar el intercambio OIDC. Escribís autenticados como un **usuario `sales` (o un usuario de servicio con rol `sales`/`tenant_admin`) del tenant `vivaru`**, y las reglas os dejan crear/editar deals (`canWriteTenantData`).

Sobre `createdBy`/`updatedBy` (recordad que son **obligatorios**, `audit.ts:5,7`, no pueden ir vacíos): se estampa el **`uid` del usuario con el que escribís**. Si creáis un **usuario de servicio dedicado** para las escrituras automáticas de Vivaru (recomendado, para distinguir lo automático de lo que teclea un humano), su `uid` es lo que quedará en la auditoría. Nuestra propuesta `system:vivaru` de la v2 aplica si escribís vía una **Cloud Function con Admin SDK** (que hace bypass de reglas y puede estampar una cadena arbitraria); si escribís como usuario real del tenant, quedará su `uid`. **Elegid** cuál de los dos caminos:
- **Usuario de servicio del tenant** (SDK cliente, con claims) → `createdBy = uid` de ese usuario. Más simple, respeta reglas.
- **Cloud Function intermedia** (Admin SDK) → `createdBy = "system:vivaru"`. Más control, un componente más que mantener.

Recomendación para vuestro volumen pequeño: **usuario de servicio del tenant**. Menos piezas.

### C3 · ¿Vais a cerrar `allow create: if true` en `/leads`?

**Veredicto: SÍ, lo cerramos. Y confirmamos que ya no os afecta.** ✅

`firestore.rules:150-152` sigue con `allow create: if true` para la landing anónima de Albert. **Lo vamos a endurecer** (canalizando la landing por Cloud Function con App Check/reCAPTCHA), tal como escribimos en la v2. Como con la bisagra en tenant **vosotros escribís deals, no leads**, ese cambio **no os toca**. Gracias por destaparlo: es un ingreso abierto de nuestra landing, y es nuestro problema resolverlo, no vuestro.

---

## Bloque D · Alineación sin prisa

### D1 · Las tres carencias compartidas

**Veredicto: confirmamos las tres; ninguna está construida; sobre roadmap, honestidad.** ✅⚖️

| Capacidad | Estado en Albert (verificado) |
|---|---|
| **Agenda de demos** | **No existe.** La landing agenda con un **formulario** (`submitDemoLead` → `/leads`), no con calendario. No hay motor de disponibilidad ni booking. |
| **Motor de mensajería (consentimiento/supresión/frecuencia)** | **No existe.** Solo hay **plantillas con merge fields** (`/templates`, `TemplatePicker`) que renderizan texto; no hay envío, ni control de frecuencia, ni gestión de opt-out. |
| **Precio de plan** | **No cableado.** Los planes tienen límites (informativos, ver A5c) pero **no llevan precio** ni hay billing conectado. |

Coincidimos en que son **prerrequisito del circuito comercial de ambos** y en que construirlas una vez y compartirlas es mejor que duplicarlas. **⚖️ No están hoy en un roadmap comprometido de Albert**; nos parecen candidatas naturales a componente compartido (sobre todo el motor de mensajería con consentimiento, que además conecta con el bloque B). Lo llevamos a priorización de producto; si alguna sale «no la haremos», os lo diremos claro para que no la escribáis esperándonos.

### D2 · Holgura / tiempos

⚖️ Esto es una respuesta de **planificación, no de código**, así que no la fijamos aquí como un hecho: depende de la priorización de producto de Albert. Lo que sí podemos acotar por tamaño técnico, para que planifiquéis:

- **A1 (campos de extensión en el deal)** — pequeño: es una extensión aditiva y opcional del esquema + un índice. Días, no semanas.
- **B1 (callable de supresión con cascada/anonimización)** — mediano: transacción sobre deal + contacto + timeline + aprobaciones + auditoría. La pieza más grande del lote.
- **B3 (retención programada)** — pequeño una vez existe B1 (reutiliza su lógica).
- **A5 (alta del tenant `vivaru` y usuarios)** — trivial: existe hoy, es operación, no desarrollo.

Con eso podéis decidir qué hace Vivaru mientras tanto. La fecha comprometida os la da producto, no este documento.

---

## Resumen — un renglón por pregunta

| # | Pregunta | Veredicto |
|---|---|---|
| **A1** | Campos propios en el deal | 🔧 No hoy → **añadimos `externalRef` + `estimatedUnits` + `country` + `consent`** (tipados, opcionales). Os desbloquea. |
| **A2** | `amount: 0` y forecast | ✅ No ensucia (forecast pondera por etapa). Convención: cifra al calificar. |
| **A3** | deal sin `contactId` | ✅ Resuelta — es opcional. |
| **A4** | pipeline por tenant / «en prueba» | ✅ A salvo — solo `tenant_admin`/`superadmin` edita; Albert no reescribe stages. |
| **A5** | alta de tenant/usuarios/límites/identidad | ✅ Tenant lo crea superadmin; comercial = `sales`; **límites NO se aplican**; identidad = `uid` de Auth. |
| **B1** | supresión | 🔧 No hoy (solo hard-delete parcial) → **callable `eraseByExternalRef` con cascada/anonimización**. ⚖️ Decidid: histórico borrado/anonimizado/conservado. |
| **B2** | consentimiento | 🔧 Depende de A1 → sub-objeto `consent` (recomendado, en el contacto). |
| **B3** | retención | 🔧 No existe → la decidimos juntos (N + criterio); función programada. |
| **C1** | lectura en vivo de deals | ✅ Sí, sin impedimento. Trigger opcional. |
| **C2** | OIDC / identidad de escritura | ✅ Sin OIDC; escribís como usuario del tenant; `createdBy = uid` (usuario de servicio recomendado). |
| **C3** | cerrar `/leads` público | ✅ Sí lo cerramos; no os afecta. |
| **D1** | carencias compartidas | ✅ Confirmadas, ninguna construida; ⚖️ a priorización. |
| **D2** | tiempos | ⚖️ De producto; tamaños técnicos acotados arriba. |

**Orden de ataque que proponemos, alineado con vuestra urgencia:** A1 primero (os deja empezar) → B1 (para poder mover datos personales) → A2/A5 en paralelo → C/D después.

---

*Albert CRM — respuesta a CONSULTA-A-001 · afirmaciones citadas al código del repo `albertcrm` · los puntos marcados ⚖️ requieren una decisión de producto antes de cablear.*
