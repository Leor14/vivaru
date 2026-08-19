# PRD-A-OPS-001 — Vista de Leads de Vivaru en Albert

> **Primera PRD de la familia Albert.** Vivaru redacta, Albert desarrolla — decisión
> de los socios del 17 de agosto de 2026: Albert es de Qintilab y **se adapta a las
> reglas de negocio de Vivaru**, no al revés. Expediente completo de la decisión en
> `docs/albert-vivaru-integracion.md` (0.5).

| Campo | Valor |
|---|---|
| **ID** | `PRD-A-OPS-001` |
| **Tipo** | `OPS` — operación comercial; el usuario es interno |
| **Superficie** | Consola de Albert, **dentro del tenant `vivaru`** — decidido el 18 ago 2026 (§0.3) |
| **Portales de Vivaru** | **`SUPERADMIN`** — afectado, no alcance: la bandeja de Leads y Comerciales ya existen y se operan en paralelo. `ADMIN`, `RESIDENTE` y `PORTERIA` no se tocan |
| **Usuario principal** | **Daniel Aguilar** (KAM, el único prospectando) y **David Almeida**. Los otros tres del catálogo no venden Vivaru hoy — ver §5.3. Más quien opere la consola Superadmin de Vivaru |
| **Responsable** | David (Vivaru) redacta y acepta · equipo de Albert construye |
| **Estado** | **Borrador 0.4 — casi lista.** Bisagra cerrada, insumos técnicos recibidos y `REVOPS-000` hecho. Lo que queda es que el §5.3 es en parte hipótesis, y se corrige con el primer cliente |
| **Dependencias** | `REVOPS-001E` ✅ desplegado · catálogo `salesReps` ✅ poblado · `REVOPS-000` ✅ **hecho el 18 ago** · bisagra ✅ decidida · `REVOPS-001B` (evento de activación) para automatizar la etapa «en prueba» |
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
2. ~~**¿La superficie de destino es la pestaña global de Leads o los contactos del
   tenant?**~~ **Resuelta por la decisión de la bisagra:** ninguna de las dos. El
   trabajo comercial vive en el **pipeline del tenant `vivaru`** (§0.3), y la colección
   global `leads` de Albert **queda fuera de alcance** — es su captura de landing, no
   la nuestra (§7.3).
3. ~~**¿Vivaru opera como un tenant de Albert?**~~ ✅ **DECIDIDO el 18 de agosto de
   2026: sí.** Ver §0.3 para el razonamiento y lo que cuesta.
4. ~~**Dónde nace el lead del canal asistido.**~~ **Resuelto en §7.1 con mecanismo
   concreto**, no solo con un principio: dos orígenes que convergen en el pipeline del
   tenant, y `vivaruLeadId` presente solo en los de inbound.

**Lo único que sigue bloqueando:** `REVOPS-000`. El §5 tiene ahora su mitad de inbound
—que se deduce del sistema, no de las personas— y le falta la del canal asistido.

**Regla de avance:** este documento pasa a «Lista para desarrollo» cuando **§5 se
complete con la salida de `REVOPS-000`**. Es lo único que queda: las tres `TBD` de la
0.2 están cerradas y los insumos técnicos llegaron.

### 0.3 · La bisagra, decidida — Vivaru es un tenant de Albert

**Decisión de David, 18 de agosto de 2026.** Los datos comerciales de Vivaru viven en
`tenants/vivaru/` dentro de Albert. Los cinco trabajan ahí, con cuentas de ese tenant.

**El argumento que la decidió no es de arquitectura, es de exposición.** El `stage` de
Albert es **texto configurable por tenant**, así que el espacio `vivaru` puede usar el
vocabulario de Vivaru **sin que Albert cambie una línea**. Con eso, la parte más
peliaguda de «Albert se adapta a Vivaru» pasa de desarrollo a configuración — y eso
ataca directamente el riesgo que el expediente marca en primer lugar: que los tiempos
del equipo de Albert se conviertan en dependencia de planificación de Vivaru. Cuanto
menos haya que construir allá, menos expuesto está esto.

Efectos colaterales, todos a favor:

- **`tenantId` es constante** (`vivaru`), así que `crmRef` se simplifica (§7.3).
- **Se reutilizan RBAC, pipeline y auditoría** de Albert tal cual.
- **Lo que queda por construir en Albert son dos cosas**, no un programa: la vista de
  Leads y el disparador de vuelta.

**Lo que cuesta, y queda escrito para que nadie lo descubra tarde:** el pipeline
comercial de Vivaru queda **acoplado al modelo de datos de Albert**. Si Qintilab vende
Albert, lo separa, o cambia su esquema de `deals`, ese acoplamiento hay que deshacerlo.
Hoy los dos productos son de casa, así que es riesgo de futuro; conviene revisarlo si
eso deja de ser cierto.

**Y descarta explícitamente la alternativa:** «Vivaru como sistema externo» habría
significado mantener dos modelos sincronizados por contrato y, llevado en serio, que
**Vivaru desarrollara sus propias pantallas de CRM** — exactamente lo que
`REVOPS-001E` decidió no hacer el 17 de agosto («sin cuentas, sin portal»).

### 0.5 · Qué hay que pedirle al equipo de Albert, en concreto

Las `TBD` de arriba son decisiones. Esto son **insumos**: sin ellos no se puede
escribir el contrato, y pedirlos no depende de `REVOPS-000`.

**Contestados el 18 de agosto de 2026** con la ficha técnica del equipo de Albert:

| Qué se pidió | Respuesta y dónde se aplicó |
|---|---|
| Modelo de datos de `lead` y `deal` | ✅ El deal vive en `tenants/{tenantId}/deals/{dealId}` y el lead es top-level sin `tenantId`. **Obligó a rehacer `crmRef`** — §7.3 |
| Vocabulario de estados | ✅ **Son DOS, no uno**, y «convertido» vive en el pipeline, no en `leads`. **Corrigió el §6** — ver §6.1 |
| Cómo se autentica una escritura servidor a servidor | ✅ **OIDC Google-a-Google**, recomendado por Albert y adoptado — §12.1 |
| Si la pestaña global de Leads es desplegable | ✅ **Deja de importar**: con la bisagra en tenant, esa colección queda fuera de alcance |
| Si Albert puede emitir un evento al ganar | ✅ **Hoy no tiene ni un disparador** (`functions/src` son solo callables), pero es viable y barato. Contrato en §5.2 |

**Lo que quedó abierto y no bloquea la decisión**, solo la implementación: si un deal
puede nacer con `amount: 0` sin ensuciar el forecast, y si puede nacer sin `contactId`.
Ver §7.3.

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

Los comerciales **no tienen cuenta en Vivaru y no la van a tener** — decisión cerrada de
`REVOPS-001E`: sin cuentas, sin portal, sin tocar autenticación. Sus cuentas viven en
Albert, en el tenant `vivaru`.

**Cuántos son de verdad:** el catálogo `salesReps` tiene cinco dados de alta, pero
`REVOPS-000` reveló que **solo uno prospecta** (Daniel Aguilar) y otro tiene un
acercamiento (David Almeida). Los otros tres están en el catálogo porque podrían vender,
no porque estén vendiendo — el campo `activo` sirve justo para eso. **La vista se diseña
para uno o dos usuarios concurrentes, no para cinco.**

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

## 5 · Flujo funcional

**Se parte en dos**, porque una mitad se deduce del sistema y la otra solo la saben las
personas. La primera se escribe aquí; la segunda sigue esperando a `REVOPS-000`.

### 5.1 · Lead de inbound — completo, y usa lo ya desplegado

El recorrido del lead que llega por el landing **no depende de la conversación con los
cinco**: el sistema ya lo determina, y su mitad de Vivaru está en producción desde el
18 de agosto de 2026.

1. **Entra por el landing** (`/api/demo` o `/api/lead`). Vivaru lo persiste en
   `leads/{leadId}` con su atribución —`utm_*`, `referrer`, landing— y su
   **consentimiento con fecha de servidor y versión de política**. Ya funciona.
2. **Se documenta solo.** Aparece en la bandeja de Leads del Superadmin con el contexto
   completo: de dónde vino, qué contestó en el diagnóstico, qué autorizó y cuándo.
