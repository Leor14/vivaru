# Vivaru REVOPS — base de roadmap de activación comercial

Documento de trabajo para la épica transversal `REVOPS`. Adapta el **Documento
Rector de Revenue Operations v1.0** (17 de agosto de 2026) corrigiendo lo que no
quedó suficientemente cimentado y midiendo lo que dejaba como pendiente.

Mantiene la estructura de tres zonas del roadmap de producto: el estado se reescribe
arriba, el cuerpo se edita en su sitio, y solo el changelog acumula. El porqué está
en `docs/roadmap-producto.md`.

---

## Estado de esta revisión

| Campo | Valor |
|---|---|
| **Versión** | 0.5 |
| **Fecha** | 20 de agosto de 2026, madrugada |
| **Base** | Documento Rector REVOPS v1.0 + documentación de Albert CRM + **navegación de la consola desplegada** |
| **Verificado contra** | Repositorio en `c81e2fe` (`master` = `develop`), proyecto `hogaru-1`, y las cuatro rondas del intercambio con Albert en `docs/prd/albert/`. Estado vivo del expediente: `docs/prd/albert/ESTADO-ALBERT.md` |
| **Bloqueo dominante** | **NINGUNO por parte de Albert, desde el 22 de agosto de 2026.** El alta A5 **está ejecutada** —tenant `vivaru` activo y usuario de servicio con rol `sales`— y **A1 está publicado en su producción**. La segunda mitad de `REVOPS-001C` **se puede construir cuando se quiera**; lo que falta es trabajo de Vivaru, no espera. Ver `docs/prd/albert/ESTADO-ALBERT.md` |

> **Aviso de vigencia (actualizado el 24 ago 2026).** Lo único que le queda a este frente que se
> pueda hacer **hoy y sin cliente** es la **segunda mitad de `REVOPS-001C`** —enterarse de que un
> deal se ganó, suscribiéndose a `tenants/vivaru/deals`—, y **ya no espera a nadie**: el alta A5
> está ejecutada desde el 22. Todo lo demás de REVOPS espera el nivel 0, que no es ingeniería.
>
> **Aviso de vigencia (22 ago 2026).** El cuerpo de este documento se escribió el 20 de
> agosto y **describe a Albert como estaba entonces**. Sus inventarios de carencias —«no hay
> webhooks», «no hay integraciones ni claves de API»— siguen siendo ciertos **como
> descripción de su consola**, pero **ya no describen lo que bloquea a Vivaru**: el encuadre
> de tenant los volvió irrelevantes. Al leer una fila de este documento que diga que algo
> espera a Albert, **contrastarla con `ESTADO-ALBERT.md` antes de creerla.**

**Qué cambió en 0.5:** **la señal de vuelta dejó de ser un bloqueo, y este documento
decía que sí lo era.** `RESPUESTA-A-001` C1 lo cerró el 19 de agosto: siendo tenant de
Albert, Vivaru se suscribe en vivo (`onSnapshot`) a `tenants/vivaru/deals`, porque sus
reglas conceden lectura a todos los roles del tenant. **La frase «Albert no tiene
webhooks» era cierta mientras Vivaru fuese un tercero y murió al volverse tenant** — y ese
tipo de muerte no deja commit ni prueba en rojo. Corregido en tres sitios de este
documento. **El bloqueo dominante pasa a ser el alta del tenant**, que cuesta un correo.
Además llegó `RESPUESTA-A-002`, que confirma el contrato y deja a Vivaru dos deudas
propias: la invariante «contacto antes que deal» y **dos** números de retención.

**Qué cambió en 0.3:** se navegó la consola real de Albert. **Su documentación
sobredescribe lo desplegado en un punto crítico** y lo subdescribe en otros. Ver 5.5.

**Qué cambió en 0.2:** se identificó el CRM. El «CRM Quintilab» del documento
original es **Albert CRM**, producto propio de la misma casa, con el mismo stack que
Vivaru.

**Qué aporta esta base sobre el Documento Rector:**

