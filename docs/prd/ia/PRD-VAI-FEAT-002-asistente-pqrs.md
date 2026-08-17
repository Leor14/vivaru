# PRD-VAI-FEAT-002 — Asistente de PQRS

Clasificación, resumen y borradores para ayudar al administrador a responder
tickets **sin automatizar decisiones ni comunicaciones**.

Consolidada en el repositorio el 15 de agosto de 2026 desde la versión de Drive
(1 de agosto), incorporando todo lo que el programa midió desde entonces: el
gold set, las dos rondas de doble etiquetado, la vuelta de definiciones de
`priority`, la promoción de la plataforma a producción y las decisiones de
David del 15 de agosto. La copia de Drive queda como lectura; **la fuente de
verdad es este archivo.**

|  |  |
|---|---|
| ID | PRD-VAI-FEAT-002 |
| Tipo · Track | FEAT — funcionalidad asistida por IA · VIVARU |
| Módulo | PQRS |
| Usuario principal | `tenant_admin` / `admin_tenant` |
| Usuarios secundarios | Comité u operativos según RBAC; residentes y portería originan tickets |
| Responsable | David |
| Estado | **En piloto** — G0–G5 superadas (F2 corrida el 15 ago 2026) y **F3 cerrada el 17 de agosto de 2026** con la firma de la entrada de §9. El paso en curso es **F4**: la sombra está construida, desplegada a staging y vista clasificar un ticket real (17 ago); falta desplegarla a producción y decidir el tenant piloto de la parte visible. **Sin prerrequisitos vivos**: los tres cerrados |
| Dependencias | `PRD-VAI-PLAT-001` (**en producción desde el 15 ago 2026, inerte tras banderas**: gateway `aiInvoke`, `aiUsage`, cuotas, adaptador Vertex, `aiFeedback`, consola `/superadmin/flags`) · catálogos de `Ticket` (`src/types/domain.ts:141`) · variantes `con_sla`/`buzon_simple` (`src/lib/config/module-variants.ts:37`) |
| Riesgo | Medio-alto: contenido sensible, priorización, posible efecto legal o reputacional |
| Estado de datos | Gold set **construido**: 152 casos reales (84 MX · 60 EC · 8 sintéticos de inyección) en `datasets/pqrs/`. Producción tiene **0 tickets** (medido 14 ago 2026) — el dataset de despliegue lo fabrica el modo sombra |
| Fase comercial | Productividad administrativa en atención al residente |

## Decisión rectora (David, 15 de agosto de 2026)

**El criterio «recall de `high` ≥95%» se cobra en la puerta de escala (G7/Fase
5), no en la de lanzamiento.** Dos razones, las dos medidas:

1. **Hoy no es evaluable.** Dos anotadores que conocen el producto coinciden en
   los `high` 3 de 5 veces (ronda 2, 15 ago 2026; kappa de `priority` 0,47,
   corregido después y sin validar — la tercera ronda se aplazó a propósito).
   Contra una referencia así, cualquier cifra de recall es inventada.
2. **No hace falta para lanzar.** Toda salida del asistente es una sugerencia
   que el administrador confirma; todo `high` lleva revisión humana
   obligatoria; el editor manual sobrevive a cualquier fallo. El error de
   prioridad en el piloto cuesta una sugerencia ignorada, no un daño.

La exigencia no se elimina: se mueve a donde el error empezaría a costar. El
modo sombra (Fase 4) acumula, ticket a ticket real, la sugerencia del modelo
junto a la decisión final del administrador — esa comparación es la referencia
que hoy no existe, y contra ella se mide el 95% antes de escalar.

## Segunda decisión rectora (David, 15 de agosto de 2026, noche)

**La exactitud de `category` ≥90% se cobra también en la puerta de escala
(G7/Fase 5), no en la de lanzamiento.** La corrida de la Fase 2 la dejó en
**82,1%**, y la decisión no es rebajar la exigencia porque no se llegó: es
corregir una puerta que se fijó **sin saber qué decide el eje ni contra qué se
compara**. Las cuatro razones están medidas:

1. **`category` hoy es una constante en producción.** Todo ticket creado por el
   portal del residente nace con `category: "pqrs"` escrito a fuego
   (`src/features/pqrs/use-tickets.ts:129`); el residente elige `type`, no
   `category`. Y no la lee nadie: no aparece en `firestore.rules`, ni en
   `functions/`, ni en `/admin/pqrs` —esa pantalla filtra y muestra `type`—, ni
   la mira el SLA. Su único consumidor es un conteo agregado del reporte del
   comité (`src/features/reports/use-committee-report.ts:439`). **Es el hallazgo
   gemelo del de `type`, y llega por el mismo camino: mirar el producto, no el
   kappa.**
2. **El baseline real no es cero: es 61,4%, y el asistente sube 21 puntos.**
   Clasificar todo como `pqrs` —literalmente lo que hace el código hoy— acierta
   86 de los 140 casos evaluables del gold set. Medido sin buscarlo: es la cifra
   que dio la corrida en modo simulado, porque el simulador siempre contesta
   `pqrs`. Con su límite dicho: el gold set son dos edificios y sus frecuencias
   no son las del mercado, así que 61,4% es el clasificador trivial **sobre este
   conjunto**, no la exactitud de producción.
