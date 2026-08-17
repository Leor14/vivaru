# Roadmap de Producto Vivaru

Inventario vivo de evolución de Vivaru. Conserva oportunidades, brechas, riesgos y
decisiones **sin convertir automáticamente cada solicitud comercial o tendencia en
una prioridad**.

**Regla central:** una iniciativa puede entrar al inventario con información
incompleta, pero no debe avanzar a construcción sin problema, usuario, evidencia,
dependencias y criterio de salida.

---

## Estado de esta revisión

> Esta sección **se reescribe entera** en cada revisión. Es lo primero que se lee y
> nunca crece: lo que deja de ser actual baja al changelog del final.

| | |
|---|---|
| **Versión** | 0.2 |
| **Fecha** | 17 de agosto de 2026, noche |
| **Estado** | Borrador para conversación y validación |
| **Verificado contra** | Repositorio en `1f3a86a` (`develop` = `master`), proyectos `hogaru-1` y `vivaru-staging-02` |
| **Alcance** | Madurez de producto. No está subordinado al go-to-market, aunque incorpora evidencia comercial y de adopción |

**Qué cambió en esta revisión:**

- **El modo sombra de PQRS pasó de «construido» a «corriendo en producción».** Dos
  triggers `ACTIVE` en `hogaru-1` y tres banderas encendidas (`ai-gateway`,
  `ai-pqrs-shadow`, `ia-proveedor-real`). Cero filas acumuladas, porque no hay
  tickets reales.
- **`AI-GOV-001` avanzó sin haberse planificado:** la divergencia del catálogo de
  banderas está corregida. `ai-pqrs-suggestions` estaba declarada y **no cerraba
  nada** — el panel de IA se pintaba siempre.
- **Desapareció un riesgo que no estaba en el tablero:** producción corría
  funciones desplegadas desde `develop`, y un despliegue desde `master` las habría
  **borrado**. Se promocionó `develop` a `master` y ambas ramas coinciden.
- **Se añadió una sección de observaciones sobre el orden**, firmada y separada del
  inventario: son opiniones de la revisión técnica, no cambios de prioridad.

**Qué espera decisión tuya:**

1. Tenant piloto para la IA visible de PQRS.
2. Política de retención de `aiAssistance` — hoy es la única colección de IA que
   guarda contenido del conjunto y no está en el cron de purga.
3. Si las observaciones sobre el orden se incorporan al tablero o se descartan.

---

## Cómo se mantiene este documento

Tres zonas con reglas distintas. Es lo que evita que un documento acabe describiendo
dos épocas a la vez.

| Zona | Regla | Por qué |
|---|---|---|
| **Estado de esta revisión** | Se **reescribe** entera | Lo nuevo va arriba; nadie debería bajar para saber qué cambió |
| **Cuerpo del inventario** | Se **edita en su sitio** | Debe describir el presente. **Nunca se le añade al final** |
| **Changelog** | Se **antepone** (lo nuevo primero) | Es lo único que acumula |

**La regla del cuerpo es la que más cuesta respetar y la que más rinde.** La
tentación al actualizar es añadir «actualización del …» al final. Eso obliga a bajar
y, peor, deja dos versiones conviviendo sin decir cuál manda. Ya pasó en este
repositorio: `wiki/modulos/pqrs.md` era de mayo de 2026, se le fueron añadiendo cosas
alrededor durante tres cambios grandes del módulo, y llegó a afirmar que el portal de
portería crea tickets — cosa que nunca ha hecho. Se detectó comprobando el código,
no leyendo el documento.

**Qué va en el changelog y qué no.** El diff de git ya dice qué líneas cambiaron,
cuándo y quién: repetirlo aquí produce un `git log` peor escrito que nadie mantiene.
El changelog solo aporta lo que el diff no puede decir — **por qué** cambió, **contra
qué se verificó**, y **qué decisión quedó tomada**.

**Fuente de verdad.** El repositorio manda; Notion es la vista publicada para quien no
abre el repo. La razón es concreta: en el repo un error se ve en el diff y se revierte
con un comando. El 17 de agosto de 2026, editando la copia de Notion, se sobrescribió
por accidente el título y el encabezado de propósito, y la recuperación dependió del
historial de deshacer del editor — que se pasó de largo y hubo que reconstruir a mano.

---

## Vista ejecutiva — roadmap por horizontes

Secuencia y prioridad relativa. **No representa fechas contractuales ni compromisos
de entrega.**