- **La línea base del embudo está medida, y es cero**: los 5 leads de producción son **pruebas internas**. Nunca ha entrado un prospecto real.
- **Cuatro capacidades que el documento da por ausentes ya existen**, incluida la
  definición de trial activado — que además ya se ve en la consola comercial.
- **Tres que da por presentes no funcionan**: PostHog no recibe nada, no hay agenda
  de demos, y no hay puerta pública de alta intención.
- **El CRM se conoce**, y con él lo que se puede integrar hoy y lo que hay que construir.

**Lo que NO cambia, porque está bien:** la tesis, la separación entre Finance y
billing SaaS, las cinco máquinas de estado independientes, el contrato de eventos
con envelope, la disciplina de identidad e idempotencia, y la regla de no fijar
targets antes de tener baseline.

---

## 1 · Qué se verificó del Documento Rector v1.0

Sus afirmaciones sobre capacidades existentes son en su mayoría correctas:

| Afirmación | Resultado |
|---|---|
| Landing, diagnóstico de 9 preguntas, rutas de adquisición | Correcto |
| Captura persistente de leads | Correcto (`src/lib/marketing/leads.ts`) |
| Orígenes `demo` / `diagnostico` / `trial` | Correcto |
| Trial self-service de 15 días | Correcto (`TRIAL_DAYS = 15`) |
| Guía de onboarding «cercana a 18 pasos» | **Exactamente 18** |
| Avisos del lifecycle del trial | Correcto (`trialLifecycleDaily`) |
| Conversión manual por back office | Correcto (`createTenantFromLead`) |
| GA cargado bajo consentimiento | Correcto |
| Sin UTMs ni referrer en el lead | **Correcto — la brecha existe** |
| Sin checkout ni facturación | **Correcto — no hay pasarela de ningún tipo** |

Su diagnóstico central —que la infraestructura es más madura que la adopción, y que
la falta de clientes reales bloquea el aprendizaje del producto, de la IA, del
onboarding y del soporte— **es exacto y coincide con lo medido en el resto del
roadmap.**

---

## 2 · Línea base medida — el embudo real

El documento pide levantar baseline antes de diseñar. **Se midió.** Producción
(`hogaru-1`), 17 de agosto de 2026:

| | Valor |
|---|---|
| Leads totales | **5 — y ninguno real** |
| Qué son | Pruebas internas: uno de `qintilab.com`, otro llamado «Prueba Dummy», y tres envíos de la misma persona en cinco minutos con empresa «prueba» y «demo» |
| Por estado | 4 `nuevo` · 1 `calificado` · **0 `convertido`** · 0 `perdido` |
| Conjuntos con `leadId` vinculado | **2 de 9** |
| Conjuntos por plan | `plus` 5 · `starter` 1 · `premium` 1 · `trial` 2 |
| Documentos en la colección `plans` | **0** |

**Lecturas que importan:**

- **Cero leads reales, no cero conversiones.** Es peor y más simple de lo que parecía:
  no es que el embudo pierda gente, es que **nunca ha entrado nadie**. La persistencia
  de leads además es reciente —antes `/api/demo` y `/api/lead` solo mandaban correo—,
  así que **cualquier lead real anterior está en el buzón y no en Firestore**.
- **Consecuencia para el diseño:** no se puede atribuir tráfico que no existe ni medir
  un embudo por el que no ha pasado nadie. Y la guía maestra de precios diseña **canal
  KAM y reseller en cuatro países**, un camino que **no pasa por el landing** — que es
  justo lo que este frente instrumenta. Decidir el canal va antes que instrumentarlo.
- **La trazabilidad lead → conjunto existe pero está incompleta.** El campo `leadId`
  está en el conjunto, y solo 2 de 9 lo tienen. Los otros 7 se crearon por otras vías.
- **El precio está decidido y no cableado.** La guía maestra
  —`Vivaru_Guia_Maestra_Precios_por_Pais_2026-08-12` (Drive), 12 de agosto de 2026— fija precio por unidad al
  mes para México, Panamá, Colombia y Ecuador, separando base, canal y final al
  cliente. Pero la colección `plans` de producción está **vacía**, no hay cifra de
  precio en el código, y los `planId` en uso (`starter`, `plus`, `premium`, `trial`)
  **no corresponden** a la segmentación comercial (Emergente, Core, Enterprise).
  `REVOPS-001C` necesita un snapshot de precio: la fuente existe, falta conectarla.
  Detalle en `docs/roadmap-producto.md`, sección «El precio».

