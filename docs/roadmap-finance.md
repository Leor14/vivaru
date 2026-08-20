# Vivaru Finance — base de roadmap del módulo financiero

Documento de trabajo para cuando se decida arrancar el módulo. Adapta el
**Documento Rector v2** (Word, 17 de agosto de 2026) corrigiendo lo que no quedó
suficientemente cimentado y añadiendo lo que se pudo medir contra el código y los
ambientes.

**Se mantiene la estructura de tres zonas** del roadmap de producto: el estado se
reescribe arriba, el cuerpo se edita en su sitio, y solo el changelog acumula. El
porqué está en `docs/roadmap-producto.md`.

---

## Estado de esta revisión

| Campo | Valor |
|---|---|
| **Versión** | 0.3 |
| **Fecha** | 20 de agosto de 2026, madrugada |
| **Base** | Documento Rector v2 (Word), fortalecido con verificación directa |
| **Verificado contra** | Repositorio en `c81e2fe` y proyecto `hogaru-1` (producción). `FIN-000` y `FIN-001` leídas como desplegadas y validadas; `ReconciliationCase` buscado en el código: **cero apariciones**; `realSriTransport` buscado: **no existe**, solo el stub |
| **Estado del módulo** | **NO congelado. La etiqueta era falsa y esta revisión la retira.** F0 y F0b están **en producción**; F1 es lo siguiente y **no lo bloquea nadie**; F2 y F3 esperan clientes, no personas. **Y el frente fiscal deja de bloquear porque sale del alcance** — ver §5 |

**Qué cambió en esta revisión:**

- **Lo fiscal sale del alcance por decisión de David**, y con ello **el módulo deja de
  estar congelado**. Ver §5.
- **F0 y F0b pasaron de «se puede empezar hoy» a estar en producción** — este documento
  es del 17 y no lo sabía.
- **Se separa lo que bloquea una persona de lo que bloquea la ausencia de clientes.**
- Corregido: **no hay dos conjuntos reales, hay cero.**

**Qué aporta esta versión sobre el Documento Rector v2:**

- **Su tarea P0.1 —«mapear todas las rutas que aplican un pago»— está hecha.** Son
  dos, y producen efectos distintos.
- Los defectos pasan de descripción genérica a **defecto nombrado con archivo,
  línea y modo de fallo**.
- La línea base deja de ser «pendiente de medir» y pasa a ser **un número: cero**.
- Se corrige un riesgo mal enfocado (Storage) y se añaden tres que no estaban.

**Lo que NO cambia, porque está bien:** la tesis de tres capas, la separación
percepción/decisión/ejecución, la máquina de estados, el contrato de extracción por
campo con evidencia, los gates G0–G7 y la decisión de no fijar precio.

---

## 1 · Qué se verificó del Documento Rector v2

Es el documento mejor cimentado del proyecto. Se comprobaron sus afirmaciones
concretas y **todas se sostienen**:

| Afirmación | Resultado |
|---|---|
| Los 10 archivos citados en trazabilidad | **Los 10 existen** |
| PostHog en el stack | Real (`posthog-js ^1.376.2`) |
| Next 16.1.6 · React 19.2 · TS 5 | Exacto |
| SRI es un stub de transporte | Correcto |
| Extracción de recibos: bandera sin flujo | Correcto |
| Aplicación de pagos no atómica | **Correcto, y peor de lo descrito** |

Su mérito principal es de método: **corrigió sus propias suposiciones con evidencia
del código** en vez de acumularlas. Es lo contrario de lo que hicieron otros
documentos de este repositorio, que envejecieron afirmando cosas que dejaron de ser
ciertas.

---

## 2 · Línea base medida — el dato que cambia las prioridades

El Documento Rector dice, con honestidad, que «el repositorio muestra capacidades,
no volúmenes operativos reales» y que antes del piloto deben medirse comprobantes al
mes, minutos por revisión y porcentaje de excepciones. **Se midió.**