3. **Alguien le asigna dueño** del catálogo `salesReps`. Ya existe y está desplegado.
4. **La asignación es el disparador del cruce.** Solo entonces el lead pasa al pipeline
   del tenant `vivaru` en Albert, **ya con dueño**, y Vivaru guarda la referencia
   devuelta en `crmRef`.
5. **A partir de ahí se trabaja en un solo sitio**, Albert, igual que una oportunidad
   nacida allá.

**Por qué el cruce ocurre AL ASIGNAR y no al entrar el lead** — y no es un detalle de
implementación:

- **El consentimiento se queda donde se dio.** Empujar datos personales a otro sistema
  es un tratamiento, no una copia técnica (§13). Si solo cruzan los **asignados**, cruza
  mucho menos dato personal y **los leads que nadie trabaja nunca se replican**. El
  problema de supresión que la 0.2 dejó abierto se encoge solo.
- **Un lead sin dueño no es una oportunidad**, es una entrada. El pipeline es para lo
  que alguien está trabajando.

### 5.2 · Señal de vuelta — fuera de alcance aquí, pero el contrato queda dicho

Cuando el deal llega a la etapa terminal-ganada, un disparador en Albert avisa a Vivaru
para que el conjunto nazca con su `vendedorId`. **No entra en este PRD** —es el
siguiente—, pero se deja escrito el contrato para que la vista no se diseñe de espaldas
a él: `{ crmRef, tenantId, dealId, amount, contactId, closedAt }`, detectando el estado
ganado **contra la configuración de etapas del tenant** (§6.1), no contra el literal.

### 5.3 · Canal asistido — lo observado y lo supuesto, separados

`REVOPS-000` se hizo el 18 de agosto de 2026. **Parte de esta sección son hechos y parte
es hipótesis, y van marcados**, porque tratarlos igual es cómo se acaba construyendo un
CRM imaginado.

#### Hechos [V]

- **Quién vende, de verdad:** Daniel Aguilar prospectando en frío (~6-7 nombres) y un
  acercamiento de David Almeida. Los otros tres no venden Vivaru. **Cero firmados.**
- **Cómo llegan:** mayoritariamente **conocidos**. Se aspira a referidos; la puerta fría
  es lo que hay. El inbound no pasa por los ejecutivos.
- **Dónde se anota hoy:** Word para consolidar, WhatsApp para avisar. Sin institucionalizar.
- **Motivos de pérdida, en sus palabras:** *distanciamiento* (dejan de contestar, no hay
  respuesta clara) y *enganche con el proveedor actual* — más barato, sacrificando
  calidad, y con **costo de cambio** que los frena.

#### La regla que decidió David, y es de negocio [V]

> **La lista fría NO entra al CRM.** «No queremos que eso radique como un compromiso
> dentro del CRM hasta no tener los datos correctos.»

**Eso define la puerta de entrada al pipeline**, que es la decisión más importante de
esta sección: se entra con **conversación e interés declarado**, no con un nombre. La
prospección en frío sigue viviendo donde vive hoy —Word— hasta que produzca una
conversación. Consecuencia directa: **el pipeline mide oportunidades, no esfuerzo**, y
el número de deals abiertos significa algo desde el primer día.

#### El recorrido — **HIPÓTESIS**, a corregir con el primer cliente [S]

**Nadie ha firmado nunca**, así que estos pasos no se observaron: se proponen. Van
marcados `[S]` de supuesto, y la regla de esta PRD es que **se corrigen en cuanto Daniel
cierre el primero** — no se defienden.

```
(prospección en frío — fuera del CRM, en Word)
        │  hay conversación e interés declarado
        ▼
   contactado ──→ calificado ──→ en prueba ──→ convertido
        └──────────────┴─────────────┴───────→ perdido (con motivo)
```

| Etapa | Qué la define | Por qué esta y no otra |
|---|---|---|
| **contactado** | Hubo conversación e interés | Es la puerta que fijó David |
| **calificado** | Se sabe **cuántas unidades**, **quién decide** y **cuándo** | Son los tres datos que el precio necesita: la guía maestra tarifa por unidad y por país |
| **en prueba** | Se le abrió la prueba de 15 días | **Es la etapa que hace esto de Vivaru** — ver abajo |
| **convertido** | La prueba pasó a cliente | Terminal-ganado (§6.1) |
| **perdido** | Con motivo obligatorio | Terminal, y el motivo es el aprendizaje |