---

## 3 · Cuatro capacidades que el documento da por ausentes y sí existen

Esto cambia el alcance de dos incrementos.

### 3.1 La definición de trial activado **ya existe y ya se ve**

El documento la lista como brecha y le dedica la sección 15 completa a proponerla
como hipótesis. Está implementada:

- `activationStepsFor(track)` en `src/lib/onboarding/steps.ts` define los pasos de
  activación como **todo lo que no es descubrimiento** — y son **7 en la prueba y 10
  en un cliente**, porque el recorrido de cliente añade pasos.
- `use-onboarding-progress.ts` calcula `activationDone` / `activationTotal`.
- **`/superadmin/tenants` ya muestra «X de Y»** con estado completo, parcial o sin
  empezar.

**Lo que falta no es la definición: es el evento y su correlación.** Nadie emite
`activation_milestone` cuando se alcanza, y nadie ha comparado activación con
conversión — porque no hay conversiones. `REVOPS-001B` pasa de «definir» a
«instrumentar y correlacionar», que es bastante menos trabajo.

### 3.2 Los estados comerciales del lead ya están normalizados

`LeadStatus` es un catálogo cerrado: `nuevo` → `contactado` → `calificado` →
`convertido` | `perdido`. El documento lo lista como brecha. **Existen y funcionan**;
lo que no hay es a quién aplicárselos.

### 3.3 Ya hay 14 eventos con nombre, versionados y con doble destino

`src/lib/marketing/analytics.ts` declara un tipo cerrado `LandingEvent` con 14
eventos —`page_view_landing`, `cta_primary_click`, `lead_magnet_start`,
`lead_magnet_step_complete`, `lead_magnet_complete`, `pricing_view`, `demo_booked`,
`scroll_depth` y otros— con la advertencia escrita de no renombrarlos sin actualizar
los embudos.

**La brecha real es de cobertura, no de existencia:** están todos en el landing y
**ninguno en el producto**. No hay `trial_started`, `activation_step_completed` ni
`converted`. El contrato de eventos del documento (§11.2) es correcto; el trabajo es
extender un patrón existente, no crearlo.

### 3.4 La captura del lead ya distingue ambiente

`leads.ts` persiste `appEnv`, así que staging y producción no se mezclan. El
documento lo pide como requisito de `REVOPS-001A`; ya está resuelto.

---

## 4 · Tres capacidades que el documento da por presentes y no funcionan

### 4.1 PostHog está importado y **no recibe nada**

El documento lo cuenta entre las capacidades observadas. La librería está
(`posthog-js ^1.376.2`) y el código la llama, pero **la variable
`NEXT_PUBLIC_POSTHOG_KEY` no está en el `apphosting.yaml` de ninguna de las dos
ramas** — lo dice el comentario del propio archivo, que además explica que ese
descuido llegó a silenciar eventos enteros.

**Hoy el único destino analítico vivo es Google Analytics.** Cualquier plan que
suponga PostHog operativo parte de un supuesto falso.

### 4.2 No existe agenda de demos

Los journeys 7.2 y el contrato de eventos incluyen `demo.scheduled`,
`demo.attended` y `demo.no_show`, y las métricas piden *booking rate*, *show rate* y
recuperación de no-show. **No hay ninguna integración de agenda en el repositorio.**

`demo_booked` existe, pero es un evento de landing —se dispara al pulsar—, no una
reserva confirmada. El journey «sales-assisted» **no tiene soporte hoy**, ni
propio ni de terceros, y su instrumentación depende de decidir antes con qué
herramienta se agenda.

### 4.3 No hay puerta pública de alta intención

