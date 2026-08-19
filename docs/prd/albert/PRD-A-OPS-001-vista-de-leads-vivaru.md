# PRD-A-OPS-001 — Vista de Leads de Vivaru en Albert

> **Primera PRD de la familia Albert.** Vivaru redacta, Albert desarrolla — decisión
> de los socios del 17 de agosto de 2026: Albert es de Qintilab y **se adapta a las
> reglas de negocio de Vivaru**, no al revés. Expediente completo de la decisión en
> `docs/albert-vivaru-integracion.md` (0.5).

| Campo | Valor |
|---|---|
| **ID** | `PRD-A-OPS-001` |
| **Tipo** | `OPS` — operación comercial; el usuario es interno |
| **Superficie** | Consola de Albert (nueva vista) |
| **Portales de Vivaru** | **`SUPERADMIN`** — afectado, no alcance: la bandeja de Leads y Comerciales ya existen y se operan en paralelo. `ADMIN`, `RESIDENTE` y `PORTERIA` no se tocan |
| **Usuario principal** | Los cinco comerciales (2 KAM + 3 socios) y quien opere la consola Superadmin de Vivaru |
| **Responsable** | David (Vivaru) redacta y acepta · equipo de Albert construye |
| **Estado** | **Borrador — NO lista para desarrollo** (ver «Lo que falta», §0) |
| **Dependencias** | `REVOPS-001E` ✅ construido y **desplegado** (`6207fa7`, 18 ago) · catálogo `salesReps` ✅ **poblado con los cinco** (18 ago) · `REVOPS-000` ⏳ sin empezar · dos `TBD` de Albert y una decisión de negocio (§0) |
| **Riesgo** | **Alto** — corregido en la 0.2. El lead lleva **datos personales de un prospecto** (nombre, correo, teléfono) y su consentimiento se recoge en Vivaru bajo la Ley 1581 y la LFPDPPP. Empujarlos a otro sistema es un tratamiento, no una copia técnica |
| **Reversibilidad** | Alta para la vista; **no para los datos empujados** — ver §13, retención y supresión |

---

## 0 · Lo que falta para que esto sea desarrollable, dicho primero

Este borrador existe porque **la mitad del contrato ya está cerrada y verificada en
código** — el esquema de propiedad comercial construido en `REVOPS-001E`. La otra
mitad **no está y no se va a inventar aquí**:

1. **`REVOPS-000` sin empezar.** Los flujos reales de los cinco comerciales —cómo
   captan, qué anotan, cuándo consideran perdido— hoy viven en cinco cabezas. El §5
   (flujo funcional) queda deliberadamente en `TBD` hasta esa conversación. Redactar
   esos flujos por deducción sería especificar **el CRM que nos imaginamos** — el
   riesgo que el expediente advierte por escrito.
2. **Pregunta al equipo de Albert (expediente §6.4):** ¿la superficie de destino es la
   pestaña global de Leads sin desplegar, o los contactos del tenant? Este PRD
   **propone la vista global** (§4) porque el recorrido comercial de Vivaru es
   anterior a la existencia del tenant; queda `TBD` confirmar con Albert que esa
   pestaña es desplegable sin rehacerla.
3. **Decisión previa:** ¿Vivaru opera como un tenant de Albert? (expediente §6.3).
   Condiciona dónde viven estos datos en el modelo de Albert. `TBD` de negocio.
4. **Dónde nace el lead del canal asistido — hallazgo de la 0.2, y es estructural.**
   Ver §7.1. Este PRD asumía en su 0.1 una sola dirección: el lead nace en Vivaru y se
   empuja. **Para el canal que de verdad opera eso es imposible**, y no por falta de
   permisos sino por diseño. Hay que decidir la dirección antes de escribir el
   contrato de identidad.

**Regla de avance:** este documento pasa a «Lista para desarrollo» cuando §5 se llene
con la salida de `REVOPS-000`, las tres `TBD` de arriba tengan respuesta, y §7.1 tenga
dirección decidida. No antes.