**Por qué «en prueba» merece ser una etapa y no una nota.** El producto ya tiene una
prueba de 15 días y **una definición de activación calculada** —7 pasos durante la
prueba, 10 en un cliente— que ya se ve en la consola de Superadmin. Eso convierte esa
etapa en la única del pipeline que **no depende de la opinión del comercial**: no es
«creo que va bien», es «activó 7 de 7 y le quedan 4 días». Un CRM genérico no puede
tener esa etapa; este sí, y es exactamente lo que significa «Albert se adapta a Vivaru».

> ◆ Emitir esa señal es `REVOPS-001B` («la regla ya existe, falta el evento»). Mientras
> no exista, la etapa se mueve a mano — pero la etapa debe existir desde el principio,
> porque cambiar un pipeline con datos dentro cuesta mucho más que definirlo bien.

#### Motivos de pérdida — lista cerrada

Sale de sus palabras, con un desdoblamiento deliberado:

| Motivo | Cuándo |
|---|---|
| `sin_respuesta` | Distanciamiento: dejaron de contestar |
| `proveedor_actual` | Están enganchados con otro proveedor y **cambiar les cuesta** |
| `precio` | El nuestro no encaja, sin proveedor de por medio |
| `momento` | Interés real, pero no ahora |
| `otro` | **Texto obligatorio** |

**`proveedor_actual` y `precio` van separados a propósito.** David los describió juntos,
pero son aprendizajes distintos: uno dice que nuestro precio está mal y el otro que el
costo de cambio pesa más que la diferencia de precio. Colapsarlos haría parecer un
problema de tarifa lo que es un problema de migración — y se atacan de formas opuestas.

#### Lo que sigue sin dato

**Qué necesita ver un comercial de un conjunto que ya vendió.** No hay experiencia; se
propone el mínimo que el producto ya sabe —si la prueba activó, si está pagando, cuántas
unidades— y se corrige con el primer cliente real. `[S]`

## 6 · Estados y transiciones

El ciclo es el de Vivaru — Albert se adapta, esa es la premisa de la familia:

```
nuevo → contactado → calificado → convertido (terminal)
   ↘________↘____________↘______→ perdido (terminal, con motivo obligatorio)
```

- **Todo estado tiene dueño:** el del lead (`ownerId`). Un lead sin dueño solo puede
  estar en `nuevo`.
- **`perdido` exige motivo** — el aprendizaje comercial del que Vivaru ya guarda
  espejo (`lostReason`).

### 6.1 · Albert tiene DOS vocabularios, no uno — corrección de la 0.3

La 0.1 y la 0.2 asumían que Albert tenía una sola escalera de estados y que bastaba
mapearla. **Es falso, y la ficha técnica de Albert lo aclara:**

| Dónde | Vocabulario | Para qué sirve |
|---|---|---|
| Colección `leads` (global) | `new · contacted · qualified · discarded` | Captura de **su** landing |
| Pipeline de `deals` (por tenant) | `Nuevo · Contactado · Propuesta · Negociacion · Ganado · Perdido` | El recorrido comercial de verdad |

**Y la consecuencia cambia el diseño: «convertido» NO vive en la colección de leads.**
Un negocio está convertido cuando **el deal alcanza el estado terminal-ganado**. Ese es
el terminal que le importa a REVOPS, y está en otra colección y en otro nivel del que
este PRD suponía.

**Decisión, alineada con la recomendación de Albert:** el estado que manda es el del
**deal**. La escalera de Vivaru se configura como los `stage` del tenant `vivaru`, y
«convertido» es su etapa terminal-ganada.

> ▲ **Trampa que hay que respetar al implementar:** `stage` es **texto libre
> configurable por tenant**. Detectar la conversión comparando la cadena `"Ganado"` se
> rompe en cuanto alguien renombre la etapa. **Hay que detectar contra la configuración
> de etapas del tenant** —la posición terminal-ganada—, nunca contra el literal. Aplica
> igual a la vista y al disparador de vuelta (§5.2).

