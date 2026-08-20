# DECISIONES-A-001 — Vivaru → Albert

> **En una frase:** cerramos las seis decisiones que vuestra `RESPUESTA-A-001` dejaba en
> nuestro tejado, para que podáis empezar por A1. Pero **antes de que cabléis nada, hay
> dos contradicciones dentro de vuestra propia respuesta** que si nadie nombra se
> construyen mal — van las primeras.

| | |
|---|---|
| **De** | David (Vivaru / Qintilab) |
| **Para** | Equipo de Albert CRM |
| **Versión** | 0.1 — 19 de agosto de 2026 |
| **Responde a** | `RESPUESTA-A-001` (19 de agosto de 2026) |
| **Contexto** | `docs/prd/albert/PRD-A-OPS-001-vista-de-leads-vivaru.md` · `CONSULTA-A-001` v0.2 |

Gracias por el nivel de la respuesta: citar `archivo:línea` y separar hecho de código
de decisión de producto nos ahorró una ronda entera. Y gracias por confirmar A1
diagnosticando lo mismo que nosotros en vez de buscarle la vuelta.

---

## Antes de las decisiones: dos contradicciones de vuestra respuesta

No son reproches — son dos sitios donde vuestro propio documento se dice cosas
distintas, y cualquiera de las dos lecturas es cableable. Preferimos nombrarlas ahora
que descubrirlas después.

### 1 · El consentimiento aparece en dos sitios a la vez

El bloque de código de **A1** mete `consent` dentro de `dealSchema`. Pero **B2**
recomienda ponerlo **en el contacto**, «porque es la entidad-persona y sobrevive aunque
el deal se recree».

Son dos ubicaciones distintas y hay que elegir una. **Elegimos la vuestra de B2 —el
contacto—** y os pedimos que, en consecuencia, **`consent` NO vaya en `dealSchema`**. Si
va en los dos, hay dos fuentes de verdad para el mismo hecho jurídico y en algún momento
discreparán.

### 2 · Y si va en el contacto, hay deals que no pueden guardarlo

Vuestro **A3** confirma que `contactId` es `optionalIdSchema` y que **un deal nace sin
contacto**. Junto con la recomendación de B2, eso produce un hueco: **un lead que llega
con consentimiento y crea un deal sin contacto no tiene dónde guardarlo.**

**Lo cerramos por nuestro lado, no por el vuestro:** Vivaru se compromete a **crear
siempre el contacto** antes de crear el deal. No hace falta que hagáis `contactId`
obligatorio —rompería a vuestros usuarios actuales—; basta con que sepáis que por
nuestra vía nunca llegará un deal huérfano.

### 3 · Una pregunta menor, no una objeción

El registro de auditoría de la supresión (B1, punto 5) guarda `vivaruLeadId` y lo
describe como «sin PII». Mientras ese lead exista de nuestro lado, ese identificador
**reidentifica**. No decimos que esté mal —hace falta poder demostrar que se ejerció el
derecho—, pero conviene que la política escrita diga por qué se conserva y cuánto, en
vez de afirmar que no es dato personal.

---

## Las seis decisiones

### A1 · Bloque tipado — **sí, el vuestro**

**Aceptamos el bloque tipado** (`externalRef` + `estimatedUnits` + `country`), no el
mapa genérico. Vuestro argumento nos vale: para una llave de cruce y dos campos de
calificación, un `Record<string,string>` pierde validación y ensucia el reporting.

Con dos precisiones:

- **`consent` sale de este bloque** y se va al contacto (contradicción 1).
- **Sí queremos el índice** sobre `externalRef.leadId`. Vamos a buscar deals por
  `vivaruLeadId` —es como resolvemos «este lead ya está en el CRM»— y sin índice esa
  consulta no escala ni con volumen pequeño.

`country` en ISO-3166-1 alpha-2 nos sirve tal cual.

### A2 · `amount: 0` — **convención, sin campo nuevo**

**No hace falta un `is_estimate`.** Creamos el deal con `amount: 0` al entrar y ponemos
la cifra al calificar, que es cuando conocemos las unidades. `estimatedUnits` ya hace de
señal de «esto todavía no es una cifra en firme».

Nos vale vuestra explicación de por qué un `0` no ensucia el forecast: pondera por etapa
y el ingreso ganado se calcula solo sobre `Ganado`. El efecto en el ticket promedio de
deals abiertos lo asumimos.

### B1 · Supresión — **anonimizar el histórico, borrar el contacto**

**Aceptamos vuestra recomendación tal cual:** anonimizar el timeline —conserva la
secuencia de etapas y fechas, que es lo que da la métrica de RevOps— y **borrar el
contacto**, que es donde vive el dato personal.

Dos peticiones sobre la callable:

- Que acepte **las dos llaves**, `{ tenantId, vivaruLeadId }` y `{ tenantId, dealId }`.
  La primera es la que usaremos nosotros; la segunda hace falta para operar a mano
  cuando el cruce se haya roto.
- Que la anonimización del timeline **alcance también el texto libre**. `notes` (800
  chars) y `productOrService` los teclea un humano y ahí acaba habiendo nombres y
  teléfonos. Si el deal se borra entero, resuelto; si algo de ese texto sobrevive
  copiado en el timeline, no.

### B2 · Consentimiento — **en el contacto**

Ver la contradicción 1. **En el contacto**, con vuestra forma:

```
consent: { policyVersion: "1.4", acceptedAt: "2026-08-19T14:03:00Z" }
```

`acceptedAt` lo pone **nuestro** servidor, nunca el reloj del cliente. Y Vivaru crea
siempre contacto, así que siempre hay dónde ponerlo.

### B3 · Retención — **el criterio sí; el número, todavía no**

**Criterio, decidido:** «sin actividad» se mide por el **`updatedAt` del deal**, no por
la fecha de creación ni por la última tarea. Es el campo que ya mantenéis y el que menos
se presta a interpretación.

**La N no la cerramos hoy, y preferimos decirlo a inventarla.** Vivaru tampoco tiene
política de retención escrita, y fijar aquí un número que luego contradiga la nuestra
sería peor que esperar una semana. **Nuestra propuesta de partida es 24 meses sin
actividad → anonimización automática**, sujeta a que cerremos nuestra propia política.

Para que podáis dimensionar sin esperarnos: la forma es la que proponéis —función
programada que reutiliza la lógica de B1—, y **la N es un parámetro, no una decisión de
diseño**. Construidla parametrizable y el número llega después.

### C2 · Identidad de escritura — **usuario de servicio del tenant**

**Usuario de servicio del tenant**, como recomendáis. Menos piezas, respeta las reglas, y
para nuestro volumen la Cloud Function intermedia es maquinaria que habría que mantener.

Una condición, que es de auditoría y no de arquitectura: **que el usuario se llame de
forma obviamente no humana**. Todo lo que escriba Vivaru va a quedar con ese `uid` en
`createdBy`/`updatedBy`, y dentro de seis meses alguien va a leer esa auditoría. Proponemos
`integracion-vivaru` como nombre visible; el correo y el `uid` los fijamos con el alta de
A5.

### D1 · Las tres carencias compartidas — **decisión, no espera**

Lo que más agradecemos de vuestra respuesta es la frase «si alguna sale *no la haremos*,
os lo diremos claro para que no la escribáis esperándonos». Con eso deja de ser una
espera y pasa a ser una decisión nuestra. La tomamos así:

| Capacidad | Qué hacemos |
|---|---|
| **Precio de plan** | **Lo cableamos nosotros y no os esperamos.** Ya está decidido en nuestra guía maestra y es el siguiente incremento de nuestro roadmap. Si más adelante conviene compartir el modelo, se comparte; hoy no bloquea |
| **Motor de mensajería** con consentimiento, supresión y frecuencia | **Es la única que de verdad pedimos como componente compartido.** Conecta con todo el bloque B: sin control de opt-out y frecuencia, el consentimiento que acabamos de diseñar no tiene quien lo respete en el envío. Nos interesa saber si entra en vuestra priorización |
| **Agenda de demos** | **No la pedimos.** Con una persona prospectando y cero clientes firmados, un motor de disponibilidad es infraestructura para una demanda que no existe. Un formulario aguanta |

---

## Lo que os damos para A5

- **`tenantId`:** `vivaru`
- **Nombre del tenant:** Vivaru
- **Rol de nuestros comerciales:** `sales`
- **`tenant_admin`:** nuestro, para que «en prueba» no dependa de nadie más — el correo
  de la persona os lo pasamos por el canal que prefiráis, no en este documento

Y confirmamos que hemos leído lo de A5c: **los límites de plan no se aplican**. Nos
corrige un supuesto que teníamos; gracias por decirlo en vez de dejarnos suponer.

---

## Lo único que os pedimos de vuelta

**Una fecha para A1, no un tamaño.** Entendemos que D2 es de producto y no de código, y
que «días, no semanas» es una estimación honesta. Pero A1 es lo único que nos deja
parados del todo: mientras no exista, el `vivaruLeadId` no tiene dónde ir y no podemos
escribir la primera línea de la integración.

No necesitamos un compromiso trimestral. Necesitamos saber si hablamos de esta semana o
del mes que viene, porque **de eso depende qué hace Vivaru mientras tanto**.

---

## Resumen — un renglón por decisión

| # | Decisión | Nuestra respuesta |
|---|---|---|
| **A1** | Tipado vs. mapa genérico | **Tipado**, con índice sobre `externalRef.leadId`. Y `consent` fuera de aquí |
| **A2** | ¿Campo `is_estimate`? | **No.** Convención: `amount: 0` al entrar, cifra al calificar |
| **B1** | Histórico de transiciones | **Anonimizar** el timeline, **borrar** el contacto. Callable por las dos llaves, y que alcance el texto libre |
| **B2** | Dónde vive el consentimiento | **En el contacto** — y Vivaru crea siempre contacto, así que no hay deals huérfanos |
| **B3** | Retención | **Criterio: `updatedAt`.** La **N** no la cerramos hoy: propuesta de 24 meses, sujeta a nuestra propia política. Construidla parametrizable |
| **C2** | Identidad de escritura | **Usuario de servicio del tenant**, con nombre obviamente no humano |
| **D1** | Carencias compartidas | Precio **lo hacemos nosotros**; **mensajería** es la que pedimos compartida; agenda **no la pedimos** |

**Y lo que os pedimos:** una fecha para A1, y que `consent` no quede duplicado entre el
deal y el contacto.

---

*Vivaru — respuesta a `RESPUESTA-A-001`. Las decisiones marcadas como propuesta (la N de
B3) no son compromisos: se cierran cuando Vivaru cierre su propia política de retención.*