Producción (`hogaru-1`), 17 de agosto de 2026:

| Colección | Total | En conjuntos de ejemplo | **Datos propios reales** |
|---|---|---|---|
| `billingStatements` | 220 | 196 | **0** |
| `paymentReceipts` | 5 | 5 | **0** |
| `ledgerEntries` | 86 | 74 | **0** |
| `expenses` | 52 | 36 | **0** |
| `paymentVouchers` | **0** | 0 | **0** |
| `financialCounters` | **0** | 0 | **0** |

Los 24 cobros, 12 asientos y 16 gastos que aparecían en los conjuntos que entonces se
tomaron por «reales» son **siembra del trial**, marcada `isExample: true` a nivel de
documento. Descontada la siembra, **no existe un solo dato financiero propio en
producción.**

**Corrección del 18 de agosto de 2026, de David: no hay DOS conjuntos reales, hay CERO.**
Los nueve de producción son de prueba. La lectura anterior deducía «real» de «no marcado
`isExample`», y no es lo mismo: **esa marca es manual y su ausencia no prueba nada.** De
hecho, al releer los nueve el 20 de agosto, **dos siguen sin marcar** —uno de ellos en
Quito—, así que siguen contando como reales en cualquier métrica que salga de producción.

**Consecuencia para el plan de 8 semanas:** su semana 1 es «instrumentar baseline y
mapear rutas de pago». La segunda mitad se puede hacer hoy —y está hecha en la
sección 3—. **La primera mitad no tiene qué medir.** No es un defecto del plan; es
que la materia prima no existe, igual que en PQRS y en comprobantes.

### Dos cifras que valen más que las anteriores

**`paymentVouchers: 0` y `financialCounters: 0`.** El flujo completo de registro de
pago (`recordPayment`) reserva un secuencial —lo que crearía un `financialCounter`— y
emite un comprobante. Que ambas colecciones estén vacías demuestra que **ese flujo
nunca ha corrido en producción, ni una vez.**

Lo único que sí se ha usado son los 5 comprobantes de residente, todos en conjuntos
de ejemplo — y esa ruta, como se ve abajo, **no escribe en el libro contable.**

---

## 3 · El mapa de rutas de pago (tarea P0.1, resuelta)

Hay **dos** rutas que mueven dinero, ambas **enteramente desde el cliente**, y
**producen efectos de dominio distintos**:

| | `recordPayment` | `approveReceiptAndRegisterPayment` |
|---|---|---|
| Dónde | `src/features/finanzas/use-payments.ts:63` | `src/features/billing/use-payment-receipts.ts:103` |
| Quién la usa | Administrador, desde Finanzas | Administrador, al aprobar un comprobante del residente |
| Reserva secuencial fiscal | **Sí**, transaccional | **No** |
| Crea asiento en `ledgerEntries` | **Sí** | **No** |
| Emite `paymentVoucher` | **Sí** | **No** |
| Actualiza `billingStatements` | Sí (`updateDoc` suelto) | Sí (dentro de un `writeBatch`) |
| Atomicidad del conjunto | **Ninguna** | Parcial |
| Veces ejecutada en producción | **0** | 5 (todas en conjuntos de ejemplo) |

**El hallazgo:** el Documento Rector dice que «la aprobación no converge plenamente
con ledger/voucher». Es más rotundo que eso: **no converge en absoluto.** Aprobar el
comprobante de un residente actualiza el saldo en cartera y **nunca crea un asiento
contable ni emite comprobante**. El dinero se mueve en cartera y no aparece en el
libro.

Efecto de producto: los estados financieros y el flujo de caja **están mal por
construcción** en cuanto un solo pago entre por la ruta del residente — que es
precisamente la ruta que el módulo promueve.

### Los cuatro defectos, nombrados

