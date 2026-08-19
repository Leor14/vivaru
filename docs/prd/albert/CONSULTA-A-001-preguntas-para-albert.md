# CONSULTA-A-001 — Preguntas para el equipo de Albert

> **Una sola tanda, a propósito.** Todo lo que Vivaru necesita saber para cerrar
> `PRD-A-OPS-001` y empezar a construir. Va agrupado por **qué bloquea cada cosa**, para
> que se pueda contestar en el orden que os convenga y decir «esto no» donde haga falta.

| | |
|---|---|
| **De** | David (Vivaru / Qintilab) |
| **Para** | Equipo de Albert CRM |
| **Fecha** | 18 de agosto de 2026 |
| **Contexto** | `docs/prd/albert/PRD-A-OPS-001-vista-de-leads-vivaru.md` (0.4) |
| **Responde a** | Vuestra ficha técnica del 18 de agosto, que resolvió los cinco insumos anteriores |

---

## Lo que ya quedó decidido de nuestro lado

Para que las preguntas se lean en contexto:

1. **Vivaru será un tenant de Albert** (`tenants/vivaru/…`). Los comerciales trabajan
   ahí; Vivaru sigue siendo dueño del producto —conjunto, prueba, activación,
   atribución, consentimiento— y Albert del pipeline comercial.
2. **«Convertido» se detecta en el pipeline de deals**, no en la colección `leads` —
   siguiendo vuestra recomendación.
3. **La escritura Vivaru → Albert será OIDC Google-a-Google**, también vuestra
   recomendación.
4. **Volumen real, para que dimensionéis:** una persona prospectando y un acercamiento.
   Cero clientes firmados. **Esto es pequeño**, y preferimos que se construya pequeño.

---

## Bloque A · Bloquean la implementación

Sin estas respuestas no se puede escribir el cruce.

### A1 · ¿Se pueden añadir campos propios a un `deal`?

**Por qué bloquea:** cada lead que Vivaru empuje tiene que llevar su `vivaruLeadId`
—el identificador del lead en nuestro lado— y ese dato **no tiene casilla** en el
esquema que nos pasasteis. Es la clave del cruce en los dos sentidos: sin ella, nuestra
referencia apunta a un deal pero el deal no sabe de dónde vino.

- ¿Admite `deals` campos personalizados por tenant?
- Si no, ¿dónde lo guardamos? ¿`title`? ¿Una nota? (Preferimos **no** meterlo en un
  campo de texto libre destinado a humanos.)
- Mismo caso, menos crítico, para **unidades estimadas** y **país** — los necesitamos
  para calificar, porque nuestro precio se tarifa por unidad y por país.

### A2 · `amount` es obligatorio y admite `0`. ¿Un `0` os ensucia el forecast?

Una oportunidad recién entrada por el landing **no tiene cifra todavía**: sabremos las
unidades cuando se califique. Si un deal con `amount: 0` distorsiona vuestros informes,
preferimos saberlo y acordar otra cosa —crearlo más tarde, o con un estimado marcado
como tal— antes que ensuciaros los números.

### A3 · ¿Puede nacer un deal sin `contactId`?

Figura como opcional en el esquema. Solo queremos confirmarlo, porque en nuestro flujo
el deal se crea **al asignarle dueño al lead**, y en ese momento puede que todavía no
exista un contacto formal.

### A4 · `wonDealStage` / `lostDealStage`: ¿dónde se configuran y son por tenant?

**Es la pregunta más importante de todas**, porque **toda nuestra decisión de ser tenant
descansa en ella.** Elegimos ser tenant precisamente porque vuestro `stage` es texto
configurable, lo que nos permite usar el vocabulario de Vivaru **sin que vosotros
cambiéis código**. Si esa configuración resultara ser global y no por tenant, la
decisión habría que revisarla.

- ¿`wonDealStage` y `lostDealStage` se definen **por tenant**?
- ¿Dónde viven —documento de configuración, variable, código— y **quién puede
  cambiarlos**?
- ¿Existe también el **orden** de las etapas, o solo los dos terminales?

Nuestro vocabulario sería: `nuevo · contactado · calificado · en prueba · convertido ·
perdido`, con `convertido` como terminal-ganado y `perdido` como terminal-perdido.

> La etapa **«en prueba»** es específica de Vivaru: nuestro producto tiene una prueba de
> 15 días con una activación que ya calculamos (7 pasos). Es la única etapa del pipeline
> que no depende de la opinión del comercial.

### A5 · Alta del tenant `vivaru` y de sus usuarios