3. **El error cuesta poco y no es evitable por más prompt.** Toda salida la
   confirma el administrador y el único consumidor es un conteo. Y 19 de los ~25
   fallos son un patrón único —preguntas y sugerencias SOBRE un tema físico— en
   una frontera que κ 0,91 no validó: esos 20 casos salieron al azar, no de la
   frontera. Se intentó decírselo al modelo (`p3-frontera`) y **la frontera se
   giró en vez de afinarse**: +12 en `pqrs`, −11 en `maintenance`, y `type` cayó
   nueve puntos.
4. **El material es más difícil que el real.** El gold set son mensajes de
   WhatsApp sin asunto; un ticket trae `subject` **y** `message`. Es el límite
   que G2 ya declaraba.

**Dónde se cobra ahora:** la sombra de la Fase 4 acumula, ticket a ticket real,
la sugerencia junto a la categoría final que dejó el administrador. Contra esa
referencia se mide el ≥90% antes de escalar, igual que el recall de `high`. Es
la misma lógica de la primera decisión rectora: la exigencia no se elimina, se
mueve a donde el error empieza a costar.

### El candado: qué NO se mueve

Esta es **la segunda puerta que se desplaza a G7**, y sin un límite escrito la
tercera se movería igual. Las siguientes **no se tocan**, y ninguna se negocia
con una corrida:

- **Inyección 8/8.** Un solo caso que siga instrucciones del mensaje suspende.
- **`buzon_simple`: nulls siempre.** Es contrato de producto, no calidad de
  modelo — un fallo aquí es un defecto, no una métrica floja.
- **Revisión humana total**, y `needsHumanReview` obligatorio en todo `high`.
- **0 cambios automáticos** de estado, prioridad o categoría; el editor manual
  sobrevive a cualquier fallo.
- **0 acceso cruzado entre tenants.**

**Y la regla que las protege:** mover cualquier criterio de §9 exige una
decisión escrita **con la medición que la sostiene y una puerta posterior que la
recoja** — nunca la sola constatación de que no se alcanzó. Las cinco de arriba
no admiten ni eso.

## Clasificación y justificación de IA

Asistente acotado, **no un agente**: no selecciona herramientas ni ejecuta
acciones. Propone clasificación, resumen, tareas y un borrador dentro del
ticket abierto. Supera G0 porque el lenguaje de residentes mezcla mantenimiento,
cartera y PQRS en texto libre —los corpus lo confirman: 119 mensajes mexicanos
tocan tres temas o más— y las reglas por palabra clave ya demostraron sus
límites en este mismo repo (el tamiz de temas necesitó tres correcciones
medidas). La alternativa sin IA (plantillas, filtros, semáforo de antigüedad)
se mantiene como fallback y como baseline de comparación.

## 1 · Resumen ejecutivo

Añadir al drawer de detalle del ticket una asistencia bajo demanda que analice
asunto, mensaje e historial; sugiera `category`, `type` y `priority` cuando la
variante lo permita; resuma el caso; extraiga solicitudes y datos faltantes; y
genere un borrador de respuesta editable.

**El administrador acepta o corrige cada propuesta.** La IA no cambia `status`,
`priority`, `category`, `type`, responsable ni `responseHistory`; no envía
respuestas; no calcula obligaciones legales. La decisión que permanece humana
es todas: clasificar, priorizar, responder y cerrar.

## 2 · Problema y baseline

**Proceso vigente:** el residente crea el ticket con categoría y tipo; Vivaru
genera radicado y estados (`open` → `closed`); el administrador lee el detalle
y el historial en un drawer y responde. La variante `con_sla` pinta semáforo
de plazo; `buzon_simple` opera sin SLA ni categorías.

**Dolor:** lectura de texto libre, clasificación del residente que no
representa el caso (hasta el 15 ago 2026 el desplegable no enseñaba ninguna
definición y las que llevaba escritas estaban cruzadas — ver Prerrequisitos),
prioridad dependiente de señales dispersas, respuestas repetitivas, y
solicitudes escondidas en párrafos largos.

**Baseline cuantitativo — reformulado el 15 ago 2026.** La versión de Drive lo
dejaba TBD (volumen, tiempo de primera respuesta, reclasificaciones). Con
producción en **cero tickets** ese baseline no puede existir antes de lanzar:
**lo captura la instrumentación de sombra desde el primer ticket real** (Fase
4), no es precondición. Lo que sí es baseline hoy es el de clasificación: los
152 casos del gold set con etiquetas humanas revisadas por doble etiquetado.

## 3 · Usuarios, roles y permisos

| Rol | Ve | Puede | NO puede |
|---|---|---|---|
| `tenant_admin` · `admin_tenant` | El bloque de asistencia en tickets de su conjunto | Pedir asistencia, aceptar/corregir/ignorar cada sugerencia, editar el borrador, decidir estado y publicar | Delegar el envío a la IA; ver tickets de otro conjunto |
| `resident` · portería | Nada del asistente | Crear tickets por los flujos existentes | Ver análisis internos, prompts o borradores sin publicar |
| IA | Ticket e historial del tenant, vía servidor | Sugerir dentro de catálogos, resumir, extraer, redactar | Asignar responsables · cambiar fechas, SLA o estados · prometer solución, compensación, sanción o plazo · interpretar normas como asesoría legal · acceder a otro tenant |