### 0.5 · Qué hay que pedirle al equipo de Albert, en concreto

Las `TBD` de arriba son decisiones. Esto son **insumos**: sin ellos no se puede
escribir el contrato, y pedirlos no depende de `REVOPS-000`.

| Qué se pide | Por qué bloquea |
|---|---|
| Modelo de datos de `lead` y `deal`: campos, obligatorios y **formato del identificador** | Sin el formato, `crmRef` en Vivaru guarda un texto que no resuelve a nada. Hoy es un campo libre porque no sabemos qué forma tiene lo que va a contener |
| Vocabulario de estados y **quién manda** | Albert usa `new · contacted · qualified · discarded`; Vivaru añade `convertido`. §6 fija la regla, pero renombrar o mapear es decisión de Albert |
| **Cómo se autentica una escritura servidor a servidor** | Ver §12.1. Hoy la única vía que funciona es pública |
| Si la pestaña global de Leads es desplegable sin rehacerla | Es la superficie que este PRD propone (§4) |
| Si Albert puede **emitir un evento** al ganar un negocio | No hace falta una API completa: un disparador sobre `deals` que llame a una callable de Vivaru basta. Es el PRD siguiente, pero saber si es posible cambia el orden |

---

## 1 · Resumen ejecutivo

Cinco personas venden Vivaru en tres países y su recorrido comercial no se registra en
ninguna parte: la única vía de escritura hacia Albert deja los leads en una colección
**sin interfaz**, y la pestaña de Leads no está desplegada. Vivaru ya construyó su
mitad — catálogo de comerciales, dueño en el lead, vendedor en el conjunto, referencia
cruzada. Falta la superficie donde los comerciales trabajen ese recorrido: una vista
de Leads en Albert **alineada con los estados y la propiedad que Vivaru ya registra**.
El valor: que «contactado» diga quién contactó, que «convertido» exista como terminal,
y que la comisión de cada conjunto sea atribuible sin arqueología.

## 2 · Problema y baseline

- **Baseline de recorrido registrado: cero.** Verificado en el expediente (0.5): la
  entrada por autoservicio son 5 leads de prueba, y sobre el canal asistido —el que
  está dotado— no hay dato de ninguna clase, porque nada lo observa.
- **Baseline de la vía actual:** `POST` de Vivaru → colección global `/leads` de
  Albert, **sin pantalla que la muestre** [V]. Siete pestañas en consola; Leads no es
  ninguna.
- **Baseline de estados:** Albert conoce `new · contacted · qualified · discarded`.
  **No tiene `convertido`**, que es exactamente el terminal que le importa a REVOPS.
- **La métrica que dirá si funcionó** (G1): a los 30 días de desplegada la vista,
  el 100 % de los conjuntos convertidos tiene `vendedorId` y el 100 % de los leads
  trabajados tiene dueño y estado distinto de `nuevo` — medible desde Vivaru, sin
  pedirle nada a Albert.

## 3 · Usuarios, roles y permisos

Los cinco comerciales **no tienen cuenta en Vivaru y no la van a tener** — decisión
cerrada de `REVOPS-001E`: sin cuentas, sin portal, sin tocar autenticación. Sus
cuentas viven en Albert.

| Rol (en Albert) | Ve | Puede | Prohibido |
|---|---|---|---|
| Comercial | Los leads de Vivaru; como mínimo los suyos | Trabajar el lead: cambiar estado, anotar, reasignarse con acuerdo | Borrar leads; editar los campos que empuja Vivaru (origen, contacto declarado, `vivaruLeadId`) |
| Administración Albert | Todo | Reasignar dueño; corregir estados | Borrar el histórico de transiciones |
| Vivaru (sistema) | — | Empujar leads nuevos y actualizaciones de su mitad | Escribir estados de trabajo comercial (eso es de quien trabaja el lead) |

