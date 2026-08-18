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
| **Versión** | 0.2 |
| **Fecha** | 17 de agosto de 2026, noche |
| **Base** | Documento Rector v2 (Word), fortalecido con verificación directa |
| **Verificado contra** | Repositorio en `3dc443f` y proyecto `hogaru-1` (producción) |
| **Estado del módulo** | **Congelado** por dependencia externa — ver «El bloqueo que el documento no nombra» |

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

Los 24 cobros, 12 asientos y 16 gastos que aparecían en los dos conjuntos «reales»
son **siembra del trial**, marcada `isExample: true` a nivel de documento. Descontada
la siembra, **no existe un solo dato financiero propio en producción.**

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

## 5 · El bloqueo que el documento no nombra

`CLAUDE.md` registra el módulo financiero como **congelado**, y no por decisión de
producto: **G3 (transporte real al SRI de Ecuador) está bloqueado** esperando el dato
del experto SAP↔SRI que gestiona **David Almeida** — firma electrónica `.p12` por
conjunto, endpoint y formato, seis preguntas concretas.

El Documento Rector menciona el stub pero **no menciona el bloqueo ni a su
responsable**. Para un roadmap eso importa: hay una dependencia externa con dueño
nombrado, y ninguna de las fases fiscales avanza sin ella.

**Implicación de secuencia:** los frentes A y B (integridad y conciliación
determinística) **no dependen del SRI** y se pueden hacer hoy. Conviene decirlo
explícitamente para que el congelamiento del frente fiscal no congele el resto.

---

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
| **Fiscal (transversal)** | SRI productivo | **Bloqueado: dato del experto SAP↔SRI** | Transporte real, certificación y pruebas |

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

**Lo que hay que decir y el documento no dice:** ese conjunto de referencia no se
parece a ningún conjunto que Vivaru tenga hoy. Los dos reales tienen **1 unidad y 0**.
La aritmética es correcta; **la base es hipotética**, y conviene marcarla como tal
para que nadie la cite como proyección.

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
3. **¿Quién desbloquea el dato del SRI, y con qué plazo?** Está nominado —David
   Almeida— pero sin fecha, y congela todo el frente fiscal.

---

## Changelog

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
