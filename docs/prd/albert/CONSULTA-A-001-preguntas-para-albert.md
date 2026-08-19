# CONSULTA-A-001 — Qué necesita Vivaru de Albert para empezar a construir

> **En una frase:** Vivaru va a ser un **tenant de Albert** y va a empujar ahí sus
> oportunidades comerciales. Este documento es lo que todavía no sabemos y **sin lo
> cual no se puede escribir el código**: cinco cosas técnicas, y tres que hay que
> decidir antes de mover datos personales de una persona real.

| | |
|---|---|
| **De** | David (Vivaru / Qintilab) |
| **Para** | Equipo de Albert CRM |
| **Versión** | 0.2 — 19 de agosto de 2026 (la 0.1 es del 18) |
| **Contexto** | `docs/prd/albert/PRD-A-OPS-001-vista-de-leads-vivaru.md` |
| **Responde a** | Vuestro *Análisis detallado* del 19 de agosto, que amplía la ficha del 18 |

---

## Lo primero: vuestra v2 resolvió dos preguntas, y una nos hizo corregirnos

Gracias por el nivel de detalle — citar archivo y línea nos ahorró tener que suponer.
**Dos de las cinco preguntas del bloque A quedan cerradas con lo que mandasteis**, y las
marcamos abajo para que no gastéis tiempo en ellas.

Una merece una corrección nuestra, en voz alta:

> En la 0.1 escribimos que **toda** nuestra decisión de ser tenant dependía de que
> `wonDealStage` fuera configurable por tenant. **Eso estaba mal planteado.** Vuestro
> código muestra que las etapas sí se configuran por tenant, pero que
> `ensureRequiredStages` reinyecta «Ganado» y «Perdido» siempre. La decisión **no se
> cae**: solo significa que nuestros terminales se llamarán como los vuestros.
>
> **Lo aceptamos y no hace falta que cambiéis nada.** Nuestro pipeline será
> `nuevo · contactado · calificado · en prueba · Ganado · Perdido`, y «convertido» pasa a
> ser un **mapeo** en nuestro lado, no un nombre de etapa en el vuestro.

Adoptamos también, sin discusión, dos cosas vuestras: el formato de `crmRef`
(`albert:deal:{tenantId}:{dealId}`, con `tenantId` obligatorio para deals) y la
**normalización del correo a minúsculas** en cualquier cruce.

---

## Lo que ya está decidido de nuestro lado

1. **Vivaru será un tenant de Albert** (`tenants/vivaru/…`). Los comerciales trabajan
   ahí; Vivaru sigue siendo dueño del producto —conjunto, prueba, activación, atribución,
   consentimiento— y Albert del pipeline comercial.
2. **«Convertido» se detecta en el pipeline de deals**, no en la colección `leads`.
3. **Volumen real, para que dimensionéis:** una persona prospectando y un acercamiento.
   Cero clientes firmados. **Esto es pequeño**, y preferimos que se construya pequeño.

---

## Bloque A · Bloquean la implementación

### A1 · ¿Se pueden añadir campos propios a un `deal`? — **es la que más bloquea**

Cada lead que Vivaru empuje tiene que llevar su `vivaruLeadId`, el identificador del lead
en nuestro lado. **Es la llave del cruce en los dos sentidos**: sin ella, nuestra
referencia apunta a un deal pero el deal no sabe de dónde vino.

Vuestra v2 nos dejó ver que `dealSchema` es un Zod **cerrado**, con lista fija de campos y
sin mapa de extensión. Los únicos huecos de texto libre son `notes` (800) y
`productOrService` (120), y **ninguno sirve**: son campos para humanos, y meter ahí un
identificador de máquina se rompe el primer día que alguien edite la nota.

- ¿Confirmáis que **hoy no hay** campos personalizados por tenant?
- Si es así, ¿podéis **añadir un campo** para referencias externas? Nos vale lo más
  simple: un `externalRefs` de tipo mapa, o incluso un único `externalId` string.