`TBD-REVOPS-000`: si un comercial ve **solo su cartera o toda** — es una regla de
operación comercial, no técnica, y se decide con los cinco delante.

## 4 · Objetivo, alcance y exclusiones

**Objetivo:** que exista en la consola de Albert una vista donde los cinco trabajen
los leads de Vivaru, con los estados de Vivaru y la propiedad de Vivaru.

**Entra:**
- La vista de Leads (global, no por tenant — propuesta §0.2) con lista, detalle,
  cambio de estado y asignación de dueño.
- El ciclo de estados de Vivaru (§6) — incluido `convertido` como terminal.
- La identidad cruzada (§7): cada lead de Albert conserva el id del lead de Vivaru,
  y cada comercial de Albert es mapeable al catálogo `salesReps` de Vivaru.

**No entra, y por qué:**
- **La señal de vuelta Albert → Vivaru** (webhooks/eventos). No existe en Albert [V]
  y es un PRD propio; mientras tanto la referencia se anota a mano en la bandeja de
  Vivaru, que ya tiene el campo (`crmRef`).
- **El soporte.** El de Vivaru se queda en Vivaru — colisión de dominio documentada
  en el expediente (§4): adoptar el de Albert crearía una tercera superficie de
  tickets.
- **Enrutado del aviso comercial por país.** Fuera del alcance acordado el 17 de
  agosto también en la mitad de Vivaru.
- **Importar los 5 leads del landing.** Son pruebas, no clientes — ya se descartó una
  vez (expediente, changelog 0.4).

## 5 · Flujo funcional — `TBD-REVOPS-000`

**Esta sección se llena con la conversación con los cinco, no antes.** Lo que debe
salir de ahí, como mínimo: cómo entra un lead que no viene del landing (¿lo teclea el
comercial? ¿quién?), qué pasa en «contactado» (¿llamada, visita, WhatsApp?), cuánto
vive un lead sin tocar antes de considerarse frío, y quién decide «perdido» y con qué
motivos. El criterio de salida de `REVOPS-000` —un recuento escrito de oportunidades
reales por país y persona— es la materia prima de esta sección.

## 6 · Estados y transiciones

El ciclo es el de Vivaru — Albert se adapta, esa es la premisa de la familia:

```
nuevo → contactado → calificado → convertido (terminal)
   ↘________↘____________↘______→ perdido (terminal, con motivo obligatorio)
```

- **Todo estado tiene dueño:** el del lead (`ownerId`). Un lead sin dueño solo puede
  estar en `nuevo`.
- **`convertido` es terminal y no lo escribe un comercial a mano:** lo produce la
  conversión en Vivaru (hoy: `createTenantFromLead` marca el lead de Vivaru; la vista
  lo refleja vía la referencia cruzada — a mano mientras no haya señal de vuelta).
- **`perdido` exige motivo** — el aprendizaje comercial del que Vivaru ya guarda
  espejo (`lostReason`).
- Correspondencia con los estados actuales de Albert (`new·contacted·qualified·
  discarded`): **decisión de implementación de Albert** (renombrar o mapear), con una
  regla no negociable: `convertido` y `perdido` no se colapsan en `discarded` — son
  terminales distintos y REVOPS los cuenta por separado.

## 7 · Contrato de datos e identidad cruzada

La mitad de Vivaru **ya existe y está verificada en código** (`11e3bae`):

| En Vivaru | Campo | Quién lo escribe |
|---|---|---|
| `leads/{leadId}` | `ownerId` · `ownerAssignedAt` | Superadmin (bandeja) |
| `leads/{leadId}` | `crmRef` — **el id del lead en Albert** | Superadmin, a mano, hasta que exista señal de vuelta |
| `salesReps/{repId}` | `crmRef` — **la identidad del comercial en Albert** | Superadmin (página Comerciales) |
| `tenants/{tenantId}` | `vendedorId` | La conversión (ambos caminos) |