El journey 7.3 arranca con un prospecto que dice «Quiero contratar». La única ruta
de contacto comercial es `requestAdvisorContact`, y **exige `user.tenantId`**: es
para alguien **que ya es cliente o está en trial**, dentro del portal. Un prospecto
sin cuenta no tiene por dónde declarar intención de compra salvo el formulario de
demo.

`REVOPS-001A` incluye «rutas demo, trial y contratación». La tercera **no existe** y
hay que construirla, no conectarla.

---

## 5 · El CRM, ya identificado: Albert CRM

El Documento Rector asigna al «CRM Quintilab» la fuente de verdad de **cinco
dominios** —lead, contacto, organización, oportunidad y tareas— y a la vez su
decisión abierta número 1 es preguntar qué capacidades tiene. Con la documentación de
**Albert CRM** esa pregunta queda contestada.

**Albert CRM es producto propio de la misma casa**, no un proveedor externo. Firebase
`albert-crm-1-1c162`, Next.js 16, Firestore, Cloud Functions v2, Zod en los callables,
aislamiento multi-tenant por custom claims, auditoría y catch-all deny en reglas. **Es
la misma doctrina de arquitectura que Vivaru**, escrita por el mismo equipo.

### 5.1 Las tres preguntas bloqueantes, contestadas

| Pregunta | Respuesta | Consecuencia |
|---|---|---|
| ¿Hay API de escritura? | **Sí, parcial.** `submitDemoLead` es un endpoint **HTTP público con CORS** que crea el lead en `/leads` con `status: "new"` | **Vivaru puede empujar leads a Albert hoy**, sin construir nada del lado de Albert |
| ¿Hay webhooks de salida? | **No.** No hay emisión de eventos, outbox ni notificación saliente | **Albert no puede avisar a Vivaru de nada.** Es el hueco crítico |
| ¿Hay agenda? | **No.** Su propio landing agenda con formulario, igual que Vivaru | El journey *sales-assisted* sigue sin soporte **en los dos productos** |
| ¿Hay mensajería con consentimiento y supresión? | **No.** Hay **plantillas con merge fields** para email y tareas — almacenamiento de plantillas, no motor de envío | Las diez secuencias de la §14 del documento **no tienen dónde vivir** |

### 5.2 Lo que esto cambia en el diseño

**La integración es de una sola dirección hoy.** Vivaru → Albert funciona por el
endpoint público. **Albert → Vivaru no existe**, y es justo la dirección que
`REVOPS-001C` necesita: que un deal ganado dispare la activación de la suscripción.

Eso reordena el trabajo:

- **Se puede hacer ya, sin tocar Albert:** empujar el lead con su atribución al
  crearse, y que la consola de Albert lo reciba en tiempo real. El equipo comercial
  deja de trabajar leads en la pantalla de Superadmin de Vivaru y pasa a su CRM.
- **Hay que construirlo, y en Albert:** la señal de vuelta. Es un trigger de
  Firestore sobre `deals` que llame a una callable de Vivaru cuando la etapa cambie a
  ganada. **No es negociable con un tercero: es trabajo propio en un repo propio.**
- **Queda sin dueño:** la mensajería con consentimiento y supresión. Ninguno de los
  dos productos la tiene, y el documento la da por resuelta en el CRM.

**La ventaja que el Documento Rector no podía conocer:** al ser producto propio,
desaparecen de golpe cuatro de sus riesgos —DPA con proveedor, límites de tasa,
vendor lock-in y contratos de integración—. **Lo que no desaparece** es la necesidad
técnica: idempotencia, reconciliación y una bandeja de excepciones siguen haciendo
falta aunque ambos lados sean nuestros.

### 5.3 Dos colecciones `leads` que no encajan

Los dos productos tienen una colección `leads` y **sus vocabularios no son
compatibles**:

| | Vivaru | Albert |
|---|---|---|
| Estados | `nuevo` · `contactado` · `calificado` · **`convertido`** · **`perdido`** | `new` · `contacted` · `qualified` · `discarded` |
| Origen | `demo` · `diagnostico` · `trial` | `landing` |
| Campos propios | `unidadesEstimadas`, `conjuntos`, `timeline`, `appEnv` | `teamSize`, `company` |
| Alcance | Global | **Global**, con `create` público y lectura solo de Super Admin |