## 4 · Objetivo, alcance y exclusiones

**Objetivo del MVP:** comprender y responder un ticket con un bloque
estructurado y un borrador editable, limitado a la información del ticket y su
historial.

**Incluido:** resumen · sugerencia de `category` y `type` en `con_sla` ·
sugerencia de `priority` con `priorityReason` y `needsHumanReview` · solicitudes
explícitas, datos faltantes y próximos pasos no ejecutables · borrador claro y
no confrontativo · regeneración limitada con instrucciones predefinidas ·
feedback (aceptar/editar/descartar/incorrecto) · versionado de prompt, esquema
y modelo · **registro en sombra de sugerencia + decisión final** (Fase 4).

**Fuera de alcance:** chatbot para residentes · envío o cierre automático ·
cálculo jurídico de términos (el SLA de 15 días hábiles ya tiene su propio
hallazgo legal en `docs/pendientes.md` — la IA no lo toca) · RAG sobre
reglamentos · adjuntos · asignación automática · predicción ML.

## 5 · Flujo funcional

```mermaid
flowchart LR
A[Ticket e historial del tenant] --> B[Reglas: rol, variante, estado]
B --> C[Gateway aiInvoke: operación PQRS]
C --> D[Validación de esquema y catálogos]
D --> E[Administrador revisa sugerencias]
E --> F{Decisión humana}
F -- Corregir --> G[Edita clasificación, tareas o borrador]
F -- Descartar --> H[Continúa manual]
F -- Usar --> I[Confirma y envía]
I --> J[Servicio PQRS persiste historial y estado]
```

**Experiencia:** sugerencias separadas de los campos confirmados, nunca
preseleccionadas en silencio; el mensaje original y `responseHistory` siempre
visibles; en `buzon_simple` se oculta la clasificación no aplicable; el editor
normal funciona con la IA apagada o caída. El prompt debe separar «el ticket»
de «el historial»: la ronda 1 midió que hasta un humano etiqueta la
conversación en vez del mensaje cuando el hilo va delante.

## 6 · Frontera reglas / IA / persona

- **Reglas Vivaru:** permisos, tenant, variante, estados, SLA, catálogos.
- **IA:** resume, clasifica dentro de catálogos, extrae, redacta. Nada más.
- **Administrador:** confirma `category`, `type`, `priority`, `status` y la
  respuesta. Todo.
- **Servicio PQRS:** persiste solo después de la acción humana.
- **Dashboard:** antigüedad y alertas con fechas y reglas, no con IA.

## 7 · Contrato de datos y multi-tenancy

**Entrada permitida:** `ticketId` y `tenantId` resueltos en servidor; campos
del ticket (`category`, `type`, `subject`, `message`, `priority`, `status`,
radicado); el `responseHistory` necesario; variante e idioma; `unitLabel`
enmascarado cuando baste.

**Excluido del MVP:** adjuntos, información financiera completa, tickets no
relacionados, datos de otros residentes o tenants.

**Salida estructurada (contrato con el gold set):** `summary` ·
`suggestedCategory` (`pqrs`/`maintenance`/`billing`; **null en `buzon_simple`**)
· `suggestedType` (cinco valores; **null cuando no aplique**) ·
`suggestedPriority` (`low`/`medium`/`high`) · `priorityReason` ·
`needsHumanReview` · `requests` · `missingInformation` · `nextSteps` ·
`draftResponse` · `safetyFlags` (`amenaza`, `dato_sensible`,
`lenguaje_ofensivo`, `posible_urgencia`) — solo banderas. **El enfado no sube
la prioridad: se refleja en banderas** (decisión del 15 ago 2026, caso
`MX#3441` de la vuelta de definiciones).

**Persistencia:** objeto `aiAssistance` separado del `Ticket`; nada se
sobrescribe sin confirmación. En sombra, `aiAssistance` guarda la sugerencia
completa y, al resolverse el ticket, la decisión final del administrador queda
al lado — ese par es el dataset de la Fase 5. Feedback en `aiFeedback` como en
comunicaciones. PII redactada en telemetría; retención según el cron ya
desplegado.

**Construido el 17 de agosto de 2026** (`functions/src/ai/sombra-pqrs.ts`):
colección de primer nivel `aiAssistance`, **un documento por ticket con el
`ticketId` de identificador**. «Separado del `Ticket`» resultó tener una razón
concreta que la PRD no decía: `firestore.rules` deja al **residente** leer su
propio ticket, así que un campo ahí dentro sería visible para quien lo escribió
y la sombra dejaría de serlo el día que se encienda. La regla es la de
`aiUsage`: `read: superadmin`, `write: false`.

**Esta colección sí guarda contenido del conjunto** —el resumen y el borrador
propuestos—, a diferencia de `aiUsage` y `aiFeedback`, donde la regla del Paso 0
es que no haya dónde meterlo. No es una excepción sino su límite: aquella
prohíbe contenido en la telemetría **agregada**, y esto es el conjunto de
evaluación que G7 mide ticket a ticket. Quien puede leerlo ya podía leer el
ticket entero.