- Mismo caso, menos crítico, para **unidades estimadas** y **país** — los necesitamos para
  calificar, porque nuestro precio se tarifa por unidad y por país.

**Mientras esto no exista, no podemos empezar.** Es lo único del bloque A que nos deja
completamente parados.

### A2 · `amount` es obligatorio y admite `0`. ¿Un `0` os ensucia el forecast?

Una oportunidad recién entrada por el landing **no tiene cifra todavía**: sabremos las
unidades cuando se califique. Si un deal con `amount: 0` distorsiona vuestros informes,
preferimos saberlo y acordar otra cosa —crearlo más tarde, o con un estimado marcado como
tal— antes que ensuciaros los números.

### ~~A3 · ¿Puede nacer un deal sin `contactId`?~~ — **RESUELTA**

Vuestra v2 lo confirma: `contactId` es opcional en el esquema. Nos sirve tal cual.

### ~~A4 · ¿`wonDealStage` es por tenant?~~ — **RESUELTA**, ver la corrección de arriba

Queda una cosa menor, que en realidad pertenece a A5: **dónde se configura el pipeline de
un tenant y quién puede tocarlo.** Nos importa porque «en prueba» es una etapa nuestra y
necesitamos saber que no la borra un cambio de vuestro lado.

### A5 · Alta del tenant `vivaru` y de sus usuarios

- ¿Cómo se crea un tenant en Albert y **quién lo hace**?
- ¿Qué roles existen dentro de un tenant, y cuál corresponde a «comercial que trabaja sus
  oportunidades»?
- ¿Hay **límites por plan** que nos afecten (número de usuarios, de deals)? Vuestra v2
  menciona que los datos del tenant quedan bajo los límites del plan, pero no cuáles son.
- ¿Cómo identificáis a un usuario? Guardamos vuestra referencia en nuestro catálogo de
  comerciales (`salesReps.crmRef`) y necesitamos saber **qué forma tiene**.
- ¿Dónde vive la configuración del pipeline del tenant y quién puede cambiarla?

---

## Bloque B · Bloquean una puerta del PRD — datos personales

**Esto es lo único que mantiene una puerta abajo (G3) en nuestro PRD, y vuestra v2 no lo
toca.** No es una formalidad: lo que empujaremos son **datos personales de un prospecto**
—nombre, correo, teléfono— recogidos bajo un consentimiento que Vivaru pide de forma
expresa, con la política de privacidad que declara cumplimiento de la **Ley 1581 de 2012**
(Colombia) y la **LFPDPPP** (México).

### B1 · ¿Qué mecanismo de supresión ofrece Albert?

Si un titular ejerce su derecho de supresión, Vivaru puede borrar su mitad. **La copia que
viva en Albert no la alcanza ese borrado.**

- ¿Aceptáis una **orden de borrado** desde Vivaru, por `vivaruLeadId` o por `dealId`?
- ¿Qué pasa con el histórico de transiciones del deal — se borra, se anonimiza, se
  conserva?

Mientras esto no exista, un tratamiento de datos personales **no se puede revertir**, y
así lo tenemos escrito.

### B2 · ¿Dónde guardamos el consentimiento que viaja con el lead?

Cada lead empujado lleva **qué versión de la política aceptó y cuándo** (fecha puesta por
nuestro servidor). Un lead en Albert sin ese dato es un lead que nadie puede demostrar que
autorizó. **Depende de A1:** si no hay campos propios, no hay dónde ponerlo.

### B3 · ¿Tenéis política de retención?

¿Cuánto vive un lead o un deal que nunca prospera? Nosotros tampoco la tenemos todavía
—lo tenemos anotado como brecha— así que si no existe, no es un reproche: es algo que
conviene decidir a la vez en los dos lados.

---

## Bloque C · Confirmaciones — y vuestra v2 hizo dos de ellas más fáciles