**Albert no tiene estado `convertido`**, que es precisamente el terminal que a REVOPS
más le importa. El mapeo no es uno a uno y hay que decidirlo explícitamente, no
deducirlo al integrar.

Tres notas de diseño que salen de aquí:

1. La colección `leads` de Albert es **global y compartida** con los leads de su
   propio landing. Un lead empujado desde Vivaru necesita un `source` que lo
   discrimine — Albert ya tiene ese campo.
2. **Vivaru sería un tenant dentro de Albert.** Es limpio —el aislamiento de Albert
   protege los datos— pero conviene decidirlo a conciencia: los datos comerciales de
   Vivaru vivirían en otro producto multi-tenant.
3. Los dos exponen un `/api/lead`. Misma ruta, sistemas distintos: conviene cuidarlo
   al documentar para no confundir a quien llegue después.

### 5.4 Lo que Albert ya resuelve y REVOPS daba por construir

Albert tiene implementado, y no hay que rehacerlo: pipeline por etapas con
responsable, monto, probabilidad y fecha de cierre; contactos con historial;
tareas; `timeline` de actividad por deal; `auditEvents` con lenguaje de negocio;
plantillas con merge fields; políticas de aprobación por umbral; y una consola de
Super Admin con pestaña de leads en tiempo real y estado editable.

**El modelo `Opportunity` de la §10 del Documento Rector ya existe** como `deals`, con
etapa, owner, monto y fecha. `REVOPS-001B` y `001C` no tienen que modelarlo: tienen
que **conectarse a él**.

### 5.5 Lo que se vio navegando la consola desplegada

La documentación de Albert se comprobó contra el producto en vivo el 17 de agosto de
2026. **Sobredescribe en un punto crítico y subdescribe en varios.**

**Lo que NO existe aunque esté documentado:**

- **La pestaña «Leads» de la consola de Super Admin no está desplegada.** Su §9
  describe ocho pestañas con una de Leads que muestra en tiempo real las solicitudes
  del landing, con métricas y estado editable. **Hay siete**: Overview, Tenants,
  Onboarding, Planes, Uso, Health y Plataforma. Ninguna es Leads.
- **Consecuencia directa para REVOPS, y es la que manda:** `submitDemoLead` escribe
  en la colección global `/leads`, y **nadie tiene pantalla para trabajarla**.
  Empujar leads de Vivaru por ese endpoint los mandaría a un sitio que no se mira.
- **«Leads y contactos» del CRM es otra cosa:** son los contactos **del tenant**
  (`?tab=contacts`), no los leads globales del landing.
- **No hay sección de integraciones, claves de API ni webhooks** en ningún sitio. La
  configuración del comercio tiene Usuarios, Productos, Plantillas, Aprobaciones y
  Auditoría, y nada más. Confirma que no existe superficie de integración saliente.
- **La pestaña «Plataforma» son cuatro viñetas estáticas**, no una interfaz de
  autoservicio y gobierno.

**Lo que existe y la documentación no menciona:** un dashboard ejecutivo con
*revenue engine*, forecast ponderado y GAP; reportes de inteligencia comercial;
**importación y exportación de contactos por CSV**; y un asistente embebido.

**Y el dato que conviene mirar de frente:** Albert tiene **3 tenants** —`demo`,
`do-payment` y `lucho`—, los tres en plan Starter, los tres con **0% de onboarding y
0% de adopción**, con última actividad en abril, junio y agosto. Sus planes tienen
límites y **ningún precio**. Vivaru sí tiene precio decidido, pero fuera del producto.

> **Albert no es un CRM rodado al que Vivaru se conecta. Es un producto hermano en la
> misma etapa de madurez y con el mismo problema: plataforma construida, uso
> ausente.** Apoyarse en él es una decisión legítima, pero no reduce riesgo por ser
> «un CRM ya existente»: Vivaru sería su usuario más exigente y probablemente el
> primero real.

### 5.6 El camino que sí funciona hoy

De todo lo anterior sale una recomendación concreta y barata:

**El mecanismo existe y sirve; lo que falta es el contenido.** La importación CSV de
contactos funciona en Albert, así que el día que haya prospectos reales el circuito
manual es el primer paso correcto: sin construir nada, y contestando si el equipo
comercial entra al CRM antes de invertir en integrarlo.

**Pero hoy no hay a quién importar.** Los 5 leads de producción son pruebas internas.
Meterlos a un CRM para «levantar baseline» no probaría nada y ensuciaría el sistema
comercial — el mismo error que la sombra de IA aprendió a evitar con los datos
sembrados.

## 6 · Alcance corregido de los incrementos

| Incremento | Alcance del documento | Corrección |
|---|---|---|
| **R0** | Entregable de discovery | **Parcialmente resuelto** por la documentación de Albert. Queda decidir mapeo de estados y quién es tenant de quién |
| **001A** | Atribución, consentimiento, dedup, sync CRM, respuesta, rutas | **El sync a Albert se puede hacer ya** por su endpoint público. Sigue habiendo que **construir la puerta de alta intención**, que no existe |
| **001B** | Definir trial activado, eventos, cohortes | La definición **ya existe**: instrumentar el evento y correlacionarlo. Alcance menor del previsto |
| **001C** | Solicitud de activación, planes, handoff reseller | Necesita **un catálogo de planes con precio** (no existe) **y la señal de vuelta desde Albert** (tampoco existe, pero es trabajo propio) |
| **002** | Nurturing y scoring | Correcto: requiere conversiones reales, y hay **cero** |
| **003 / 004** | Reseller y checkout | Correcto que vayan después |

---

## 7 · Lo que conviene conservar tal cual

El documento acierta en cosas que no hay que tocar:

- **La separación entre Vivaru Finance y Subscription & Commercial Billing.** Son
  dominios distintos y compartir entidades «por conveniencia técnica» sería el error
  clásico. Coincide con lo que `docs/roadmap-finance.md` mantiene por su lado.
- **Cinco máquinas de estado independientes** en vez de una sola para todo el
  embudo. Es correcto: un trial y una oportunidad no comparten ciclo de vida.
- **No usar IA para decidir precio, elegibilidad, contratación ni activación**, y
  meter cualquier uso posterior dentro de la plataforma de IA existente con
  evaluación y revisión humana. Es coherente con la doctrina del programa de IA.
- **No fijar targets antes de baseline**, registrando fecha, segmento y denominador.
- **La North Star operativa** —prospectos que alcanzan una siguiente acción válida y
  trazable— es la métrica correcta cuando no hay volumen para medir ingresos.
- **El criterio de readiness para campañas** (§26) es sólido y debe respetarse: sin
  atribución, consentimiento, respuesta y supresión, la pauta gasta a ciegas.

---

## 8 · Riesgos añadidos

| Riesgo | Severidad | Por qué no estaba |
|---|---|---|
| ~~Diseñar la integración antes de conocer el CRM~~ | — | **Cerrado en 0.2**: el CRM es Albert y sus capacidades están documentadas |
| **Los leads empujados no se ven** | **Crítica** | La pestaña de Leads de Albert no está desplegada; `/leads` no tiene interfaz |
| ~~El circuito no cierra sin la señal de vuelta~~ | — | **Cerrado el 20 ago 2026 por `RESPUESTA-A-001` C1**: siendo tenant, Vivaru lee sus deals en vivo con `onSnapshot`. No hace falta webhook. Solo espera el alta del tenant (A5) |
| **Apoyarse en un CRM sin rodaje** | Alta | Albert tiene 3 tenants de prueba con 0% de adopción: no es infraestructura probada |
| **La mensajería con consentimiento no tiene dueño** | Alta | El documento la da por resuelta en el CRM; ni Albert ni Vivaru la tienen |
| **Estados de lead incompatibles entre productos** | Media | Albert no tiene `convertido`, el terminal que REVOPS necesita |
| **Suponer PostHog operativo** | Alta | La librería existe; la configuración no |
| **`REVOPS-001A` como séptimo P0** | Media | El horizonte AHORA del roadmap ya tiene seis |
| **Contratar sin catálogo de planes ni precio** | Alta | `REVOPS-001C` pide snapshot de precio y no hay fuente |
| **Instrumentar un canal que no ha producido nada** | **Alta** | Cero leads reales, y la guía de precios diseña KAM y reseller — un camino que no pasa por el landing |