**El `ticketId` como identificador resuelve además dos cosas de paso:** da
idempotencia frente a la entrega doble de los triggers de Firestore —lo que
impide pagar dos veces por el mismo ticket— y cubre el hueco de que la fila de
`aiFeedback` no guarde `ticketId` y por eso no se pueda cruzar con nada.

**Aislamiento:** consulta por `tenantId` impuesto en servidor (las reglas de
Firestore no bastan con Admin SDK — restricción del documento de estrategia);
sin memoria entre tickets; sin ejemplos cruzados entre tenants.

## 8 · Contrato de IA

- Tarea: clasificación cerrada + resumen + extracción + redacción, una llamada.
- Modelo: el proveedor único del programa vía `PRD-VAI-PLAT-001`; salida
  estructurada validada contra los catálogos de `Ticket` **antes** de persistir.
- Rechazo: ante ambigüedad o datos faltantes, `needsHumanReview: true` y no
  inventar. Ticket sin hilo previo: es exactamente el caso donde la prioridad
  es más difícil (hallazgo de la taxonomía) — preferir `needsHumanReview` a
  arriesgar.
- Prompt injection: el mensaje del residente es dato, nunca instrucción; sin
  herramientas habilitadas; los 8 casos sintéticos del gold set son la prueba.
- Timeout, cuota, reintento, kill switch: PLAT-001. Fallback: editor manual y
  plantillas.
- Versionar prompt, esquema y modelo (`operationVersion`, como comunicaciones).
- No citar políticas, leyes o hechos que no estén en la entrada.

## 9 · Evaluación y criterios de aceptación

**Dataset: el gold set real de `datasets/pqrs/`** — 152 casos de dos corpus
reales más 8 de inyección fabricados; se edita `etiquetas.tsv` y se regenera;
protegido por `functions/tests/pqrs-goldset.test.ts` (217 tests en verde).
Estado por eje, medido y no supuesto:

| Eje | Estado | Papel en la evaluación |
|---|---|---|
| `category` | **Validado** (κ 0,91) · medido **82,1%** (15 ago 2026) | **Se reporta en el lanzamiento; la exactitud se cobra en G7 contra la sombra** (decisión de David del 15 ago 2026 — abajo). Se mide también por clase (`billing` solo tiene 15 casos: su cifra se reporta con ese caveat, no se esconde) |
| `tema` | **Validado** (κ 0,89) | Informativo (no es contrato de `Ticket`) |
| `type` | Corregido sin validar (0,53) | **Descriptivo, no bloquea**: no decide nada en el código (pinta etiqueta y llena un filtro). Se reporta |
| `priority` | Corregido sin validar (0,47) | **Se reporta, no bloquea el lanzamiento.** Guardrail de runtime: `needsHumanReview` obligatorio en `high`. El 95% vive en la puerta de escala |
| `safetyFlags` / inyección | 8 casos sintéticos | **Puerta dura: 8/8** — un solo caso que siga instrucciones del mensaje suspende |
| `buzon_simple` | **12 casos** (15 ago 2026) | **Puerta dura: nulls siempre. Medida 12/12 en las tres versiones** |

**Criterios de lanzamiento (Fases 2–4):**

- 100% de respuestas requieren envío humano; 0 cambios automáticos de estado,
  prioridad o categoría; 100% de fallos conservan el editor manual.
- ~~Exactitud de `category` ≥90% en el gold set.~~ **Movida a G7 el 15 de
  agosto de 2026** — ver «Segunda decisión rectora». En el lanzamiento se
  reporta y no bloquea.
- Inyección: 8/8. `buzon_simple`: nulls siempre.
- ~~0 promesas, plazos o hechos no sustentados en los casos que se lean a mano
  en la Fase 2 y en la sesión de la Fase 3.~~ **Reformulado el 17 de agosto de
  2026: lo cumple el SISTEMA, no el modelo** — ver el registro de decisiones. El
  modelo se queda en **6,6%** (10 de 152 con el criterio congelado) y el prompt
  dejó de ser la palanca: 8 de esos 10 son «estamos verificando» o «estamos
  revisando», las palabras exactas que la propia regla dura cita como
  prohibidas. El 0% lo garantizan tres mecanismos deterministas, y se comprueban
  por separado: la comprobación de contrato del servidor fuerza
  `needsHumanReview` (`20e341f`), ninguna respuesta sale sin que una persona la
  envíe, y la frase marcada se resalta dentro del borrador (`d08ec7c`).

  **Alcance, porque las dos cosas se confunden y no son la misma:** lo prohibido
  es **afirmar acciones** de la administración que no consten en el historial.
  El **compromiso futuro** —«procederemos a revisar»— lo permite la regla dura
  («dice qué se hará»), y su subida de 45 a 59 casos entre v1 y v2 es la
  conducta desplazándose a la forma buena, no un empeoramiento. Sigue prohibido
  prometer solución, compensación, sanción o plazo.
- 0 acceso cruzado entre tenants (pruebas negativas).
- Costo por asistencia medido y dentro de presupuesto (§10).

**Criterios de escala (Fase 5)** — los dos **contra la referencia acumulada por
la sombra** (sugerencia vs decisión real del administrador), que es la única que
mide sobre tickets de verdad:

- **Recall de `high` ≥95%**, con la definición de `priority` validada por esa
  misma acumulación o por la tercera ronda si se retoma (plan escrito en
  `datasets/pqrs/doble-etiquetado/definiciones-priority-2026-08-15.md`).
- **Exactitud de `category` ≥90%** (movida aquí el 15 ago 2026). La sombra da
  además la señal que el gold set no puede dar: **cuántas veces el
  administrador corrige la categoría sugerida.** Si la corrige poco, la
  frontera del gold discrepaba del producto y el 82,1% estaba midiendo el
  desacuerdo, no el error; si la corrige mucho, el modelo falla de verdad y la
  palanca son ejemplos de contraste desde el corpus.

## 10 · Economía y consumo

- Unidad: una asistencia por ticket + regeneraciones limitadas (contador, como
  comunicaciones). Nunca en render automático.
- **Referencia real, no estimada:** las operaciones de comunicaciones sobre el
  mismo gateway cuestan ~USD 0,0003–0,0008 por llamada (204 llamadas = USD
  0,065; sesión de 4 llamadas = USD 0,0026). Una asistencia de PQRS con
  historial será del mismo orden; **la cifra exacta la da la corrida de la
  Fase 2 sobre los 152 casos** (~USD 0,05–0,15 estimados la corrida completa).
- Guardrails vigentes: presupuesto de IA con alerta (80.000 COP, solo alertas
  para el proyecto — regla de consola en `docs/pendientes.md`), cuotas por
  tenant de PLAT-001, techo 2–3% del ingreso por conjunto con alerta al 5%
  (documento de estrategia).
- Escenario de abuso: tickets muy largos y regeneración compulsiva — límite de
  caracteres, historial resumido, contador de regeneraciones.

## 11 · Arquitectura y dependencias

- Drawer de detalle del ticket (admin) + bloque de asistencia plegado, patrón
  del panel «Redactar con IA» de comunicaciones.
- Operación nueva sobre el gateway existente (`functions/src/ai/`), con
  `operationVersion` propio. **Sin infraestructura nueva.**
- **Callable propia, no `aiInvoke`** (F3, 15 ago 2026): `asistirTicketPqrs`
  recibe `{ticketId}` y **el servidor** lee el ticket, resuelve la variante desde
  `tenantSettings` y arma la entrada. Con la puerta genérica el navegador tendría
  que afirmar `mensaje`, `historial` y `variante` — y `variante` es lo que decide
  la puerta dura de `buzon_simple`. `runGateway` gana un enganche `resolveInput`
  que corre después de autorizar y antes de cobrar cuota; rol, banderas, cuota y
  telemetría **no se duplican**.
- Bandera propia **`ai-pqrs-suggestions`** (`defaultEnabled: false`) +
  `ai-gateway` + kill switch, overrides por tenant en `featureFlagOverrides` —
  todo ya operativo en `/superadmin/flags`. **Ojo:** hasta el 15 de agosto de
  2026 este documento la llamaba `ai-pqrs-assist`, que no existe; el nombre real
  es el del catálogo (`src/lib/feature-flags/catalog.ts`). Y el interruptor que
  se olvida es otro: **`ia-proveedor-real`**, apagada en staging — sin ella el
  proveedor es simulado y contesta siempre `pqrs`.
- Firestore: `aiAssistance` (nuevo, por ticket) y `aiFeedback` (existente).
- Trampas conocidas al desplegar: callable nueva sin `run.invoker` (comprobar
  siempre) y `callableCorsOrigins`.

**Frontera anti-doble-conteo:** gateway, proveedor, cuotas y telemetría son
PLAT-001. Esta PRD cubre UX del ticket, contexto, catálogos, confirmación,
sombra, feedback y métricas de producto.

## 12 · Seguridad, riesgos y mitigaciones

Las diez de la versión de Drive siguen vigentes (alucinación → salida
estructurada + revisión; contenido sensible → minimización y rol; injection →
mensaje como dato + 8/8; efecto legal → no calcular términos; cross-tenant →
consulta filtrada + pruebas negativas; sobrecosto → bajo demanda + límites;
proveedor → versionado; falla → editor manual). Se añaden dos medidas:

- **Parada en seco** (hoja de ruta): fuga entre conjuntos, acción sensible sin
  confirmación, secretos expuestos, costo disparado o salidas sistemáticamente
  falsas → kill switch, sin discusión.
- **No prometer antes de medir:** «IA» no entra al landing ni al material
  comercial general hasta pasar G6. Para tenants piloto se puede decir
  «asistente en piloto», que es verdad.

## 13 · Despliegue y fases — renumeradas el 15 de agosto de 2026

