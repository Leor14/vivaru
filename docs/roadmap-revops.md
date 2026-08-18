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
| **Versión** | 0.1 |
| **Fecha** | 17 de agosto de 2026, noche |
| **Base** | Documento Rector REVOPS v1.0, verificado contra código y ambientes |
| **Verificado contra** | Repositorio en `80c4bf5` y proyecto `hogaru-1` (producción) |
| **Bloqueo dominante** | **El CRM Quintilab es la fuente de verdad de cinco dominios y sus capacidades no están confirmadas** |

**Qué aporta esta versión:**

- **La línea base del embudo está medida**: 5 leads, 1 calificado, **cero convertidos**.
- **Cuatro capacidades que el documento da por ausentes ya existen**, incluida la
  definición de trial activado — que además ya se ve en la consola comercial.
- **Tres que da por presentes no funcionan**: PostHog no recibe nada, no hay agenda
  de demos, y no hay puerta pública de alta intención.
- Se nombra el bloqueo estructural que el documento trata como tarea de discovery.

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
| Leads totales | **5** |
| Por estado | 4 `nuevo` · 1 `calificado` · **0 `convertido`** · 0 `perdido` |
| Por origen | 3 `demo` · 2 `trial` |
| Conjuntos con `leadId` vinculado | **2 de 9** |
| Conjuntos por plan | `plus` 5 · `starter` 1 · `premium` 1 · `trial` 2 |
| Documentos en la colección `plans` | **0** |

**Lecturas que importan:**

- **Cero conversiones registradas.** Ningún lead ha llegado a `convertido`. El
  embudo no está roto por volumen alto: nunca ha completado un ciclo.
- **La trazabilidad lead → conjunto existe pero está incompleta.** El campo `leadId`
  está en el conjunto, y solo 2 de 9 lo tienen. Los otros 7 se crearon por otras vías.
- **Hay planes en uso sin catálogo de planes.** Los conjuntos llevan `planId`
  (`starter`, `plus`, `premium`, `trial`) pero la colección `plans` está **vacía** y
  **no hay ningún precio en el código**. `REVOPS-001C` necesita seleccionar plan y
  guardar un snapshot de precio; hoy no hay de dónde sacarlo.

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
`convertido` | `perdido`. El documento lo lista como brecha. Lo que falta es que
**alguien los mueva**: 4 de 5 leads siguen en `nuevo`.

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

## 5 · El bloqueo estructural que el documento trata como tarea

El Documento Rector asigna al **CRM Quintilab** la fuente de verdad de **cinco
dominios**: lead, contacto comercial, organización, oportunidad y tareas. Construye
sobre eso una tabla de fuentes de verdad, un contrato de eventos, una estrategia de
reconciliación y tres incrementos.

Y su **decisión abierta número 1** es: *«¿Qué capacidades ofrece exactamente el CRM
Quintilab? ¿Tiene API, webhooks, automatizaciones, agenda y mensajería?»*

**Se está diseñando una arquitectura sobre un sistema cuyas capacidades no están
confirmadas.** No es un detalle de discovery: si Quintilab no tiene API o webhooks,
la mitad del documento —sincronización, outbox, reconciliación periódica, replay
controlado— no se puede construir como está escrita.

**Recomendación:** `Gate R0` deja de ser un entregable más y pasa a ser **condición
de entrada bloqueante** de `REVOPS-001A`. Concretamente, tres preguntas cuya
respuesta cambia el diseño:

1. ¿Hay API de escritura y webhooks de salida? Si no, la sincronización es
   exportación manual y el contrato de eventos sobra en esta fase.
2. ¿Hay agenda? Si no, el journey sales-assisted necesita herramienta externa antes
   de instrumentarse.
3. ¿Hay mensajería con supresión y consentimiento? Si no, las diez secuencias de la
   sección 14 no tienen dónde vivir.

**Lo que sí se puede hacer sin esa respuesta**, y conviene separarlo para no quedar
bloqueado: la atribución del lead, el consentimiento persistente, los eventos de
producto y la respuesta automática por correo —que ya usa Resend—. Es decir, **el
valor de `REVOPS-001A` que no depende del CRM**.

---

## 6 · Alcance corregido de los incrementos

| Incremento | Alcance del documento | Corrección |
|---|---|---|
| **R0** | Entregable de discovery | **Condición de entrada bloqueante** para lo que toque CRM |
| **001A** | Atribución, consentimiento, dedup, sync CRM, respuesta, rutas | Se parte en **001A-1 sin CRM** (atribución, consentimiento, eventos, respuesta por Resend, **construir la puerta de alta intención**) y **001A-2 con CRM**, que espera a R0 |
| **001B** | Definir trial activado, eventos, cohortes | La definición **ya existe**: instrumentar el evento y correlacionarlo. Alcance menor del previsto |
| **001C** | Solicitud de activación, planes, handoff reseller | Necesita antes **un catálogo de planes con precio**, que hoy no existe en ninguna parte |
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
| **Diseñar la integración antes de conocer el CRM** | **Crítica** | El documento lo trata como pregunta de discovery, no como bloqueo |
| **Suponer PostHog operativo** | Alta | La librería existe; la configuración no |
| **`REVOPS-001A` como séptimo P0** | Media | El horizonte AHORA del roadmap ya tiene seis |
| **Contratar sin catálogo de planes ni precio** | Alta | `REVOPS-001C` pide snapshot de precio y no hay fuente |
| **Los 5 leads existentes envejecen** | Media | 4 siguen en `nuevo`; el proceso ya falla con el volumen que hay |

Ese último merece énfasis: **el embudo no está fallando por falta de herramientas,
está fallando con cinco leads.** Antes de construir orquestación conviene trabajar
esos cinco a mano y ver dónde se atasca de verdad — es la línea base más barata que
existe y no requiere una sola línea de código.

---

## 9 · Decisiones abiertas

Se conservan las 27 del documento original. Se elevan tres a **bloqueantes**, y se
añade una:

1. **¿Qué puede hacer realmente Quintilab?** (API, webhooks, agenda, mensajería).
   Bloquea todo lo que sea sincronización.
2. **¿Con qué herramienta se agenda una demo?** No hay ninguna, y tres journeys la
   asumen.
3. **¿Cuál es el catálogo de planes y su precio?** `plans` está vacía y no hay precio
   en el código; sin eso no hay solicitud de activación.
4. **Nueva — ¿se trabajan a mano los 5 leads actuales antes de automatizar?** Es la
   forma más rápida y barata de levantar el baseline que el documento pide.

---

## Changelog

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