Ese último merece énfasis: **el embudo no está fallando por falta de herramientas —
nunca se ha encendido.** No hay un solo prospecto real. Antes de construir
orquestación hay que decidir por dónde va a entrar el primero, y la guía maestra de
precios ya diseña un canal —KAM y reseller en cuatro países— que este frente no
instrumenta.

---

## 9 · Decisiones abiertas

De las tres que en 0.1 marqué como bloqueantes, **dos quedan resueltas** por la
documentación de Albert y una sigue abierta. Se conservan las 27 del documento
original y se reordenan las críticas:

**Resueltas:**

- ~~¿Qué puede hacer Quintilab?~~ Es Albert CRM: hay escritura pública de leads, no
  hay webhooks, no hay agenda y no hay motor de mensajería.
- ~~¿Con qué herramienta se agenda una demo?~~ Sigue sin resolverse, pero ya se sabe
  que **Albert tampoco la tiene**: hay que elegir herramienta externa para los dos.

**Bloqueantes hoy:**

1. ~~**¿Quién construye la señal de vuelta Albert → Vivaru, y cuándo?**~~ **YA NO
   BLOQUEA — corregido el 20 ago 2026.** `RESPUESTA-A-001` C1 lo cerró: siendo tenant,
   Vivaru se suscribe en vivo a `tenants/vivaru/deals` y ve la conversión al instante.
   Nadie construye nada. Lo único que falta es el **alta del tenant (A5)**, que espera
   el correo del `tenant_admin`.
2. **¿Cuándo se cablea el precio al producto y con qué nomenclatura?** La decisión
   existe desde el 12 de agosto en la guía maestra; lo que falta es cargar el catálogo
   y reconciliar `starter/plus/premium` con `Emergente/Core/Enterprise`. Y decidir cuál
   de los dos marcos manda: el de la guía o el del Documento Rector de Finance.
3. **¿Cómo se mapean los estados de lead entre los dos productos?** Albert no tiene
   `convertido`, que es el que importa.
4. **¿Dónde vive la mensajería con consentimiento y supresión?** Ninguno de los dos
   productos la tiene, y la §14 del documento la da por resuelta.
5. **¿Por qué canal entra el primer cliente?** La guía maestra diseña KAM y reseller;
   este frente instrumenta el autoservicio. Decidirlo va antes que construirlo.
6. **¿Hay leads reales en el buzón**, anteriores a que existiera la persistencia? Es el
   único sitio donde podrían estar.

## Changelog

### 0.4 — 17 de agosto de 2026, noche

**Corrección del mismo día:** los 5 leads de producción **no son reales**. Son pruebas
internas —una se llama «Prueba Dummy», tres son la misma persona en cinco minutos—. No
es que el embudo pierda gente: **nunca ha entrado nadie**. Se retira la recomendación
de importarlos a un CRM y se sustituye por decidir el canal de salida al mercado.

**Por qué:** las versiones anteriores afirmaban que no había precio. Era falso: existe
desde el 12 de agosto de 2026 en `Vivaru_Guia_Maestra_Precios_por_Pais_2026-08-12`.
Lo que falta es cablearlo al producto y reconciliar la nomenclatura. Detalle en
`docs/roadmap-producto.md`, sección «El precio».

### 0.3 — 17 de agosto de 2026, noche

**Por qué:** se navegó la consola desplegada de Albert en vez de fiarse de su
documentación. Aparecieron discrepancias en los dos sentidos.

- **La pestaña «Leads» que su documentación describe NO está desplegada.** Hay siete
  pestañas y ninguna es de leads. Como `submitDemoLead` escribe en `/leads`, empujar
  leads desde Vivaru los dejaría donde nadie los mira. **Pasa a ser el bloqueo
  dominante**, por delante de la señal de vuelta.