| Fase | Qué es | Puerta | Estado |
|---|---|---|---|
| **F1 — Gold set y taxonomía** | 152 casos, taxonomía con árbol de `type` y preguntas ordenadas de `priority`, dos rondas de doble etiquetado + vuelta de definiciones | G2 | **HECHA** (15 ago 2026) |
| **F2 — Evaluación offline** | Operación PQRS sobre el gateway; corrida contra el gold set; criterios de lanzamiento de §9; costo real por asistencia | G4 + G5 | **HECHA** (15 ago 2026). Operación `pqrs-asistir` construida y prerrequisito cerrado (12 casos `buzon_simple`). Inyección 8/8, nulls 12/12, guardrail 32/32; `category` 82,1% (baseline 61,4%) **movida a G7**. **USD 0,001 por asistencia.** Prompt activo: `p1-minima`. Lectura en `datasets/evaluacion/resultados/2026-08-15-pqrs-evaluacion-offline.md` |
| **F3 — Piloto simulado en staging** | Tenant de staging sembrado con 20–30 tickets cuyo texto sale de los corpus reales (voz real, canal simulado — los sintéticos de modelo quedan descartados por la hoja de ruta); sesión guiada con un administrador, guion como el de comunicaciones; mide el circuito de producto: resumen útil, borrador aceptado/editado, `needsHumanReview` donde debe | G6 (parte 1) | **HECHA (17 ago 2026).** La sesión se corrió, los tres bloqueos cayeron —resaltado de la frase (`d08ec7c`), «sin prioridad» como estado real del selector (`e2686f8`) y la v2 desplegada a staging— y el último pendiente, la entrada de §9, quedó firmada el 17. Detalle de lo construido: **En curso (15 ago 2026). Código construido y en verde; falta el ambiente.** Hecho: callable `asistirTicketPqrs`, bloque de asistencia en el drawer, **editor de clasificación** (prerrequisito 3, encontrado al construir la pantalla), feedback de `pqrs-asistir` sobre `aiFeedback` con el par sugerida/guardada, y `seed-pqrs-piloto.mjs` con 24 casos fijos (16 `con_sla`, 6 `buzon_simple`, 2 de inyección; 4 con respuesta previa). Pendiente: desplegar a staging, sembrar y la sesión. **Si la sesión usa al tercer administrador, primero se le toma la línea base de comunicaciones a ciegas** — al revés se quema |
| **F4 — Producción: sombra + piloto visible** | Sombra global (clasifica en silencio, guarda sugerencia + decisión final); sugerencias visibles solo para tenants piloto por bandera. **Desde el primer ticket real, el dataset de despliegue se fabrica solo** | G6 (parte 2) | **La sombra está construida (17 ago 2026, `f1fea59`) y NO desplegada.** Dos triggers propios sobre `tickets` (`sombraPqrsAlCrearTicket`, `sombraPqrsAlActualizarTicket`), colección `aiAssistance` con su regla, y `ai-pqrs-shadow` apagada en los dos ambientes. Falta: desplegar, encender y ver la primera fila. Tenant piloto de la parte visible: sin decidir (David, 15 ago) |
| **F5 — Escala** | Abrir por plan y variante. Aquí se cobra el recall ≥95% contra la referencia de la sombra, y el costo dentro del 2–3% | G7 | — |

**Rollback en cualquier fase:** apagar la bandera. Tickets, historial, editor,
estados y alertas siguen operando sin migración.

## Prerrequisitos vivos (fuera de esta PRD, la bloquean)

1. ~~**El desplegable del residente enseña las definiciones cruzadas** y no
   ofrece `other`.~~ **CERRADO el 15 de agosto de 2026**
   (`src/app/(resident)/resident/pqrs/page.tsx`). Las cinco definiciones quedan
   alineadas con `datasets/pqrs/taxonomia.md` —persona (queja) contra servicio
   (reclamo)— y `other` se ofrece como «General», el mismo rótulo que ya usaban
   las dos pantallas del administrador.

   **Y el defecto era mayor de lo que este punto decía: las descripciones no se
   renderizaban.** El `map` de los botones pintaba solo `label`; el campo
   `description` llevaba muerto desde siempre. Así que el residente no leía la
   definición equivocada — no leía ninguna, y elegía entre cuatro palabras
   desnudas. Envenenaba la sombra igual, pero por ruido y no por engaño.
   **Corregir solo las cadenas habría dejado la pantalla idéntica**, con el
   arreglo dado por bueno. Ahora se muestran, y la precedencia del árbol
   —«reportar manda sobre pedir», la regla que el kappa tumbó dos veces con
   anotadores que conocen el producto— va escrita arriba del grupo, porque
   pedirle a un residente que la deduzca es peor que pedírselo a un anotador.

   **Tercer hallazgo, que no estaba en ningún documento: en `buzon_simple` todo
   ticket nacía con `type: "petition"`.** El selector se oculta en esa variante,
   pero el estado inicial se enviaba igual — una etiqueta falsa con apariencia
   de elección humana, justo en el eje donde la PRD exige nulls como puerta
   dura. Ahora no se envía `type` y `createTicket` cae a su default `other`
   (decisión de David, 15 ago 2026).
2. ~~**`buzon_simple` sin casos en el gold set.**~~ **CERRADO el 15 de agosto de
   2026:** 12 casos declarados (7 MX, 5 EC) con una columna opcional `variante`
   en `etiquetas.tsv`. Elegidos evitando `billing`, `high` y los casos ancla de
   la taxonomía. Los nulls se midieron 12/12 en las tres versiones.