**a) Escrituras secuenciales sin transacción.** `recordPayment` hace cuatro
operaciones en orden: reservar secuencial → crear asiento → crear comprobante →
actualizar la cuota. **Ninguna transacción las envuelve.** Si falla la tercera, queda
un asiento sin comprobante. Si falla la cuarta, existen asiento y comprobante **y la
cuota sigue figurando impagada**: al residente se le vuelve a cobrar.

**b) Actualización perdida (*lost update*).** Las dos rutas calculan el nuevo monto
pagado como `pagado_anterior + importe` a partir de una **lectura previa fuera de
transacción**. Dos administradores registrando pagos a la vez leen el mismo valor y
el segundo pisa al primero: **un pago desaparece sin error visible.**

**c) Secuencial fiscal quemado.** `nextSequential` **sí es transaccional** —está bien
resuelto— pero se consume **antes** del resto de escrituras y **no es compensable**.
Si algo falla después, el número queda gastado y la serie fiscal tiene un hueco. En
Ecuador, un salto en la numeración es un problema de cumplimiento, no un detalle.

**d) El cliente es la autoridad.** No existe ninguna Cloud Function que aplique un
pago. Las funciones financieras desplegadas —`publishScheduledCharges`,
`updateOverdueStatements`, `onPaymentVoucherCreated`, `retransmitVoucher`,
`monthlyFinancialArchive`— crean cargos, actualizan estados y archivan, pero **ninguna
aplica un pago.** Toda la aritmética del dinero ocurre en el navegador.

---

## 4 · Riesgos corregidos y añadidos

### Corregido: el riesgo de Storage está mal enfocado

El Documento Rector lo enuncia como «acceso cross-tenant o Storage amplio», severidad
crítica. **La mitad cross-tenant ya está resuelta:** `storage.rules` compara
`request.auth.token.tenantId == tenantId` y bloquea todo lo demás por defecto.

El problema real es otro y sigue abierto: **dentro del conjunto no hay filtro de
rol.** La regla concede lectura y escritura a cualquier miembro autenticado del
conjunto. Su propio comentario dice «Admin and superadmin can upload tenant
documents», pero **la condición no comprueba el rol en ningún momento**. Un
residente —o un guardia— puede leer y escribir comprobantes de gasto, actas y
documentos financieros de su conjunto.

Enunciado correcto: **Storage sin filtro de rol dentro del conjunto**, severidad
crítica, y es prerrequisito de cualquier fase que suba documentos financieros.

### Añadidos

| Riesgo | Severidad | Por qué no estaba |
|---|---|---|
| **Serie fiscal con huecos** por secuencial no compensable | Alta | El documento da por buena la reserva atómica sin ver que no se revierte |
| **Estados financieros incorrectos** en cuanto entre un pago por la ruta del residente | **Crítica** | El documento la califica de «brecha»; es una divergencia total |
| **El flujo completo nunca se ha ejecutado** en producción | Alta | Ningún documento lo había comprobado |

### Matizado: la cobertura de pruebas

El Documento Rector lista «baja cobertura de CI en Functions/rules» como riesgo alto.
**Existen pruebas de cliente** —`finanzas-payments`, `finanzas-ledger`,
`finanzas-reconciliation`, y cinco de `billing`—. El hueco real es el de **reglas con
emulador**, que estuvo meses sin ejecutarse porque el emulador no arrancaba y sus
fallos pasaban por «preexistentes». Enunciarlo con precisión evita gastar esfuerzo
donde ya hay red.

---

## 5 · El bloqueo que ya no existe, y por qué se creía que sí

**DECISIÓN DE DAVID (20 de agosto de 2026): Vivaru NO maneja temas fiscales, y el
frente del SRI de Ecuador deja de bloquear el módulo financiero.**

Esta sección decía lo contrario hasta hoy: que el módulo estaba congelado por una
dependencia externa —el dato del experto SAP↔SRI que gestiona David Almeida, con seis
preguntas concretas sobre firma electrónica `.p12`, endpoint y formato— y que ninguna
fase fiscal avanzaba sin ella.