### 7.1 · Dónde nace el lead — el supuesto que la 0.1 tenía al revés

**Verificado en código el 18 de agosto (`6207fa7`):** en Vivaru un lead solo puede
nacer de tres sitios, y **los tres son de autoservicio** — los dos formularios del
landing (`/api/demo`, `/api/lead`) y el alta de prueba (`trial-workspace.ts`).
`firestore.rules` dice `allow create: if false` para `leads`, y no existe ninguna
pantalla de alta manual.

**Consecuencia, y es la que importa:** el canal que de verdad opera —cinco personas
vendiendo en tres países— **produce leads que hoy no pueden existir en Vivaru**. Un KAM
no rellena un formulario web. Así que la dirección real del recorrido no es la que
suponía la 0.1:

| Origen | Dónde nace hoy | Dónde nace después de este PRD |
|---|---|---|
| Autoservicio (landing, prueba) | Vivaru | Vivaru → se empuja a Albert |
| **Canal asistido (los cinco)** | **En ninguna parte** | **Albert** — es donde el comercial trabaja |

Eso rompe el contrato tal como estaba escrito: `vivaruLeadId` no puede ser obligatorio
para un lead que nunca pasó por Vivaru.

**Decisión pendiente — tres salidas, y la recomendación es la tercera:**

1. **Vivaru gana alta manual de leads.** Contradice el alcance («en Vivaru no se
   construye nada») y duplica la bandeja donde el comercial ya trabaja. No recomendada.
2. **Todo pasa por Vivaru primero.** Obligaría al comercial a teclear en el sistema que
   no usa para que aparezca en el que sí. Es pedirle al cliente que se adapte al
   producto, justo lo que la familia Albert existe para no hacer.
3. **Dos orígenes, una clave de cruce opcional por origen** *(recomendada)*. Albert es
   la fuente del canal asistido; Vivaru la del autoservicio. `vivaruLeadId` es
   **obligatorio solo en los leads empujados desde Vivaru** y ausente en los nacidos en
   Albert. El cruce de esos últimos ocurre **al convertir**: el conjunto nace en Vivaru
   con `vendedorId`, que ya está construido y desplegado, y `crmRef` se anota entonces.

**Si se toma la 3, hay que aceptar una consecuencia y decirla:** hasta que exista la
señal de vuelta, **Vivaru no sabrá cuántas oportunidades hay en curso** — solo verá las
que se convierten. El embudo asistido seguirá midiéndose en Albert, no en Vivaru. Eso
es aceptable como estado intermedio y **deja de serlo** en cuanto el volumen justifique
la señal de vuelta.

### 7.2 · Lo que Albert debe conservar

Por cada lead **recibido de Vivaru**:

- **`vivaruLeadId`** (obligatorio **en este origen**, inmutable): el doc id de `leads/`
  en Vivaru. Es la clave del cruce en los dos sentidos; sin él, `crmRef` no tiene a qué
  apuntar. **Ausente, y válido que lo esté, en los leads nacidos en Albert** (§7.1).
- Los campos declarados que Vivaru ya empuja: nombre, contacto, país, unidades
  estimadas, origen (`demo`/`diagnostico`/`trial`).
- Dueño y estado, con su historial de transiciones (quién, cuándo).
- `TBD`: dónde vive esto en el modelo de Albert — depende de la decisión «¿Vivaru es
  un tenant de Albert?» (§0.3).

**Regla de oro del contrato:** los campos que empuja Vivaru los corrige Vivaru; los
campos de trabajo comercial los escribe Albert. Ninguno pisa los del otro.

## 8 · Reglas de negocio verificables

1. Un lead en estado distinto de `nuevo` **tiene dueño**. Siempre.
2. `convertido` y `perdido` son terminales: no admiten transición de salida.
3. `perdido` sin motivo **no se puede guardar**.
4. `vivaruLeadId`, **cuando existe**, es inmutable tras la creación. Su ausencia es
   válida en los leads nacidos en Albert (§7.1) y **no** lo es en los empujados.