- ¿Cómo se crea un tenant en Albert y **quién lo hace**?
- ¿Qué roles existen dentro de un tenant, y cuál corresponde a «comercial que trabaja
  sus oportunidades»?
- ¿Hay **límites por plan** que nos afecten (número de usuarios, de deals)? Vuestros
  planes tienen límites y no queremos chocar con uno a mitad de camino.
- ¿Cómo identificáis a un usuario? Guardamos vuestra referencia en nuestro catálogo de
  comerciales (`salesReps.crmRef`) y necesitamos saber **qué forma tiene**.

---

## Bloque B · Bloquean una puerta del PRD — datos personales

**Esto es lo único que mantiene una puerta abajo (G3) en nuestro PRD**, y no es una
formalidad: lo que empujaremos son **datos personales de un prospecto** —nombre, correo,
teléfono— recogidos bajo un consentimiento que Vivaru pide de forma expresa, con la
política de privacidad que declara cumplimiento de la **Ley 1581 de 2012** (Colombia) y
la **LFPDPPP** (México).

### B1 · ¿Qué mecanismo de supresión ofrece Albert?

Si un titular ejerce su derecho de supresión, Vivaru puede borrar su mitad. **La copia
que viva en Albert no la alcanza ese borrado.**

- ¿Aceptáis una **orden de borrado** desde Vivaru, por `vivaruLeadId` o por `dealId`?
- ¿Qué pasa con el histórico de transiciones del deal — se borra, se anonimiza, se
  conserva?

Mientras esto no exista, un tratamiento de datos personales **no se puede revertir**, y
así lo tenemos escrito.

### B2 · ¿Dónde guardamos el consentimiento que viaja con el lead?

Cada lead empujado lleva **qué versión de la política aceptó y cuándo** (fecha puesta por
nuestro servidor). Un lead en Albert sin ese dato es un lead que nadie puede demostrar
que autorizó. Depende de A1: si no hay campos propios, hay que decidir dónde va.

### B3 · ¿Tenéis política de retención?

¿Cuánto vive un lead o un deal que nunca prospera? Nosotros tampoco la tenemos todavía
—lo tenemos anotado como brecha— así que si no existe, no es un reproche: es algo que
conviene decidir a la vez en los dos lados.

---

## Bloque C · Confirmaciones que cambian el plan si la respuesta es «no»

### C1 · El disparador de vuelta: ¿lo asumís?

Vuestra ficha dice que hoy **no hay ni un trigger** en `functions/src`, pero que es
viable y barato. Lo que Vivaru necesita, cuando un deal llega a terminal-ganado:

```
onDocumentUpdated("tenants/{tenantId}/deals/{dealId}")
  → si transita a terminal-ganado (contra la config del tenant, NO contra el literal)
  → llamar callable de Vivaru con:
       { vivaruLeadId?, tenantId, dealId, amount, contactId, closedAt }
```

**No entra en el PRD actual** —es el siguiente— pero saber si lo asumís y con qué
holgura **cambia nuestro orden**: mientras no exista, un superadmin de Vivaru tiene que
anotar la referencia a mano, y eso es operación diaria.

### C2 · OIDC: ¿qué esperáis exactamente?

Adoptamos vuestra recomendación. Para implementarlo necesitamos:

- **Qué audiencia** (`aud`) debe llevar el token.
- **Qué cuenta de servicio** de Vivaru autorizáis, y dónde os la damos.
- **Qué endpoint** recibe la escritura autenticada: ¿uno nuevo, o `submitDemoLead`
  endurecido con un `source`?

### C3 · ¿Vais a cerrar `allow create: if true` en `/leads`?

Es vuestro, no nuestro, y **Vivaru dejará de usar esa colección** —con la bisagra en
tenant, escribimos deals—. Lo mencionamos porque lo destapamos al revisar: ese ingreso
sigue abierto para vuestra propia landing, y conviene separar el camino público del
autenticado. Si decidís dejarlo como está, no nos afecta; solo queremos que sea una
decisión y no un descuido.

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

Para que no gastéis tiempo: vuestra ficha ya resolvió el modelo de datos de `lead` y
`deal`, los dos vocabularios de estado, la recomendación de autenticación, y que hoy no
hay triggers. Todo eso está incorporado al PRD y no hace falta repetirlo.

---

## Cómo nos ayuda más la respuesta

Un «sí / no / así lo haríamos» por pregunta basta. **Las de los bloques A y B son las
que bloquean**; C y D pueden esperar. Y si alguna respuesta es «eso no lo vamos a
hacer», eso también es útil — nos ahorra escribirlo en un PRD que nadie construirá.