| Frente | AHORA | SIGUIENTE | DESPUÉS | EXPLORACIÓN |
|---|---|---|---|---|
| Fundaciones | 🔴 `CORE-001` | 🟠 Hardening y cobertura | — | — |
| Vivaru Finance | 🔴 `FIN-001` | 🟠 `FIN-002` | ⏸ `FIN-AI-001` | ◇ `FIN-CH-001` |
| IA y agentes | 🔴 `AI-GOV-001` · ⏸ `AI-DATA-001` | 🟠 `AI-PQRS-001` · `AI-COMM-001` | — | ◇ `AI-ONB-001` |
| Adquisición y conversión | 🔴 `GROW-001` · `GROW-002` | 🟠 `GROW-003` | 🔵 `GROW-004` | — |
| Mobile / iOS | 🟡 `MOB-001` | 🟠 `MOB-002` | — | ◇ `MOB-003` |
| Servicio a clientes | 🟠 `SUP-001` | 🟠 `SUP-002` | 🔵 `SUP-003` | ◇ `SUP-004` |
| Onboarding e importación | ⏸ Recolectar evidencia real | ⏸ `ONB-001` | — | ◇ `AI-ONB-001` |

**Leyenda:** 🔴 prioridad fundacional · 🟠 siguiente capacidad · 🔵 expansión
posterior · 🟡 descubrimiento · ⏸ bloqueado por datos · ◇ exploración condicionada

### Horizontes

- **AHORA** — integridad, riesgos, instrumentación y decisiones necesarias para avanzar.
- **SIGUIENTE** — capacidades con base suficiente para diseñar, pilotear o construir.
- **DESPUÉS** — expansión que depende de resultados anteriores o de mayor volumen.
- **EXPLORACIÓN** — oportunidades sin evidencia suficiente o sin decisión de solución.

### Estados

| Estado | Significa |
|---|---|
| Verificado | Existe evidencia en código o ambiente |
| Parcial | Existe una parte funcional, pero falta cerrar el flujo |
| Ausente | No existe implementación observable |
| Bloqueado por datos | Técnicamente posible, sin materia prima real para evaluarlo |
| Descubrimiento | Falta validar problema, usuario o alternativa |
| Decisión pendiente | Hay opciones, pero no una dirección aprobada |

---

## Resultados estratégicos buscados

1. Un núcleo multi-tenant confiable, seguro y auditable.
2. Menor tiempo para que un nuevo conjunto alcance valor real.
3. Un journey medible desde adquisición hasta conversión y retención.
4. Confianza financiera mediante consistencia, trazabilidad y reversibilidad.
5. IA útil, evaluada y controlada por evidencia.
6. Experiencias móviles alineadas con necesidades reales de cada rol.
7. Una operación de soporte escalable sin duplicar innecesariamente dominios.

---

## Inventario de iniciativas

### AHORA

#### `CORE-001` — Integridad, seguridad y fuente de verdad

- **Frente:** Fundaciones de plataforma · **Estado:** Parcial · **Prioridad:** P0
- **Problema:** la madurez real depende de reglas, sesiones, auditoría, consistencia
  entre rutas y pruebas de operaciones sensibles.
- **Siguiente decisión:** consolidar una lista verificable de brechas de seguridad,
  integridad, observabilidad y cobertura.
- **Criterio de salida:** operaciones críticas server-side, aislamiento por conjunto
  probado, auditoría completa y documentación reconciliada con producción.

#### `FIN-001` — Comando único e idempotente de aplicación de pagos

- **Frente:** Vivaru Finance · **Estado:** Parcial · **Prioridad:** P0
- **Problema:** las rutas de pago, comprobantes, ledger, vouchers, saldos y reversos
  deben producir un resultado completo o ninguno.
- **Dependencias:** modelo financiero vigente, permisos, reglas transaccionales y
  migración de flujos existentes.
- **Criterio de salida:** un pago aplicado o revertido mantiene consistentes
  obligación, payment, ledger, voucher, expediente y auditoría.

#### `GROW-001` — Atribución y consentimiento del lead