5. Ninguna acción de la vista borra un lead; retirar es `perdido` con motivo.

## 9 · Criterios de aceptación (borrador — se completan con §5)

- [ ] Un comercial abre la vista y ve leads de Vivaru con estado y dueño.
- [ ] Cambiar un estado deja rastro: quién y cuándo.
- [ ] Marcar `perdido` sin motivo **falla**.
- [ ] Transicionar desde `convertido` o `perdido` **falla**.
- [ ] Editar `vivaruLeadId` **falla**.
- [ ] Un lead empujado desde Vivaru aparece en la vista sin intervención de nadie.
- [ ] Con el `crmRef` anotado en Vivaru, una persona puede ir del lead de Vivaru al
      de Albert y volver sin ambigüedad.
- [ ] Un lead **nacido en Albert** (sin `vivaruLeadId`) se guarda y se trabaja con
      normalidad — §7.1, decisión 3.
- [ ] Una escritura hacia Albert **sin credencial válida falla** (§12.1).
- [ ] Un lead empujado llega con la versión de política y la fecha de consentimiento
      que Vivaru registró (§13).

## 10 · Notificaciones

La checklist de la casa lo pide y la 0.1 no lo tenía. Tres decisiones, ninguna
dependiente de `REVOPS-000`:

- **Asignación de un lead a un comercial:** avisa **Albert**, por su propio canal. No
  lo manda Vivaru. Motivo: el correo transaccional de Vivaru sale por
  `functions/src/email.ts` con remitente verificado del dominio de Vivaru, y usarlo
  para avisar a comerciales de otro sistema mezcla dos operaciones.
- **Lead nuevo empujado desde Vivaru:** el aviso comercial que Vivaru ya manda hoy
  (`comercial@qintilab.com`, buzón único) **se mantiene sin cambios**. El enrutado por
  país sigue fuera de alcance, aquí y en la mitad de Vivaru.
- **Sin promesas de plazo.** Ni este PRD ni la vista prometen tiempos de respuesta al
  prospecto: el producto no controla cuándo llama una persona. `SUP-001` mide la
  primera respuesta en soporte; aquí no hay equivalente y no se inventa.

---

## 11 · Riesgos

| Riesgo | Señal | Mitigación |
|---|---|---|
| Especificar flujos imaginados | §5 sigue `TBD` y alguien construye igual | La regla de avance de §0 — este PRD no pasa a desarrollo con §5 vacío |
| Doble digitación (Albert y bandeja de Vivaru) | Los cinco anotan dos veces o ninguna | Mientras no haya señal de vuelta, definir en §5 cuál es la fuente y quién replica |
| Los dos productos jóvenes a la vez | Tiempos de Albert bloquean REVOPS | Ya declarado en el expediente: es co-desarrollo, y sus tiempos son dependencia de planificación de Vivaru |
| Estados divergen con el tiempo | Un estado nuevo en un lado sin espejo | El ciclo de §6 es el contrato; cambiarlo exige tocar este PRD |

## 12 · Arquitectura: cómo escribe Vivaru en Albert

La checklist obliga a decidir **cliente directo contra callable**, y aquí la pregunta
equivalente es cómo cruza el dato de un producto al otro. **No es un detalle de
implementación: es el permiso.**

### 12.1 · La vía que existe hoy no sirve, y hay que decirlo

**Verificado [V]:** `submitDemoLead` es un **endpoint HTTP público con CORS**. Funciona
sin que Albert construya nada — y por eso el expediente lo celebra. Pero para empujar
leads reales es inaceptable por dos motivos independientes:

1. **Cualquiera puede escribir.** Un endpoint público que crea registros comerciales
   admite basura de cualquier origen, y el CRM de una operación que arranca es
   justamente donde la basura hace más daño: contamina la línea base que `REVOPS-000`
   existe para levantar.