- **`convertido` no lo escribe un comercial a mano en Vivaru:** lo produce ganar el
  deal en Albert. El disparador avisa a Vivaru, y Vivaru crea o marca el conjunto con
  su `vendedorId`.
- **`convertido` y `perdido` no se colapsan** en un solo terminal: REVOPS los cuenta por
  separado, y el pipeline de Albert ya los distingue (`Ganado` / `Perdido`).

## 7 · Contrato de datos e identidad cruzada

La mitad de Vivaru **ya existe y está verificada en código** (`11e3bae`):

| En Vivaru | Campo | Quién lo escribe |
|---|---|---|
| `leads/{leadId}` | `ownerId` · `ownerAssignedAt` | Superadmin (bandeja) |
| `leads/{leadId}` | `crmRef` — **referencia estructurada al deal en Albert**, ver §7.3 | Lo escribe el cruce al asignar dueño (§5.1); a mano solo como respaldo |
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

### 7.3 · `crmRef` no puede ser un identificador plano — corrección de la 0.3

**Lo construido en `REVOPS-001E` guarda `crmRef` como texto libre, sin formato.** Eso
estaba bien mientras no supiéramos qué iba a contener; ahora sí lo sabemos, y un id
suelto **no resuelve a nada**:

- Un **deal** vive en `tenants/{tenantId}/deals/{dealId}`. Sin el tenant, el id no
  localiza nada.
- Un **lead** de Albert sí es top-level (`leads/{leadId}`), pero **queda fuera de
  alcance**: esa colección es la captura de la landing de Albert, no la nuestra (§0.2).

**Y aquí la decisión de la bisagra paga:** como Vivaru es **un** tenant, el `tenantId`
es la constante `vivaru`. Así que el formato puede ser mínimo sin perder capacidad de
resolver:

```
albert:deal:vivaru:{dealId}
```

Se guarda el prefijo completo en vez del `dealId` a secas por dos motivos: dice **de qué
sistema y de qué entidad** habla —el día que haya otra referencia cruzada no habrá que
adivinar—, y hace evidente al leerlo que apunta a un deal y no a un lead.

**No hay migración que hacer:** el campo es texto libre, no tiene validación, y **no
existe ni un lead real** que lo tenga rellenado. Definir el formato hoy no cuesta nada;
definirlo con cien leads dentro, sí.

**Pendiente de confirmar con Albert** (no bloquea la decisión, sí la implementación):

1. **¿Se puede crear un deal sin monto conocido?** El esquema exige `amount` y admite
   `0`, pero una oportunidad recién entrada por el landing no tiene cifra. Hay que saber
   si un `0` ensucia su forecast o es lo normal.
2. **¿La oportunidad puede nacer sin contacto asociado?** `contactId` figura opcional;
   conviene confirmarlo antes de construir el cruce.

---

## 8 · Reglas de negocio verificables

1. Un lead en estado distinto de `nuevo` **tiene dueño**. Siempre.
2. `convertido` y `perdido` son terminales: no admiten transición de salida.
3. `perdido` sin motivo **no se puede guardar**.
4. `vivaruLeadId`, **cuando existe**, es inmutable tras la creación. Su ausencia es
   válida en los leads nacidos en Albert (§7.1) y **no** lo es en los empujados.
5. Ninguna acción de la vista borra un lead; retirar es `perdido` con motivo.

## 9 · Criterios de aceptación

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
- [ ] La etapa **«en prueba»** existe en el pipeline del tenant `vivaru` y se puede
      alcanzar desde «calificado» (§5.3).
- [ ] Marcar `perdido` **exige elegir motivo de la lista cerrada**, y `otro` **sin texto
      falla** (§5.3).
- [ ] La conversión se detecta **contra la configuración de etapas del tenant**, no
      contra el literal `"Ganado"`: renombrar la etapa terminal **no rompe** la
      detección (§6.1).
- [ ] Un lead que entra al pipeline **sin conversación previa** —una importación de la
      lista fría— **no es un caso soportado**: la puerta de entrada es conversación e
      interés (§5.3).

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
desde una Cloud Function de Vivaru, nunca desde el navegador.