- **Frente:** Adquisición y conversión · **Estado:** Ausente · **Prioridad:** P0
- **Incluir:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`;
  `referrer`; landing; identificadores publicitarios cuando proceda; consentimiento y fecha.
- **Razón:** no se debe escalar publicidad si Vivaru no puede atribuir leads, trials
  y conversiones.
- **Criterio de salida:** cada lead conserva origen, consentimiento y ambiente sin
  mezclar staging y producción.
- **Evidencia (17 ago 2026):** `src/lib/marketing/leads.ts` ya persiste el lead con
  `appEnv` —bien resuelto— pero **ningún campo de atribución**.

#### `GROW-002` — Instrumentación del funnel y activación del trial

- **Frente:** Adquisición y conversión · **Estado:** Parcial · **Prioridad:** P0
- **Eventos mínimos:** `lead_submitted`, `trial_started`, `activation_step_completed`,
  `activation_milestone`, `trial_expiring`, `converted`.
- **Hitos iniciales:** primera unidad, primer residente, primer cobro, primera
  comunicación y primera operación relevante por rol.
- **Criterio de salida:** embudo y cohortes visibles desde fuente de tráfico hasta
  conversión o abandono.
- **Evidencia (17 ago 2026):** GA4 está cableado con consentimiento y carga diferida
  (`src/lib/marketing/google-analytics.ts`); los hitos de activación ya están
  modelados en `src/lib/onboarding/steps.ts` — **activación son 7 pasos en la prueba
  y 10 en un cliente**, según `activationStepsFor`.

#### `AI-GOV-001` — Cerrar brechas de gobierno y operación de IA

- **Frente:** Plataforma de IA · **Estado:** Parcial · **Prioridad:** P0
- **Criterio de salida:** contenido, feedback, telemetría, retención y despliegues
  tienen trazabilidad y políticas verificables.

| Punto | Estado (17 ago 2026, noche) |
|---|---|
| Retención de `aiAssistance` | **Abierto.** Única colección de IA con contenido del conjunto y sin política de purga |
| Correlación feedback ↔ ticket | **Abierto.** `aiFeedback` no guarda `ticketId` |
| Despliegue de `asistirTicketPqrs` | **Abierto.** No está desplegada en `hogaru-1` |
| Divergencias del catálogo de banderas | **Cerrado.** `ai-pqrs-suggestions` no gobernaba nada; ahora el panel va detrás de `FeatureGate` |

#### `AI-DATA-001` — Evidencia real para G6–G7

- **Frente:** Plataforma de IA · **Estado:** Bloqueado por datos
- **Prioridad:** P0 de aprendizaje, no de construcción
- **Problema:** la plataforma está más madura que el volumen real de tickets,
  comunicaciones, comprobantes e importaciones.
- **Siguiente decisión:** definir tenant piloto, volumen mínimo, calidad requerida y
  periodo de observación. **Esta decisión no está bloqueada por datos** — se puede
  tomar hoy.
- **Criterio de salida:** dataset productivo suficiente para evaluar calidad,
  seguridad, latencia, costo y utilidad humana.
- **Evidencia (17 ago 2026):** producción tiene 9 conjuntos, **7 marcados
  `isExample`**. Los dos reales tienen **0 tickets**. La sombra está armada y
  acumulando cero.

#### `SUP-001` — Operación básica de soporte

- **Frente:** Servicio a clientes · **Estado:** Parcial · **Prioridad:** P1
- **Añadir:** `assignedTo`, `firstResponseAt` y contador de pendientes.
- **Criterio de salida:** cada ticket tiene responsable, primera respuesta medible y
  visibilidad operativa desde Superadmin.
- **Nota:** `firstResponseAt` **no se puede reconstruir después**. Los tickets ya
  cerrados nunca lo tendrán.

#### `MOB-001` — Medición y auditoría de experiencia móvil

- **Frente:** Mobile/iOS · **Estado:** Descubrimiento · **Prioridad:** P1
- **Preguntas:** ¿qué roles usan móvil? ¿qué tareas intentan completar? ¿dónde
  abandonan? ¿qué es responsive y qué exige capacidades nativas?
- **Criterio de salida:** datos por dispositivo, portal y tarea; auditoría responsive;
  decisión documentada sobre el siguiente experimento.
- **Evidencia (17 ago 2026):** **no hay PWA** (sin manifest ni service worker); FCM
  está cableado en `src/lib/firebase/messaging.ts` **sin un solo consumidor** y sin
  service worker, así que no hay push; sí hay cámara y QR en portería. Hay pruebas
  visuales responsive sobre 4 rutas.

### SIGUIENTE

#### `FIN-002` — Expediente y conciliación determinística

- **Estado:** Parcial · **Dependencia:** `FIN-001`
- **Incluye:** `ReconciliationCase`, estados versionados, normalización, duplicados,
  candidatos determinísticos, bandeja de excepciones, motivos y reversos.
- **Criterio de salida:** un caso se rastrea desde la evidencia recibida hasta la
  aplicación, el rechazo o el reverso.

#### `AI-PQRS-001` — Piloto visible del asistente de PQRS

- **Estado:** Parcial
- **Dependencias:** despliegue verificado, tenant piloto, retención resuelta, volumen
  real y criterios de G7.
- **Límite:** la IA sugiere; la persona decide. No ejecuta acciones sensibles.
- **Evidencia (17 ago 2026):** construido y medido contra un gold set de 152 casos.
  Su bandera está apagada en producción y **su callable no está desplegada ahí**.

#### `AI-COMM-001` — Piloto medido del asistente de comunicaciones

- **Estado:** Implementado con adopción pendiente
- **Siguiente decisión:** audiencia piloto, objetivo medible y mecanismo de feedback.
- **Criterio de salida:** evidencia de ahorro de tiempo y calidad aceptable sin
  incidentes críticos.
- **Nota:** la línea base H2′ lleva **tres sesiones sin tomarse** y ya se gastaron dos
  administradores, que vieron la herramienta antes de la medición a ciegas.

#### `GROW-003` — Orquestación del trial y back office comercial

- **Estado:** Parcial
- **Incluye:** estados del lead, señales de intención e inactividad, tareas de
  seguimiento, secuencias controladas, alertas y motivo de conversión o pérdida.
- **Criterio de salida:** el equipo sabe quién llegó, qué hizo, dónde se detuvo y cuál
  es la siguiente acción.

#### `MOB-002` — Experimento móvil para portería

- **Estado:** Decisión pendiente · **Dependencia:** `MOB-001`
- **Hipótesis:** portería es el caso móvil más claro por cámara, QR, visitantes y
  paquetería.
- **Alternativa inicial:** fortalecer responsive y evaluar una PWA acotada antes de
  crear una aplicación nativa.

#### `SUP-002` — Métricas y notificaciones de soporte

- **Estado:** Ausente · **Dependencia:** `SUP-001` y volumen real
- **Activar cuando exista volumen:** antigüedad, primera respuesta, resolución,
  recurrencia, avisos dentro del producto y análisis de causas.

#### `ONB-001` — Evidencia para onboarding e importación inteligente

- **Estado:** Bloqueado por datos
- **Requisito:** recolectar archivos reales, encabezados no mapeados, decisiones de
  administradores y errores frecuentes.
- **Criterio de entrada:** 15–25 archivos reales, anonimizados o autorizados.
- **Evidencia (17 ago 2026):** `importRuns` tiene **0 filas en producción** y 7 en
  staging, **ninguna con encabezados sin mapear**. La fuente que iba a alimentar esto
  está vacía.

### DESPUÉS

#### `FIN-AI-001` — Extracción inteligente de comprobantes

- **Estado:** Ausente y bloqueado por datos
- **Dependencias:** `FIN-001`, `FIN-002`, comprobantes reales, contrato de extracción,
  dataset y evaluaciones.
- **Límite:** la IA extrae y sugiere. La aplicación financiera permanece en servicios
  determinísticos server-side.
- **Evidencia:** producción tiene **cero comprobantes**.

#### `GROW-004` — CRM, automatización comercial y monetización

- **Estado:** Ausente
- **Incluye:** decisión de CRM, nutrición, checkout, suscripción, facturación,
  habilitación posterior al pago y lifecycle del cliente.
- **Dependencias:** `GROW-001`, `GROW-002`, definición de precio, plan y cliente activo.
- **Evidencia (17 ago 2026):** **no hay checkout ni pasarela de ningún tipo.** La
  conversión la ejecuta una persona invocando `createTenantFromLead`.

#### `SUP-003` — SLA y escalamiento

- **Estado:** Ausente
- **Condición de entrada:** volumen sostenido, equipo de soporte y necesidad comprobada.
- **No construir una consola separada** hasta que la operación actual demuestre sus límites.

#### `FIN-CH-001` — Nuevos canales financieros

- **Estado:** Exploración
- **Opciones:** WhatsApp, estados bancarios y conectores.
- **Dependencias:** identidad, consentimiento, proveedor, costos, parser versionado,
  seguridad e idempotencia.

### EXPLORACIÓN

#### `MOB-003` — Aplicación multiplataforma o iOS nativa

- **Estado:** Exploración
- **No comprometer construcción** hasta demostrar que responsive o PWA no resuelven
  las tareas prioritarias.
- **Preguntas:** ¿qué rol justifica la app? ¿qué capacidad nativa es indispensable?
  ¿qué adopción sostiene dos superficies de producto?

#### `SUP-004` — Consola independiente o módulo revendible de servicio

- **Estado:** Exploración
- **Riesgo:** Vivaru ya tiene PQRS para residentes y soporte para clientes. Una tercera
  superficie puede duplicar dominios y confundir expectativas.
- **Condición de entrada:** demanda expresa, volumen y decisión sobre **cuál es la
  superficie canónica**.

#### `AI-ONB-001` — Mapeo asistido de columnas

- **Estado:** Exploración bloqueada por datos
- **No diseñar sobre supuestos.** Activar únicamente cuando `ONB-001` produzca evidencia.

---

## Áreas pendientes de evaluación sistemática

Forman parte del inventario, pero no tienen diagnóstico suficiente para asignarles
iniciativas concretas:

Residentes, unidades y sincronización de estados · administración multi-conjunto y
Superadmin · guardia, visitantes, QR y paquetería · reservas y espacios comunes ·
comunicaciones no asistidas · PQRS residencial · documentos y expedientes · auditoría
y observabilidad · SRI, fiscalidad y localización por país · accesibilidad,
rendimiento y calidad responsive · planes, suscripciones y billing SaaS ·
notificaciones web, correo y push · analítica operativa por conjunto.

---

## Observaciones de la revisión técnica del 17 de agosto de 2026

> **Esto son opiniones, no cambios de prioridad.** Priorizar es decisión de David; el
> inventario de arriba conserva su orden tal como él lo definió. Esta sección existe
> para que la discrepancia quede registrada y fechada en vez de perderse en un chat.

**1 · Hay seis P0 simultáneos en AHORA, y eso significa que no hay ninguno.**
`CORE-001`, `FIN-001`, `GROW-001`, `GROW-002`, `AI-GOV-001` y `AI-DATA-001`. Con el
tamaño de equipo actual, seis frentes fundacionales a la vez es una lista de deseos.
Convendría una secuencia explícita dentro del propio horizonte.

**2 · Ninguna iniciativa produce clientes, y casi todo depende de que existan.**
Cinco iniciativas —`AI-DATA-001`, `ONB-001`, `SUP-002`, `FIN-AI-001`, `AI-ONB-001`—
esperan datos reales. `GROW-001` y `GROW-002` son instrumentación **para** adquirir,
no adquisición. Activar conjuntos es trabajo comercial, no aparece en el tablero y por
tanto no lo posee nadie. **Es el bloqueo estructural del roadmap, y no es técnico.**

**3 · `AI-DATA-001` está etiquetado como bloqueado y su decisión no lo está.** Su
evaluación sí depende de datos, pero definir tenant piloto, volumen mínimo y periodo
de observación se puede decidir hoy. Marcarlo ⏸ lo hace parecer pasivo cuando es la
decisión de mayor apalancamiento: desbloquea cinco iniciativas.

**4 · `CORE-001` no se puede terminar tal como está escrito.** Su criterio de salida es
consolidar una lista de brechas: eso es una auditoría con entregable, no una
iniciativa con criterio de cierre. Como P0 vago competirá con los otros cinco y no
ganará nunca.

**5 · `AI-GOV-001` mezcla cosas de coste muy distinto.** Retención de `aiAssistance`,
`ticketId` en `aiFeedback` y desplegar `asistirTicketPqrs` son **horas de trabajo**.
Empaquetarlos con una auditoría de banderas los retrasa sin motivo.

---

## Preguntas abiertas

1. ¿Cuál será el primer tenant piloto para IA visible?
2. ¿Qué política de retención debe aplicar a `aiAssistance`?
3. ¿Qué volumen mínimo permite cerrar G7?
4. ¿Quién utiliza Vivaru desde móvil y para qué tareas?
5. ¿Qué define un trial activado y un cliente activo?
6. ¿Cuál será la fuente comercial canónica: Firestore, CRM u otra?
7. ¿Cómo se cobrarán planes, módulos premium y consumo?
8. ¿Cuándo existe volumen suficiente para SLA y consola de soporte separada?
9. ¿Qué conjuntos pueden aportar comprobantes, tickets y archivos reales autorizados?
10. ~~¿Notion será la fuente maestra o el repositorio?~~ **Resuelta el 17 ago 2026:**
    el repositorio manda, Notion es la vista publicada. Ver «Cómo se mantiene este
    documento».

---

## Reglas de priorización

Cada iniciativa nueva debe registrar: problema y resultado esperado · usuario y rol
afectados · fuente (cliente, prospecto, operación, riesgo, tendencia o estrategia) ·
evidencia disponible **y fecha de verificación** · alcance y alternativa más simple ·
dependencias técnicas, legales, operativas y de datos · riesgo de hacerla y de no
hacerla · esfuerzo relativo · horizonte y estado · criterio de entrada y de salida ·
decisión (priorizar, mantener, aplazar, experimentar o descartar) · justificación y
fecha de revisión.

> Una solicitud de prospecto aumenta la evidencia, pero **no determina por sí sola la
> prioridad**.

## Cadencia de actualización

- **Intake continuo:** registrar ideas sin prometer ejecución.
- **Revisión breve:** cuando llegue nueva evidencia, prospecto o tendencia.
- **Revisión mensual:** estados, bloqueos, dependencias y cambios de horizonte.
- **Revisión trimestral:** resultados estratégicos, capacidad y eliminación de
  iniciativas obsoletas.
- **Antes de comprometer desarrollo:** verificar repositorio y ambiente.
- **Después de cada decisión:** registrar qué cambió y por qué.

---

## Changelog

> **Lo más nuevo primero.** Cada entrada dice **por qué** cambió y **contra qué se
> verificó** — nunca qué líneas se movieron, que para eso está el diff de git.

### 0.2 — 17 de agosto de 2026, noche

**Por qué:** la versión 0.1 se escribió apoyándose en una inspección técnica de ese
mismo día, y en las horas siguientes cambió el estado de producción. El propio
documento advierte que ningún estado debe considerarse permanente sin revisión nueva;
esta es la primera aplicación de esa regla, a las pocas horas.

**Verificado contra:** repositorio en `1f3a86a`, y lectura directa de `hogaru-1` y
`vivaru-staging-02` (banderas, funciones desplegadas, conjuntos, colecciones).

- **`AI-GOV-001` pasa de cuatro puntos abiertos a tres.** La divergencia del catálogo
  de banderas está cerrada: `ai-pqrs-suggestions` estaba declarada desde su creación y
  **no gobernaba nada** — el panel de IA se pintaba siempre. Habría llegado a
  producción, donde su callable ni siquiera está desplegada, como un panel que revienta
  al pulsarlo.
- **El modo sombra de PQRS pasa de construido a corriendo en producción.** Dos triggers
  `ACTIVE` sin reintentos, tres banderas encendidas. Comprobado además que **no gasta
  donde no debe**: un ticket de prueba en un conjunto marcado `isExample` produjo la
  fila con motivo `sembrado` y cero llamadas al modelo.
- **Se elimina un riesgo que el roadmap no recogía:** producción corría funciones
  desplegadas desde `develop`, y cualquier despliegue desde `master` las habría
  borrado, porque Firebase elimina lo que no está en el código fuente. Se promocionó
  `develop` a `master`.
- **Se añaden cifras a las iniciativas bloqueadas**, para que «bloqueado por datos»
  deje de ser una etiqueta y sea un número: 7 de 9 conjuntos de producción son de
  ejemplo, los dos reales tienen 0 tickets, `importRuns` no tiene ni una fila con
  encabezados sin mapear, y no existe checkout de ningún tipo.
- **Se resuelve la pregunta abierta sobre la fuente de verdad.** El repositorio manda.
  El detonante fue concreto: editando la copia de Notion se sobrescribieron por
  accidente el título y el encabezado de propósito, y la recuperación dependió del
  historial de deshacer del editor.
- **Se añade la sección de observaciones sobre el orden**, separada del inventario y
  firmada, para que una discrepancia sobre prioridades quede fechada en vez de
  perderse en una conversación.

### 0.1 — 17 de agosto de 2026

Primera versión. Inventario inicial construido a partir de una inspección read-only
del repositorio y los ambientes, organizado en cuatro horizontes y siete frentes, con
reglas de priorización y cadencia de actualización.