2. **No hay forma de saber que el que escribe es Vivaru.** Sin identidad del llamante,
   `vivaruLeadId` es una afirmación del cliente, no un hecho — y §8.4 lo declara
   inmutable, cosa que no se puede sostener sobre un canal anónimo.

**Requisito:** la escritura Vivaru → Albert es **servidor a servidor y autenticada**,
desde una Cloud Function de Vivaru, nunca desde el navegador. El mecanismo concreto
—clave de servicio, OIDC, token firmado— es **decisión de Albert** (§0.5); lo que este
PRD fija es que el llamante debe ser identificable y el endpoint no público.

**Consecuencia de alcance:** esto sí es trabajo en Vivaru, aunque pequeño, y corrige la
línea del encabezado de la 0.1 que decía «en Vivaru no se construye nada». Se construye
el emisor autenticado; el resto sigue siendo de Albert.

---

## 13 · Retención, supresión y consentimiento

Ausente en la 0.1, y es el hueco con consecuencias legales. **Lo que se empuja no es
un registro técnico: son datos personales de un prospecto** —nombre, correo,
teléfono— recogidos bajo un consentimiento que Vivaru pide de forma expresa desde
`REVOPS-001A` (desplegado el 18 de agosto).

- **El consentimiento se recoge en Vivaru y viaja con el lead.** Cada lead empujado
  debe llevar qué versión de la política aceptó y cuándo — Vivaru ya lo guarda con
  fecha del servidor (`consent.policyVersion`, `consent.at`). Un lead en Albert sin
  ese dato es un lead que nadie puede demostrar que autorizó.
- **La supresión tiene que funcionar en los dos lados.** La Ley 1581 y la LFPDPPP dan
  al titular derecho a que se borren sus datos. Hoy Vivaru puede atender eso en su
  mitad; **empujar a Albert crea una segunda copia que ese borrado no alcanza**.
  `TBD` para Albert: qué mecanismo de supresión ofrece, y si acepta una orden de
  borrado por `vivaruLeadId`.
- **Los leads nacidos en Albert quedan fuera de esta cadena** (§7.1): su
  consentimiento lo recoge quien los captó, y hoy no hay constancia de cómo. **Eso es
  una pregunta para `REVOPS-000`**, no un problema técnico: cómo pide autorización un
  KAM cuando anota a alguien tras una llamada.
- **Retención:** `TBD` conjunto. Vivaru no tiene hoy política de purga para `leads` —
  la misma brecha que `AI-GOV-001` tiene abierta para `aiAssistance`. No se resuelve
  en este PRD, pero se deja nombrada para que no se descubra tarde.

---

## 14 · Despliegue y operación

- El despliegue es **en Albert**; Vivaru no despliega nada para este PRD.
- **Quién opera esto a diario (G5):** los cinco comerciales en Albert; en Vivaru, el
  superadmin que ya opera la bandeja. La anotación manual de `crmRef` es operación
  diaria **hasta** la señal de vuelta — si eso dura más de un trimestre, la señal de
  vuelta sube de prioridad.
- Rollback: retirar la vista no pierde datos de Vivaru — Vivaru es la fuente de su
  mitad y nunca deja de guardarla.

## Puertas

| Puerta | Estado |
|---|---|
| G0 Necesidad | ✅ El problema está medido: cero recorrido registrado, comisión no atribuible |
| G1 Valor | ✅ Baseline cero y métrica declarada (§2) |
| G2 Datos y permisos | ◐ La mitad de Vivaru verificada y **desplegada**, con el catálogo poblado. Falta la de Albert (§0.3) y **la dirección de §7.1**, que la 0.1 daba por supuesta |
| G3 Riesgo | ◐ **Bajó de ✅ en la 0.2.** La vista es reversible, pero los datos personales empujados no: sin mecanismo de supresión en Albert (§13) no hay cómo revertir un tratamiento |
| G4 Aceptación | ◐ Borrador — se completa con §5 |
| G5 Operación | ◐ Declarada, pendiente de validar con los cinco |
| G6 Escala | ✅ Cinco personas y decenas de leads: el volumen no es el riesgo aquí |