**Todo eso era cierto y ya no importa, porque el frente fiscal sale del alcance.** La
factura fiscal la sigue emitiendo el cliente, en todos los países. Vivaru administra el
conjunto; no es su agente fiscal.

**No es una decisión nueva, es una que se endurece.** La ficha de `FIN-001` ya la
recogía —*«no será necesario meternos al tema fiscal de momento para ninguno de los
países»*— y el alcance de aquel trabajo se diseñó sobre ella: el comprobante se emite
**después** de aplicar el pago, para que un fallo deje un pago sin comprobante
—recuperable— en vez de un comprobante fiscal de un pago que no existe. **Lo que cambia
hoy es que se cae el «de momento».**

**El error que hay que no repetir.** «Congelado» se escribió sobre el frente fiscal y
acabó leyéndose como el estado del **módulo entero**, en la tabla que todo el mundo lee
primero. Este mismo documento se contradecía cuatro secciones más abajo diciendo que los
frentes de integridad y conciliación se podían hacer hoy — pero quien lee la fila de
estado no llega hasta ahí. **Una etiqueta puesta sobre una parte se lee sobre el todo.**

### Lo que esta decisión deja abierto — y son preguntas, no tareas

1. **¿Qué se hace con el código del SRI ya escrito?** Existe `functions/src/sri-ecuador.ts`
   con `stubSriTransport` y `buildSriDocument`. Verificado hoy: **`realSriTransport` no
   existe**, solo el stub. Con lo fiscal fuera de alcance ese código no tiene destino:
   o se retira, o se deja documentado como opción dormida. **Dejarlo sin decidir es la
   peor de las tres**, porque el próximo que lo lea supondrá que el frente sigue vivo.
2. **¿A quién se le puede vender en Ecuador?** El checklist de salida a producción
   recomendaba «evitar EC fiscal hasta destrabar SRI». Con lo fiscal fuera, **la pregunta
   deja de ser cuándo se destraba y pasa a ser comercial**: si un conjunto ecuatoriano
   necesita factura electrónica por la administración, Vivaru no se la da y tiene que
   saberlo antes de firmar, no después. **Decisión de David, no técnica.**
3. **Los tres huecos fiscales que `FIN-001` dejó abiertos siguen abiertos**, y ahora son
   permanentes por decisión y no temporales por espera: el hueco en la serie si falla la
   emisión, la nota de crédito manual que nadie persigue al revertir, y los asientos
   antiguos sin `operationKey`. **Cuestan cero mientras no haya clientes reales.**

## 6 · Tesis, conservada

Se mantiene íntegra la del Documento Rector, porque está bien construida:

- **Capa 1 · Core** — registro confiable. No predice: preserva integridad,
  aislamiento, idempotencia, permisos y trazabilidad.
- **Capa 2 · Intelligence** — extrae, normaliza, detecta duplicados, propone
  candidatos con evidencia y confianza **por campo**. Nunca muta dinero.
- **Capa 3 · Controlled Automation** — solo tras superar gates, y siempre
  reversible, con kill switch y auditoría.

Y su principio rector: **automatizar un flujo fragmentado amplifica la
inconsistencia.** Primero se consolida, después se automatiza.

**Una sola ruta de aplicación de pagos**, venga del portal, de una importación, de
WhatsApp o de un estado bancario. Hoy hay dos y divergen; ese es el trabajo.

---

## 7 · Fases, con criterios de entrada honestos