**Mecanismo, decidido en la 0.3 siguiendo la recomendación de Albert: OIDC
Google-a-Google.** Vivaru firma un token de identidad con su cuenta de servicio y Albert
verifica firma, audiencia y correo. **Cero secretos compartidos y rotación automática**,
que es lo que lo hace mejor que un HMAC: un secreto compartido funciona hasta que hay que
rotarlo, y entonces alguien tiene que acordarse. Los dos productos ya viven en GCP, así
que es el camino natural y no añade infraestructura.

**Y hay que cerrar lo que hoy está abierto:** la regla de Albert es
`allow create: if true` sobre `leads`. Aunque Vivaru deje de usar esa colección (§7.3),
**el ingreso público sigue existiendo para su propia landing**, y conviene separar los
dos caminos: uno público para el formulario anónimo y otro autenticado para sistemas.
Eso es de Albert, no de Vivaru, pero lo anota este PRD porque lo destapó.

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
- **Quién opera esto a diario (G5):** **Daniel Aguilar**, que es quien prospecta; David
  Almeida de forma ocasional; y en Vivaru, el superadmin que ya opera la bandeja. La anotación manual de `crmRef` es operación
  diaria **hasta** la señal de vuelta — si eso dura más de un trimestre, la señal de
  vuelta sube de prioridad.
- Rollback: retirar la vista no pierde datos de Vivaru — Vivaru es la fuente de su
  mitad y nunca deja de guardarla.

## Puertas

| Puerta | Estado |
|---|---|
| G0 Necesidad | ✅ El problema está medido: cero recorrido registrado, comisión no atribuible |
| G1 Valor | ✅ Baseline cero y métrica declarada (§2) |
| G2 Datos y permisos | ✅ **Sube en la 0.3.** La mitad de Vivaru desplegada y el catálogo poblado; la de Albert resuelta por la bisagra —tenant, con su RBAC— y el contrato de identidad reescrito contra el modelo real (§7.3) |
| G3 Riesgo | ◐ **Sigue abajo, y mejora sin cerrarse.** El cruce solo al asignar (§5.1) reduce mucho el dato personal replicado, pero **el mecanismo de supresión en Albert sigue `TBD`** (§13): reducir no es revertir |
| G4 Aceptación | ✅ **Sube en la 0.4.** §5 completo — los criterios cubren el camino de inbound, el del canal asistido y los que deben fallar |
| G5 Operación | ✅ **Sube en la 0.4.** Sabemos quién opera esto: Daniel a diario, David Almeida ocasional, y el superadmin en la bandeja de Vivaru. Ya no es una suposición |
| G6 Escala | ✅ **Y el volumen real es aún menor de lo que decía la 0.1**: ~7 prospectos en frío y 1 acercamiento, no «decenas de leads». Refuerza construir lo mínimo |

**G2 sube porque se resolvió, no porque el documento crezca.** Y **G3 sigue abajo a
propósito**: el cruce solo al asignar reduce el daño, pero reducir no es revertir.
Mientras Albert no diga cómo borra, un dato personal empujado no tiene vuelta — y esa es
exactamente la pregunta que G3 hace.

---

## Changelog

### 0.4 — 18 de agosto de 2026 (noche, tras `REVOPS-000`)

**Por qué:** se hizo `REVOPS-000` — la conversación que este documento llevaba tres
versiones esperando. **Suben dos puertas (G4, G5) y el §5 queda completo.** Y corrige la
premisa sobre la que se escribió todo lo anterior.

**No son cinco personas vendiendo.** Es **una prospectando en frío** (Daniel Aguilar,
~6-7 nombres, nada concreto) y **un acercamiento suelto** (David Almeida). Jaime y Luis
Otero no venden Vivaru; David Martínez acompaña y habilita el producto. **Cero
firmados.** «Cinco personas, tres países» describía quiénes *podrían* vender, no quiénes
están vendiendo — y este PRD dimensionaba su usuario a partir de esa cifra.

**La regla que salió sola y no la había pedido nadie:** la lista fría **no entra al
CRM**. Con eso queda definida la puerta de entrada al pipeline, que es la decisión más
importante del §5.3: se entra con **conversación e interés declarado**, no con un
nombre. Consecuencia: el pipeline mide **oportunidades, no esfuerzo**, y el número de
deals abiertos significa algo desde el primer día.