**Ninguna puerta se marcó ✅ por avanzar.** G3 bajó a ◐ al revisar: la 0.1 la daba por
superada leyendo «reversible» como una propiedad de la vista, cuando la pregunta es si
es reversible el **tratamiento de datos personales**. No lo es todavía.

---

## Changelog

### 0.2 — 18 de agosto de 2026 (tarde)

**Por qué:** revisión contra la checklist de `crear-prd-vivaru` y contra el código
desplegado ese mismo día (`6207fa7`). El §5 sigue vacío —espera a `REVOPS-000`— así que
se refinó todo lo que no dependía de esa conversación. **Ninguna puerta subió; una
bajó.**

**El hallazgo que más cambia el documento (§7.1).** La 0.1 asumía una sola dirección:
el lead nace en Vivaru y se empuja a Albert. Se verificó en código y **para el canal
que de verdad opera es imposible**: en Vivaru un lead solo nace de los formularios del
landing o del alta de prueba, `firestore.rules` veta la creación (`allow create: if
false`) y no hay pantalla de alta manual. Un KAM no rellena un formulario web, así que
sus leads **hoy no pueden existir en Vivaru**. Con eso, `vivaruLeadId` no puede ser
obligatorio como decía §7. Se plantean tres salidas y se recomienda la tercera —dos
orígenes con clave de cruce opcional por origen—, diciendo en voz alta lo que cuesta:
hasta que haya señal de vuelta, Vivaru solo verá las oportunidades que se convierten.

**Tres huecos que la checklist de la casa señaló y la 0.1 no tenía:**

- **§12.1 · Cómo se autentica la escritura.** La única vía que funciona hoy es un
  endpoint HTTP **público con CORS**. El expediente lo celebraba como «ya funciona»;
  para leads reales es inaceptable —cualquiera escribe, y `vivaruLeadId` pasa a ser una
  afirmación del cliente sobre un canal anónimo—. Se fija como requisito que la
  escritura sea servidor a servidor autenticada. **Corrige el encabezado de la 0.1:**
  sí se construye algo en Vivaru, el emisor.
- **§13 · Retención, supresión y consentimiento.** Lo empujado son datos personales de
  un prospecto, con consentimiento recogido en Vivaru desde `REVOPS-001A` (desplegado
  hoy). Empujarlos crea una segunda copia que el borrado de Vivaru no alcanza. Por eso
  **G3 bajó a ◐** y el riesgo del encabezado subió a Alto.
- **§10 · Notificaciones.** Quién avisa de qué, por qué canal, y la regla de no
  prometer plazos que el producto no controla.

**Actualizado con lo desplegado hoy:** `REVOPS-001E` pasó de construido a desplegado, y
el catálogo `salesReps` **ya tiene a los cinco comerciales dados de alta** — así que
`salesReps.crmRef` deja de ser un campo teórico y puede rellenarse en cuanto Albert diga
qué forma tiene su identificador (§0.5).

**Y una sección nueva, §0.5:** los cinco insumos concretos que hay que pedirle al equipo
de Albert. No son decisiones que esperen a `REVOPS-000` — son datos que hoy no tenemos y
sin los cuales no se puede cerrar el contrato.

### 0.1 — 18 de agosto de 2026 (madrugada)

Borrador inicial. La mitad de Vivaru (esquema de `REVOPS-001E`) verificada contra
`11e3bae`; los hallazgos de Albert contra el expediente 0.5 (`docs/albert-vivaru-integracion.md`).
§5 vacío a propósito: se llena con la salida de `REVOPS-000`.