| Fase | Objetivo | Criterio de ENTRADA | Criterio de SALIDA |
|---|---|---|---|
| **F0 · Integridad** | Comando único server-side, transaccional e idempotente | Ninguno. **Se puede empezar hoy** | Un pago se aplica o revierte por completo o no ocurre; las dos rutas terminan en el mismo comando; concurrencia y reversos probados |
| **F0b · Storage por rol** | Filtro de rol dentro del conjunto | Ninguno | Un residente no puede leer ni escribir documentos financieros; probado en emulador y en CI |
| **F1 · Expediente y bandeja** | `ReconciliationCase`, estados, duplicados, candidatos determinísticos | F0 | Un caso se rastrea de la evidencia a la aplicación, rechazo o reverso |
| **F2 · IA en sombra** | Extracción documental medida, sin tocar saldos | F1 **y un conjunto de documentos reales** | Métricas por campo sobre baseline determinístico, con costo y latencia |
| **F3 · Piloto** | Reducir tiempo real | F2 **y un conjunto que emita pagos de verdad** | Go/no-go económico |
| **F4 · Canales y escala** | WhatsApp, estados bancarios, autoaplicación exacta | F3 | Escala por conjunto sin perder control |
| ~~**Fiscal (transversal)**~~ | ~~SRI productivo~~ | **FUERA DE ALCANCE (20 ago 2026)** | **No aplica.** Vivaru no maneja temas fiscales; la factura la emite el cliente. Ver §5 |

**La diferencia con el plan original está en la columna de entrada.** F0 y F0b no
dependen de nada: son deuda de integridad y de seguridad que existe hoy y que empeora
con cada pago que entre. F2 y F3 dependen de datos que **no existen**, y ningún
esfuerzo de ingeniería los produce.

---

## 8 · Economía — qué conservar y qué no afirmar

**El precio ya está fijado, y no en este documento.** La guía maestra
—`Vivaru_Guia_Maestra_Precios_por_Pais_2026-08-12` (Drive), 12 de agosto de 2026, cinco días antes que el
Documento Rector— define precio por unidad al mes para México, Panamá, Colombia y
Ecuador, separando base de Vivaru, compensación de canal y precio final al cliente.
Para México: base MXN $27, canal $24 KAM, **final al cliente MXN $51**.

**Y ahí hay una discrepancia que hay que resolver, no promediar.** El Documento Rector
razona sobre una **base de MXN $40 por unidad** con premium de +$10/15/20/25 para el
módulo financiero, sobre un conjunto de referencia de 150 unidades. **Son dos marcos
distintos.** Mientras convivan, cualquier cálculo de margen de este módulo se apoya en
una cifra que no es la comercial vigente.

Lo que sí se conserva del Documento Rector es su criterio: **no comprometer un premium
concreto** hasta medir costo y ahorro reales. Eso sigue siendo correcto — lo que cambia
es que el precio **base** ya no es una incógnita.

**Lo que hay que decir y el documento no dice:** ese conjunto de referencia de 150
unidades no se parece a nada que Vivaru tenga hoy, y el motivo es más fuerte de lo que
decía esta línea: **no hay ningún conjunto real** —los nueve de producción son de
prueba—. La aritmética es correcta; **la base es hipotética**, y conviene marcarla como
tal para que nadie la cite como proyección.

La métrica que sí se puede empezar a construir sin clientes es el **costo por caso**
del lado de la inferencia, reutilizando la telemetría de IA que ya existe.

---

## 9 · Decisiones abiertas

Se conservan las seis del Documento Rector —país inicial, política de parcialidades,
identidad en WhatsApp, retención, precio y autoaplicación— y se añaden tres que
salieron de la verificación:

1. **¿Se corrigen los datos históricos** antes de unificar las rutas? Hay 5
   comprobantes aprobados sin asiento contable. Son de conjuntos de ejemplo, así que
   hoy la respuesta puede ser «no hace falta» — pero deja de serlo en cuanto entre el
   primer pago real.
2. **¿El comando único se construye antes o después de que exista un cliente?**
   Argumento a favor de antes: es deuda que crece con cada pago. En contra: nadie lo
   está usando todavía.
3. ~~**¿Quién desbloquea el dato del SRI, y con qué plazo?**~~ **CERRADA el 20 de
   agosto de 2026: no hay que desbloquearlo.** Vivaru no maneja temas fiscales, así que
   el frente sale del alcance y el dato deja de hacer falta. **Lo que queda en su lugar
   son las tres preguntas de §5**, y ninguna es de ingeniería.