### C1 · El disparador de vuelta: **ya no urge, y lo decís vosotros**

Vuestra v2 apunta que si Vivaru es un tenant, el trigger es **opcional**: podemos
suscribirnos a `tenants/vivaru/deals` con nuestros propios claims. **Nos vale, y eso lo
saca del camino crítico.**

Solo queremos confirmar que **no hay nada que nos impida leer nuestros propios deals en
tiempo real** con los claims del tenant. Si más adelante hiciera falta el trigger, ya nos
disteis el código; no lo pedimos ahora.

### C2 · OIDC: ¿sigue haciendo falta si somos tenant?

Vuestra propia tabla dice que la opción tenant **simplifica esto y no requiere OIDC**,
porque reutiliza los guards de rol y App Check existentes.

- ¿Lo confirmáis? ¿Escribimos como un usuario del tenant con sus claims?
- Si es así, ¿qué identidad estampáis en `createdBy`/`updatedBy` para nuestras escrituras?
  Vuestra v2 propone `system:vivaru` — nos parece bien si a vosotros os sirve.
- Si aun así preferís OIDC, entonces sí necesitamos: **qué audiencia** (`aud`), **qué
  cuenta de servicio** autorizáis y dónde os la damos, y **qué endpoint** la recibe.

### C3 · ¿Vais a cerrar `allow create: if true` en `/leads`?

Vuestra v2 ya lo recomienda por escrito, así que esto es solo confirmar que va a pasar.
Es vuestro, no nuestro, y **Vivaru dejará de usar esa colección** —con la bisagra en
tenant, escribimos deals—. Lo mencionamos porque lo destapamos al revisar: ese ingreso
sigue abierto para vuestra propia landing.

---

## Bloque D · Sin prisa, pero conviene alinearlo

### D1 · Las tres carencias que ninguno de los dos tiene

Salieron de cruzar los dos inventarios y **no estaban en el roadmap de ninguno**:

| Capacidad | Albert | Vivaru |
|---|---|---|
| Agenda de demos | No — su landing agenda con formulario | No |
| Motor de mensajería con consentimiento, supresión y frecuencia | No — solo plantillas con merge fields | No |
| Precio de plan | Planes con límites, **sin precio** | Decidido fuera del producto, **no cableado** |

Son prerrequisito del circuito comercial de **los dos productos**. ¿Las veis en vuestro
roadmap? Construirlas una vez y compartirlas parece mejor que duplicarlas.

### D2 · ¿Con qué holgura contáis?

No para comprometeros a una fecha, sino porque **vuestros tiempos son nuestra dependencia
de planificación** y preferimos escribirlo que suponerlo. Si la vista de Leads es cosa de
semanas o de meses, cambia lo que Vivaru hace mientras tanto.

---

## Lo que NO necesitamos preguntaros

Para que no gastéis tiempo: vuestros dos documentos ya resolvieron el modelo de datos de
`lead` y `deal`, los dos vocabularios de estado, la mecánica de `closedAt`, el formato de
`crmRef`, la normalización del correo, la recomendación de autenticación, que hoy no hay
triggers, y las preguntas **A3** y **A4** de arriba. Todo eso está incorporado y no hace
falta repetirlo.

---

## Cómo nos ayuda más la respuesta

Un «sí / no / así lo haríamos» por pregunta basta.

**El orden de urgencia, si tenéis que priorizar:**

1. **A1** — sin un sitio donde poner el `vivaruLeadId`, no empezamos. Es la única que nos
   deja parados del todo.
2. **Bloque B** — sin supresión, no movemos datos personales de una persona real.
3. **A2 y A5** — se pueden trabajar en paralelo mientras se resuelve A1.
4. **C y D** — pueden esperar.

Y si alguna respuesta es «eso no lo vamos a hacer», eso también es útil — nos ahorra
escribirlo en un PRD que nadie construirá.