- «Leads y contactos» del CRM son los **contactos del tenant**, no los leads globales.
- **No hay integraciones, claves de API ni webhooks** en ninguna pantalla.
- La documentación también **subdescribe**: hay revenue engine, forecast, reportes,
  **importación CSV de contactos** y un asistente embebido que no menciona.
- **Albert tiene 3 tenants de prueba con 0% de adopción.** No es un CRM rodado: es un
  producto hermano en la misma etapa que Vivaru. Se añade como riesgo.
- **Recomendación nueva (5.6):** importar los 5 leads por CSV a un tenant de Albert.
  Funciona hoy, no requiere construir nada, y levanta el baseline que el Documento
  Rector pide antes que ninguna automatización.

### 0.2 — 17 de agosto de 2026, noche

**Por qué:** apareció la documentación de **Albert CRM**, que es el «CRM Quintilab»
del documento original. Eso convierte el bloqueo principal de 0.1 en respuestas.

- **Es producto propio**, mismo stack y misma doctrina que Vivaru — no un proveedor.
  Desaparecen cuatro riesgos del original: DPA, límites de tasa, lock-in y contratos.
- **Se puede integrar hoy en una dirección:** `submitDemoLead` es un endpoint HTTP
  público con CORS. Vivaru puede empujar leads sin tocar Albert.
- ~~**Falta la dirección que importa.**~~ **CORREGIDO el 20 ago 2026.** Era cierto
  mientras Vivaru fuese un tercero. **Al ser tenant de Albert deja de hacer falta:** sus
  reglas conceden lectura de deals a todos los roles del tenant, así que Vivaru se
  suscribe en vivo y no necesita que le avisen. `RESPUESTA-A-001` C1, con la regla
  citada. **Una dependencia también se cae por dejar de necesitarla.**
- **Ni Albert ni Vivaru tienen agenda ni motor de mensajería con consentimiento.** Dos
  supuestos del documento original se quedan sin dueño en los dos productos.
- **Las dos colecciones `leads` no encajan:** Albert no tiene estado `convertido`, que
  es el terminal que REVOPS necesita.
- **Albert ya resuelve el modelo `Opportunity`** como `deals`, con etapa, owner, monto
  y fecha, más tareas, timeline, auditoría y plantillas. `001B` y `001C` no lo modelan:
  se conectan a él.

### 0.1 — 17 de agosto de 2026

**Por qué:** convertir el Documento Rector REVOPS v1.0 en base de roadmap versionada,
con sus afirmaciones verificadas contra el código y su línea base medida.

**Verificado contra:** repositorio en `80c4bf5` y lectura directa de `hogaru-1`.

- **Línea base medida**, que el documento dejaba pendiente: 5 leads, 4 en `nuevo`,
  1 `calificado`, **cero convertidos**; 2 de 9 conjuntos vinculados a un lead; la
  colección `plans` vacía.
- **Cuatro capacidades que figuraban como brecha ya existen**: la definición de trial
  activado (7 pasos en prueba, 10 en cliente, ya visible en Superadmin), los estados
  normalizados del lead, 14 eventos con nombre y tipo cerrado, y la separación de
  ambiente en la captura. Reduce el alcance de `REVOPS-001B`.
- **Tres que figuraban como presentes no funcionan**: PostHog no está configurado en
  ninguna rama y no recibe nada; no existe agenda de demos aunque tres journeys la
  asumen; y la ruta de alta intención exige sesión con conjunto, así que **un
  prospecto no tiene por dónde decir «quiero contratar»**.
- **Se eleva el CRM Quintilab de tarea de discovery a bloqueo estructural.** El
  documento le asigna la fuente de verdad de cinco dominios y a la vez pregunta qué
  capacidades tiene. Se propone partir `001A` en la mitad que no depende del CRM y la
  que sí.
- Se añade el riesgo de que `REVOPS-001A` sea el séptimo P0 de un horizonte que ya
  tiene seis.
- Se conserva íntegra la tesis, la separación Finance/billing SaaS, las cinco
  máquinas de estado, la doctrina de IA y el criterio de readiness para campañas.