---

## Changelog

### 0.3 — 20 de agosto de 2026, madrugada

**Por qué: este documento decía «Congelado» en la fila que todo el mundo lee primero, y
el módulo no lo estaba.** La etiqueta era del frente fiscal y se leía sobre el todo. El
propio documento se contradecía cuatro secciones más abajo.

- **Lo fiscal SALE DEL ALCANCE. Decisión de David: Vivaru no maneja temas fiscales**, y
  la factura la emite el cliente en los tres países. No es nueva: la ficha de `FIN-001`
  ya la traía como *«no será necesario meternos al tema fiscal de momento»*. **Lo que se
  cae hoy es el «de momento».**
- **Con eso, el frente del SRI de Ecuador deja de bloquear.** Ya no hace falta el dato
  del experto SAP↔SRI, ni implementar `realSriTransport`. La decisión abierta «¿quién
  desbloquea el SRI y con qué plazo?» queda **cerrada por no hacer falta**.
- **F0 y F0b ya no son «se puede empezar hoy»: están EN PRODUCCIÓN.** `FIN-000` el 18 de
  agosto y `FIN-001` el 19, las dos validadas a mano. Este documento es del 17 y no se
  había enterado.
- **F1 es lo siguiente y no lo bloquea nadie.** Su único criterio de entrada era F0, que
  ya está. Verificado: `ReconciliationCase` tiene **cero apariciones** en el código —
  está sin empezar, que no es lo mismo que estar bloqueado.
- **Se separa «bloqueado por una persona» de «bloqueado por falta de clientes».** F2 y F3
  esperan documentos y pagos reales que **ninguna ingeniería produce**. Meterlos en el
  mismo saco que el SRI hacía parecer que todo dependía de destrabar a alguien.
- **Corregido el dato de los conjuntos reales: no son dos, son CERO** —David lo corrigió
  el 18 de agosto—. Importa porque toda la aritmética de márgenes se apoya en un conjunto
  de referencia de 150 unidades que no se parece a nada existente.
- **Tres preguntas nuevas y ninguna es de ingeniería:** qué se hace con el código del SRI
  ya escrito, a quién se le puede vender en Ecuador sin factura, y que los tres huecos
  fiscales de `FIN-001` pasan de temporales a permanentes por decisión.

### 0.2 — 17 de agosto de 2026, noche

**Por qué:** las versiones anteriores afirmaban que no había precio. Era falso: existe
desde el 12 de agosto de 2026 en `Vivaru_Guia_Maestra_Precios_por_Pais_2026-08-12`.
Lo que falta es cablearlo al producto y reconciliar la nomenclatura. Detalle en
`docs/roadmap-producto.md`, sección «El precio».

### 0.1 — 17 de agosto de 2026

**Por qué:** convertir el Documento Rector v2 en base de roadmap versionada, con sus
afirmaciones verificadas y sus huecos cerrados donde se podía medir.

**Verificado contra:** repositorio en `3dc443f` y lectura directa de `hogaru-1`.

- Se resuelve la tarea P0.1 del documento original: **el mapa de rutas de pago**.
  Son dos, divergen, y ninguna es transaccional.
- Se nombran cuatro defectos con archivo y modo de fallo, incluidos dos que el
  documento no recogía: la actualización perdida y el secuencial fiscal quemado.
- Se mide la línea base: **cero datos financieros propios en producción**. Todo lo que
  parecía real es siembra del trial.
- Se demuestra que **el flujo completo de pago nunca se ha ejecutado en producción**
  (`paymentVouchers` y `financialCounters` vacías).
- Se corrige el riesgo de Storage: cross-tenant está resuelto; lo que falta es el
  **filtro de rol dentro del conjunto**.
- Se añade el bloqueo externo del SRI con su responsable, ausente del original, y se
  separa explícitamente para que no congele los frentes que no dependen de él.
- Se marca como hipotética la base de 150 unidades de los escenarios de precio.