**El §5.3 separa hechos de hipótesis, y va marcado.** Nadie ha firmado nunca, así que el
recorrido posterior a la primera conversación **no se observó: se propone**. Va con `[S]`
y con la regla de que se corrige en cuanto Daniel cierre el primero — no se defiende.

**La etapa «en prueba» es la que hace esto de Vivaru y no un pipeline genérico.** El
producto ya tiene prueba de 15 días y una definición de activación calculada —7 pasos en
la prueba, 10 en un cliente, visible en Superadmin—. Es la única etapa del pipeline que
**no depende de la opinión del comercial**: no es «creo que va bien», es «activó 7 de 7 y
le quedan 4 días». Un CRM genérico no puede tenerla.

**Motivos de pérdida como lista cerrada**, con un desdoblamiento deliberado: David
describió juntos «se enganchan con su proveedor actual» y «es más barato», pero son
aprendizajes opuestos — uno dice que nuestro precio está mal y el otro que el **costo de
cambio** pesa más que la diferencia. Colapsarlos haría parecer problema de tarifa lo que
es problema de migración.

**Lo que sigue sin dato:** qué necesita ver un comercial de un conjunto ya vendido. Se
propone el mínimo que el producto ya sabe y se corrige con el primer cliente.

### 0.3 — 18 de agosto de 2026 (noche)

**Por qué:** llegó la ficha técnica del equipo de Albert con los cinco insumos que la
0.2 pidió, y David cerró la bisagra. **Sube una puerta (G2) y el §5 deja de estar vacío.**

**La decisión: Vivaru es un tenant de Albert** (§0.3). El argumento que la cerró no es de
arquitectura sino de exposición: el `stage` de Albert es texto configurable por tenant,
así que el espacio `vivaru` usa el vocabulario de Vivaru **sin que Albert cambie una
línea**. La parte más peliaguda de «Albert se adapta a Vivaru» pasa de desarrollo a
configuración, y eso ataca el riesgo que el expediente marca primero — que los tiempos de
Albert se vuelvan dependencia de planificación de Vivaru. Queda escrito lo que cuesta: el
pipeline comercial queda acoplado al modelo de datos de Albert.

**Dos correcciones que la ficha forzó, y las dos tocaban cosas ya escritas:**

1. **Albert tiene DOS vocabularios de estado, no uno** (§6.1). La 0.1 y la 0.2 asumían
   una sola escalera. **«Convertido» no vive en la colección `leads` sino en el pipeline
   de deals**, como etapa terminal-ganada. Con la trampa asociada: `stage` es texto libre
   por tenant, así que detectar la conversión comparando el literal `"Ganado"` se rompe en
   cuanto alguien la renombre.
2. **`crmRef` no puede ser un identificador plano** (§7.3). Un deal vive bajo
   `tenants/{tenantId}/deals/{dealId}` y sin el tenant no resuelve. La bisagra lo suaviza
   —el tenant es constante— y queda `albert:deal:vivaru:{dealId}`. **Sin migración**: el
   campo es texto libre y no hay ni un lead real que lo tenga.

**El §5 se parte en tres y dos partes se escriben ya.** La mitad de inbound no dependía
de `REVOPS-000` —la determina el sistema, no las personas—: el lead entra por el landing
con su atribución y consentimiento, se documenta en la bandeja, y **cruza a Albert solo
cuando se le asigna dueño**. Ese «solo al asignar» no es un detalle de implementación:
mantiene el consentimiento donde se dio y evita replicar datos personales de leads que
nadie va a trabajar. Con eso el hueco estructural de la 0.2 —los dos orígenes— queda
resuelto con un mecanismo, no con un principio.

**Autenticación decidida: OIDC Google-a-Google** (§12.1), la opción que Albert
recomienda. Cero secretos compartidos y rotación automática; los dos productos ya viven
en GCP. Y queda anotado que Albert debería separar su ingreso público de landing
(`allow create: if true`) del ingreso autenticado de sistemas — es suyo, pero lo destapó
este PRD.

**Lo único que sigue bloqueando es `REVOPS-000`.** El §5.3 —qué pasa entre «hablé con
alguien» y «firmó», y con qué motivos se da por perdido— es lo que solo saben las cinco
personas.

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