3. ~~**El administrador no podía confirmar ni corregir la clasificación, y eso
   dejaba sin suelo a las DOS puertas de G7.**~~ **CERRADO el 15 de agosto de
   2026, al construir la pantalla de F3.**

   Encontrado por el mismo camino que el desplegable: mirando el producto. Al ir
   a pintar las sugerencias no había dónde aceptarlas. Medido, no supuesto:
   `category` nacía constante; `type` lo elegía el residente y el drawer lo
   enseñaba de solo lectura; y **`priority` no se escribía nunca** —
   `createTicket` no la pone, ninguna pantalla del administrador la enseña y
   ningún servicio la cambia; todas las prioridades del repositorio pertenecen al
   módulo de soporte del superadministrador, que es otra colección. El campo solo
   existía en el tipo de TypeScript.

   **Lo que rompía no era la pantalla.** Las dos puertas movidas a G7 el 15 de
   agosto se cobran «contra la referencia acumulada por la sombra: sugerencia vs
   **decisión real del administrador**». Esa decisión no existía en ningún sitio
   del producto, así que la sombra de la Fase 4 habría acumulado sugerencias
   contra un hueco y en G7 las dos puertas seguirían siendo tan inmedibles como
   hoy — justo lo que el candado se escribió para evitar.

   **Decisión de David (15 ago 2026): los tres ejes editables en F3.** El editor
   vive en el cuerpo del drawer con el estilo normal, **fuera** del panel de IA,
   porque son campos confirmados y §5 pide distinguirlos de lo que propuso una
   máquina; «usar esta clasificación» los rellena y guardar sigue siendo un acto
   humano. Escribe además `classifiedAt`/`classifiedBy`, para que la sombra sepa
   si alguien llegó a tocar la clasificación — `updatedAt` no sirve, se mueve
   también al responder.

## Lo que la Fase 2 no midió y la Fase 3 sí verá

**El `historial` de producción es el contrario del que midió la evaluación
offline.** En el gold set, los 18 casos con contexto previo lo traen escrito por
el **residente** (son hilos de WhatsApp). En el producto, `responseHistory` lo
escribe **solo la administración**: `respondTicket` es el único que escribe ahí y
el residente no tiene por dónde añadir; sus palabras viven únicamente en
`subject` y `message`.

La regla dura del prompt —«clasifica EL MENSAJE; el historial sirve para
entenderlo»— se afinó contra lo primero y en producción recibe lo segundo. Se
mapea **fiel al producto**, que es lo que habrá en la sombra, y el sembrado del
piloto incluye cuatro tickets con respuesta previa para que esa forma de entrada
se vea con ojos humanos en la sesión en vez de descubrirse en la Fase 4.

## Puertas

| Puerta | Estado | Evidencia |
|---|---|---|
| G0 Necesidad | **Superada** | Texto libre multi-tema medido en corpus; reglas por palabra ya fallaron tres veces en este repo |
| G1 Valor | **Superada, reformulada** | Baseline de clasificación: el gold set. Baseline operativo: lo captura la sombra desde el primer ticket real (producción hoy: 0 tickets, medido) |
| G2 Datos | **Superada** | Gold set 152 casos reales; límite dicho: son WhatsApp, no tickets de producto |
| G3 Riesgo | **Superada** | Revisión humana total, fallback, kill switch, parada en seco |
| G4 Evaluación | **Superada, reformulada** | Fase 2 corrida el 15 ago 2026: inyección 8/8, `buzon_simple` 12/12 y guardrail de `high` 32/32. `category` 82,1% sobre un baseline real de 61,4%, **movida a G7** por la segunda decisión rectora |
| G5 Economía | **Superada** | Cifra propia medida: **USD 0,001 por asistencia** (456 llamadas, USD 0,45), del orden de comunicaciones |
| G6 Piloto | Pendiente | Fases 3–4 |
| G7 Escala | Pendiente | Fase 5 — aquí vive el 95% |

## Definición de terminado (MVP)

- El asistente respeta la variante; en `buzon_simple` no clasifica.
- Sugerencias separadas de campos confirmados; nada cambia sin acción humana.
- Resumen y borrador fieles al ticket y al historial.
- El editor manual funciona con la IA apagada.
- Calidad, edición, costo y uso observables por tenant (`aiUsage`, `aiFeedback`, `aiAssistance`).
- La sombra registra sugerencia + decisión final desde el primer ticket real.

## Registro de decisiones

| Fecha | Decisión | Quién |
|---|---|---|
| 15 ago 2026 | El recall ≥95% de `high` se cobra en G7 (escala), no en el lanzamiento; en el piloto rige el guardrail de revisión humana | David |
| 15 ago 2026 | El enfado no sube `priority`; va en banderas (`MX#3441`) | David |
| 15 ago 2026 | `type` queda descriptivo: no decide nada en el código; su kappa no bloquea | David (confirmó «van al mismo lado») |
| 15 ago 2026 | Tercera ronda de kappa de `priority` aplazada; plan escrito por si se retoma | David |
| 15 ago 2026 | Primero staging; el tenant piloto de F4 se decide después | David |
| 15 ago 2026 | **La exactitud de `category` ≥90% se cobra en G7 contra la sombra, no en el lanzamiento.** `category` nace constante en producción y no la lee nadie salvo un conteo; el baseline real es 61,4% y el asistente da 82,1%. Con candado: cinco criterios que no se mueven y una regla para mover los demás | David |
| 15 ago 2026 | `p1-minima` queda como prompt activo: gana en cuatro de cinco ejes y la taxonomía dentro del prompt no paga su costo | Evaluación offline |
| 15 ago 2026 | Los checks automáticos de inyección de `SYN#4` no juzgan `priority`: el valor atacado coincide con una respuesta defendible. Ese eje va a la lectura a mano | Evaluación offline |
| 15 ago 2026 | En `buzon_simple` el ticket ya no nace `petition`: no se envía `type` y queda `other`. En la variante donde el tipo no aplica, una etiqueta que nadie eligió es peor que ninguna | David |
| 15 ago 2026 | **El administrador pasa a poder fijar y corregir los tres ejes.** Sin un sitio donde ocurra la decisión humana, la sombra de F4 acumula sugerencias contra un hueco y las dos puertas de G7 no se pueden medir. Es el cuarto prerrequisito encontrado mirando el producto | David |
| 15 ago 2026 | En F3 no se persiste `aiAssistance`: la sesión deja rastro en `aiFeedback` con el par sugerida/guardada, y el registro de sombra se diseña en F4 con lo que la sesión enseñe | David |
| 15 ago 2026 | El borrador se enseña y se copia al cuadro de respuesta, con un aviso que nombra la cifra medida (44 de 152 afirmaban acciones no tomadas). Publicar sigue siendo un segundo clic deliberado | David |
| 15 ago 2026 | El piloto siembra las dos variantes en conjuntos separados: la puerta dura de nulls se ve en pantalla, no solo en el evaluador | David |
| 17 ago 2026 | **La sombra no pasa por `runGateway`: se extrae el tramo de ejecución y hay dos puertas.** La puerta exige sesión, membresía y App Check, y la sombra no tiene ninguna. Fabricar un usuario falso metería una excepción en la única comprobación de seguridad del programa; un camino propio duplicaría cuota, validación y telemetría. Y hay un motivo que obliga: la bandera de la operación es `ai-pqrs-suggestions`, la que hace VISIBLE la sugerencia — pasar por la puerta ataría la sombra a la sugerencia visible, lo contrario de F4 | David |
| 17 ago 2026 | **La sombra no corre en `buzon_simple`, y se anota el motivo.** Ahí la pantalla no pinta el editor de clasificación, así que no existe decisión del administrador que capturar: sin decisión no hay par, y el par es lo único que la sombra fabrica. El hueco queda explicado en la propia colección, no se deduce | David |
| 17 ago 2026 | **La sombra consume la cuota del conjunto pero no tiene tope por usuario.** Los topes del conjunto existen para que uno desbocado no se coma el presupuesto de todos, y su gasto es gasto del conjunto; el de 20 por usuario y día se convertiría en un techo de 20 tickets diarios, perdiendo dataset **en silencio** a partir del 21 | David |
| 17 ago 2026 | **La decisión del administrador se anota en cada cambio y se congela al resolverse**, no solo al cierre como decía la letra de §7. Un ticket con SLA puede vivir semanas abierto: esperar al cierre dejaría fuera casi todo lo que se clasifica en un piloto. G7 mide contra las congeladas | David |
| 17 ago 2026 | **El «0 afirmaciones no sustentadas» de §9 lo cumple el SISTEMA, no el modelo — y por eso el criterio se cobra en la puerta de salida.** Medido: la v2 bajó las afirmaciones de acción de 21,1% a 6,6% (10 de 152, criterio congelado) y ahí se detuvo — **8 de esos 10 son «estamos verificando» o «estamos revisando», las palabras exactas que la propia regla dura cita como prohibidas**. El prompt dejó de ser la palanca. El 0% lo garantizan tres mecanismos deterministas: la comprobación de contrato en el servidor fuerza `needsHumanReview` (`20e341f`), ninguna respuesta sale sin que una persona la envíe, y la frase marcada se resalta **dentro** del borrador y se nombra en el aviso (`d08ec7c`). Alcance: lo prohibido es afirmar acciones que no consten en el historial; **el compromiso futuro —«procederemos a revisar»— lo permite la regla dura** («dice qué se hará»), y su subida de 45 a 59 es la conducta desplazándose a la forma buena. Misma lógica que las dos decisiones rectoras: la exigencia se mueve a donde se puede cumplir de verdad, no se rebaja. **Límite dicho: el aviso general ya se probó con una persona y publicó literal igual** — por eso el mecanismo que cuenta es el resaltado, y nadie lo ha visto pintado todavía | David |
| 17 ago 2026 | **Lo sembrado no entra en el conjunto de evaluación de la sombra.** Si el ticket o su conjunto traen `isExample`, se omite con motivo `sembrado` y no se paga. Encontrado al probar la sombra en staging: los tickets de `seed-pqrs-piloto.mjs` no llevaban la marca y el conjunto tampoco, así que una resiembra habría metido 16 casos inventados en la referencia contra la que se cobran las DOS puertas de escala —y pagado USD 0,014 por clasificarlos—. Es el defecto que ya infló un baseline dos veces, en el sitio donde sale más caro: un gold set envenenado se detecta, una referencia de despliegue envenenada parece que funciona | David |
| 17 ago 2026 | **La sombra dispara solo al crear el ticket, no al editarlo.** El residente puede editar el suyo; reclasificar cada edición multiplicaría el gasto y mediría otra cosa. Lo que se guarda es la clasificación del ticket tal como llegó, que es lo que el administrador tuvo delante. Límite conocido, escrito en el código | David |
