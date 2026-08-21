# Pendientes

Índice de traspaso, no resumen. Cada línea apunta a dónde está el detalle.
Actualizado el 21 de agosto de 2026: el recibo `000000001` quedó anulado en producción y
la política de retención está escrita y decidida. Los dos salen de la lista.

## LO PRIMERO AL ABRIR SESIÓN (19 ago 2026, madrugada del 20)

**`master` = `c81e2fe`: lo construido el 19 YA ESTÁ EN PRODUCCIÓN, validado y
comprobado.** El hueco de acceso del residente está cerrado en producción, y todo
conjunto creado desde ahora nace con su país y su moneda correctos.

David validó a mano en staging las dos cosas que ninguna prueba puede contestar: al
borrar al residente, la otra ventana lo echó al refrescar; y el conjunto creado con
México quedó en MXN. Con eso se subió.

**Y en la madrugada del 20 se desplegó además el retiro del SRI** (`dc3e061`): front en
producción, `onPaymentVoucherCreated` sin la rama fiscal, y **`retransmitVoucher` BORRADA**
de los dos ambientes —comprobado en `functions:list`, ya no existe—. La verificación del
bundle fue **al revés**: aquí había que probar una ausencia, así que el marcador viejo
debe faltar Y los controles vivos deben aparecer. Sin los controles, «no aparece» no
prueba nada: podría ser que la búsqueda no funcionara.

### Qué se desplegó y cómo se comprobó (no deducido — leído)

| Pieza | Estado en producción | Cómo se comprobó |
|---|---|---|
| `revokeResidentAccess` (nueva) | Viva, v2, `us-central1` | `functions:list`, y su permiso de invocación leído en IAM: `allUsers` + `run.invoker` |
| `createTenantWorkspace` (actualizada) | Viva, v2, `us-central1` | `functions:list` |
| Front (`c81e2fe`) | Servido | Chunks de `/login` descargados: marcador nuevo `revokeResidentAccess` presente, control viejo `deleteOperationalUser` presente, símbolo inventado ausente |

El orden fue el NORMAL —functions antes que front— porque las dos **conceden** permiso.
Se invierte solo cuando la regla restringe, como en `FIN-001`.

**La trampa de `run.invoker` no mordió, y no fue suerte:** `revokeResidentAccess` ya
nace declarando `invoker: "public"` en su definición. Quien la escribió se adelantó.

**El secreto de Resend sobrevivió a la fusión otra vez.** `apphosting.yaml` conserva
`secret: RESEND_API_KEY`, cero claves en claro. Comprobado antes de empujar.

**Puerta en verde antes de subir:** 349 pruebas de functions + 994 del front, los dos
typecheck limpios.

### Lo que NO arregló este despliegue

**Los conjuntos que ya existían siguen incompletos.** El arreglo actúa al crear, no
hacia atrás. Sigue pendiente la decisión de David sobre los 9 —corregirlos a mano,
borrarlos, o dejarlos sabiendo que están así—.

**Ojo al medirlo:** las credenciales de lectura de producción (`gcloud auth
application-default`) caducaron el 19 por la noche. Antes de leer Firestore de
producción hay que correr `gcloud auth application-default login`, o el script falla con
`invalid_rapt` y parece un error de código.

### El estado de producción, medido leyéndolo el 19 (no deducido)

9 conjuntos: **6 sin `currency` y 4 sin `country`**. `Privada Las Palmas` está en México
y la consola la lee en COP. Planes en uso: `plus`×5, `starter`, `premium`, `trial`×2.
La colección `plans` tiene **0 documentos**.

**El arreglo NO corrige los conjuntos que ya existen.** Son de prueba, así que hay tres
salidas y ninguna es obvia: corregirlos a mano, borrarlos, o dejarlos sabiendo que están
así. **Decisión de David, no técnica.**

### Vivaru Finance — `FIN-001` CERRADA Y EN PRODUCCIÓN (20 ago 2026)

**`master` = `d17478d`.** El criterio de salida de `FIN-001` decía «cumplido salvo el
voucher». Ya no: **el recibo se emite dentro de la transacción del pago y el reverso lo
anula**. Las dos cosas estaban bloqueadas por «eso es meterse en lo fiscal», que dejó de
ser cierto al salir lo fiscal del alcance.

**Validado a mano en staging por David, punta a punta:** emitir → PDF correcto →
revertir → recibo anulado en la lista y con `ANULADO` en el PDF. Y desplegado a
producción en el orden **front → functions → reglas**, con las reglas al final porque
`paymentVouchers` pasó a `create, update: if false` y eso **restringe**.

**Lo que salió por probar, y ninguna prueba lo habría cazado:**

1. **El administrador no tenía dónde ver los recibos.** Solo existían en el instante de
   emitirlos. El residente sí tenía su lista. Se construyó la tarjeta «Recibos emitidos»
   en Finanzas — y **no** en Cartera, cuya columna «Comprobante» significa otra cosa: el
   archivo que SUBE el residente.
2. **El pie del PDF anulado decía «Conserve este comprobante como soporte de su pago».**
   La marca de arriba avisaba y el pie la desmentía.
3. **Los recibos anteriores al cambio salían como `No. undefined`** y se descargaban como
   `recibo-undefined.pdf`: no tienen `code`, tienen `sequentialNumber`. Resuelto con
   `codigoDeRecibo`, que lee las dos formas. **No se migran los viejos a propósito:**
   cambiarle el número a un papel que alguien descargó es peor que soportar dos formas.

**La lección que las agrupa:** las tres salieron de **mirar la salida** —una pantalla, un
PDF— y no de una suite. Cuando se construye algo que alguien mira, alguien tiene que
mirarlo.

### Cabo suelto en producción — CERRADO el 21 de agosto de 2026

El recibo `000000001` (Apartamento 503, $1.120.000, `tenant-santa-maria`, doc
`zAcFYtEUx0AFyOdalIYQ`) **está anulado en producción**. Se escribieron los cuatro campos
acordados y **nada más**; el secuencial y el importe quedaron intactos, comprobado
releyendo de Firestore. Script: [`scripts/anular-recibo-000000001.mjs`](../scripts/anular-recibo-000000001.mjs),
idempotente — si se vuelve a correr, se niega.

**Antes de escribir se verificó el reverso leyéndolo, no fiándose del documento.** Era la
única forma de que esta escritura hiciera daño: un recibo anulado sin pago revertido
detrás es una mentira en un registro financiero. Lo leído:

| Qué | Estado |
|---|---|
| Operación de pago `e52cf94a…` | `reversedAt` = 21 ago 00:39 UTC, con su `reversalKey` |
| Operación inversa | Existe, `-1.120.000`, apuntando de vuelta con `reversesOperationKey` |
| Asientos del libro | `+1.120.000` y `Reverso: … −1.120.000`. **Netean a cero** |
| Cuota del 503 | De vuelta en `pending`, saldo íntegro de 1.120.000. Nadie quedó dado por pagado |
| `voucherId` en la operación de pago | **AUSENTE** — la causa, leída y no supuesta |

**La lección, que es la de siempre en este documento:** el reverso estaba bien, pero eso
se sabía por una frase escrita, no por un dato. Verificarlo costó dos minutos y era lo
único que separaba «corregir un registro» de «falsear uno».

**Falta mirarlo con los ojos** — la pantalla de Recibos emitidos y el PDF. La escritura
está comprobada en el dato; que la interfaz lo pinte tachado y el PDF salga con `ANULADO`
es otra cosa, y este documento ya enseñó tres veces que eso solo se sabe mirando.

**Y es la forma general del problema:** los registros anteriores a un cambio de forma no
se migran solos. Los asientos sin `operationKey` son el otro caso, y **sigue abierto** —
se confirmó de paso: de los 12 asientos de `tenant-santa-maria`, solo uno tiene
`operationKey`.

### Vivaru Finance — el contexto de antes (20 ago 2026, madrugada)

**Lo fiscal salió del alcance y el SRI se retiró del código.** Ver
[`docs/roadmap-finance.md`](roadmap-finance.md) §5. Nueve ficheros, 339 líneas fuera.
`retransmitVoucher` **borrada** de los dos ambientes; `onPaymentVoucherCreated`
redesplegada sin la rama del SRI.

**Precisión que costó una corrección:** el candado del RUC **no estaba bloqueando a
nadie**. Depende de `tenantSettings.fiscalProfile.country === "EC"`, y **en producción
solo un conjunto tiene perfil fiscal, de México**; en staging no lo tiene ninguno. Era
trampa latente —habría saltado al configurar el perfil de un conjunto ecuatoriano—, no
un incendio. **Leer el dato antes de calificar la gravedad.**

**Consecuencia de eso para validar:** el panel del SRI y el candado **nunca se vieron en
staging**, así que no hay clic que los pruebe. Lo que prueba que se fueron es que las
condiciones ya no existen ni en el código ni en el bundle servido, comprobado con la
prueba al revés: marcador viejo AUSENTE, control vivo PRESENTE, símbolo inventado
ausente.

### Lo siguiente en Finance NO es el expediente: es terminar `FIN-001`

**Su propio criterio de salida dice «Cumplido salvo el voucher».** Y hay dos cosas
abiertas que estaban bloqueadas **por la misma frase**, que hoy dejó de ser cierta:

1. **Un pago puede existir sin su recibo.** El servidor aplica el pago —cuota y asiento,
   transaccional— pero **el comprobante se sigue creando en el navegador**, después.
   `functions/src/payments.ts` no menciona «voucher» ni una vez. El comentario del código
   dice que cerrarlo *«exige emitir dentro de la transacción, que es meterse en lo
   fiscal»*. **Ya no lo es:** el comprobante es un recibo interno.
2. **Revertir no anula el recibo.** Mismo argumento en `payments.ts`: *«eso pide una nota
   de crédito, que es terreno fiscal»*. Hoy levanta `requiereNotaCredito` y la pantalla
   avisa, pero **el paso es manual y nadie lo persigue**. Una nota de crédito es un
   instrumento fiscal; sin factura, revertir anula el recibo interno y ya.

**Por qué va antes que el expediente de conciliación:**

- **Es el momento más barato que habrá**, y está medido: producción tiene **0
  comprobantes, 0 contadores y 0 operaciones de pago**. Migración: ninguna.
- **El expediente se construye ENCIMA de la aplicación de pagos.** Montarlo sobre un
  camino que aún deja recibos huérfanos es construir sobre arena — es la propia tesis del
  Documento Rector: *«automatizar un flujo fragmentado amplifica la inconsistencia»*.
- **Es pequeño:** mover la emisión a una transacción que ya existe y añadir la anulación
  al reverso que ya existe. El expediente es un módulo entero para una bandeja **vacía**.

**Decisión de David pendiente:** si el recibo interno debe conservar **numeración
correlativa** ahora que no es fiscal. Si sí, el hueco al fallar deja de importar pero la
serie se mantiene por orden; si no, se puede simplificar bastante.

## LA PRÓXIMA SESIÓN EMPIEZA POR OTRO SITIO — leer esto antes que la lista de abajo

**Hay un documento de arranque escrito para ti:
[`docs/arranque-exploracion-plataforma.md`](arranque-exploracion-plataforma.md). Ábrelo
antes de nada.** Lleva el contexto medido —qué es Vivaru hoy, sus 66 pantallas, sus cinco
roles, cómo entrar y con qué datos— para que no gastes el tiempo de David reconstruyéndolo.

**Lo que David va a pedir:** entrar a la plataforma —él concede el acceso—, navegarla
hasta tener granularidad, **decidir tú cuántas pasadas hacen falta**, y después construir
el esqueleto del sitio a partir de PRDs funcionales.

**Y hay una ambigüedad que se resuelve con él en los primeros minutos**, porque el 21 de
agosto abrió el track con una frase y lo concretó con otra:

1. **Documentar Vivaru tal como es hoy** en PRDs funcionales, y de ahí el esqueleto.
2. **Extraer los PRDs de una solución de referencia ajena** y filtrarla para sacar alcance
   nuevo, sobre todo **contable y financiero**.

La segunda frase apunta a la primera lectura; la primera hablaba claramente de extraer.
**Preguntar, no elegir.** El documento de arranque lo explica en su §0.

**Con qué enlaza:** cae encima del punto 5 de la lista de abajo —`F1` de Finance— y puede
contestarlo. Su pregunta abierta es si vale la pena la bandeja de conciliación con cero
pagos reales, y un alcance sacado de mirar el producto de verdad es el dato que falta.
Existen las skills `crear-prd-vivaru` y `crear-prd-ia-vivaru`.

---

## Con qué seguir, por orden (para la sesión siguiente)

**Lo de arriba está cerrado.** `FIN-001` en producción y validada; el SRI retirado; el
expediente de Albert al día. Esto es lo que queda, ordenado por lo que abre más con menos
esfuerzo.

1. ~~**Marcar anulado el recibo `000000001` de producción.**~~ **HECHO el 21 de agosto de
   2026**, y verificado releyendo. Lo único que queda es **mirarlo en pantalla**: que la
   tarjeta de Recibos emitidos lo pinte tachado y que el PDF salga con `ANULADO`. Detalle
   en la sección de arriba.
2. **Mandarle a Albert dos cosas, por sitios distintos.** Sigue siendo lo más barato de la
   lista y **lo que más abre**: sin alta no hay usuario de servicio, y sin esa credencial
   no hay con qué suscribirse a sus deals — la segunda mitad de `REVOPS-001C`.
   - **El `tenant_admin`, por el canal** — nunca dentro de un documento. Decidido el 21:
     **`comercial@qintilab.com`, y es provisional a propósito** porque Vivaru no tiene hoy
     buzón propio y crearlo frenaría el envío. Se acepta que es un **buzón compartido** y
     que quien lo lea puede recuperar la cuenta y tocar el pipeline. Motivo y corrección
     en [`ESTADO-ALBERT.md`](prd/albert/ESTADO-ALBERT.md) §«Lo primero mañana».
   - **[`DECISIONES-A-002`](prd/albert/DECISIONES-A-002-vivaru-a-albert.md), ya redactado
     y sin mandar** — los dos números de retención con la frase del reloj, la propuesta de
     **un solo canal** (los documentos hablaban de dos y ninguno decía cuál era), y la
     reclamación de la fecha de A1, que Albert prometió el 19 «como lo primero que
     cerramos» y no ha llegado.
3. ~~**Escribir la política de retención — DOS números.**~~ **HECHO el 21 de agosto de
   2026.** Los dos son **12 meses**, la cifra de la casa: el deal sin actividad (Albert
   proponía 24) y el registro de auditoría del borrado, éste contado **desde la fecha del
   borrado**. Documento nuevo: [`docs/politica-retencion-datos.md`](politica-retencion-datos.md).
   **Lo que queda es mandárselos a Albert**, junto con la frase del reloj — va en el
   intercambio normal, no por canal aparte.
   **Y salió un hallazgo que este documento negaba:** decíamos que Vivaru no tenía
   política de retención. Escrita no la había, pero **números sí, y llevan tiempo
   corriendo**: tres ventanas de 12 meses en la tarea de las 03:00 —PII de comprobantes,
   `aiUsage` y `aiFeedback`—. Es la misma forma del error de los webhooks de Albert: una
   frase que fue cierta y que nadie volvió a contrastar contra el código.
4. **Decidir qué se hace con los 9 conjuntos incompletos**, y no son un grupo homogéneo:
   los siete marcados de ejemplo son inertes; **los dos sin marcar contaminan las
   métricas hoy**, y uno de ellos —el de Quito— muestra la moneda de otro país.
5. **`F1` de Finance: el expediente de conciliación.** Ahora sí no tiene nada delante ni
   debajo: `ReconciliationCase` no existe, y su único requisito era `FIN-001`. **Pregunta
   previa, que es de David:** ¿vale la pena construir la bandeja antes de que haya alguien
   conciliando? Hay cero pagos reales.
6. **Validar el formato de las referencias cruzadas — son DOS.** `crmRef` es hoy un
   `<Input>` de texto libre sin validación; `externalRef.leadId` **no existe** en el
   código.
7. **La comprobación que sostenga la invariante contacto→deal**, que Albert aceptó como
   palabra nuestra y hoy no vigila nadie.
8. **`REVOPS-001B`** — evento de activación.

**Deuda conocida que NO urge pero deja de no urgir con el primer cliente:** los asientos
anteriores a `FIN-001` no se pueden revertir porque no guardan `operationKey`. Es la misma
familia que el recibo `000000001`.

**Dos cosas anotadas el 21 de agosto que no urgen hoy y no conviene perder:**

- **Cambiar el `tenant_admin` de Albert** a un buzón propio de Vivaru cuando exista. Hoy
  es `comercial@qintilab.com`, compartido, elegido a sabiendas. Cambiarlo después es
  barato —se le pide a un superadmin de Albert—; **el criterio no es el dominio, es quién
  puede leerlo**.
- **Comprobar que los buzones de `grupovivaru.com` reciben de verdad**, y es de otra
  gravedad: `privacidad@grupovivaru.com` es el canal que la política de privacidad
  publica **siete veces** para ejercer derechos y reportar incidentes, y `soporte@` lleva
  tiempos de respuesta comprometidos en los términos. Si rebotan, no es incomodidad: es
  incumplimiento de lo publicado. **No se puede comprobar desde el repositorio** — hay que
  abrir el correo, o mandarles una prueba desde fuera.

**La segunda mitad de `REVOPS-001C` NO está bloqueada por Albert, y este documento decía
que sí. Corregido el 20 de agosto de 2026.**

`RESPUESTA-A-001` ya lo cerró el 19, en su C1, con veredicto literal: **«SÍ, sin nada que
os lo impida. El trigger queda fuera del camino crítico.»** La regla que cita —
`match /deals/{docId} { allow read: if canReadTenant(tenantId); }`— concede lectura a
**todos** los roles del tenant, `sales` incluido, que es exactamente el rol del usuario de
servicio que nos dan en C2. **Vivaru puede suscribirse en vivo (`onSnapshot`) a
`tenants/vivaru/deals` y ver la conversión en tiempo real.** No hace falta webhook, ni
trigger, ni OIDC — Albert lo descarta explícitamente.

`RESPUESTA-A-002` no menciona la señal de vuelta (se buscaron *webhook*, *señal de
vuelta*, *activación*, *suscripción*, *disparador*: ninguna aparece), y **no hacía falta
que la mencionara**: ya estaba contestada en la ronda anterior.

**Lo que sí la bloquea es operativo y barato: el alta del tenant (A5).** Sin el tenant
`vivaru` dado de alta y sin el usuario de servicio creado, no hay credencial con la que
suscribirse. Y el alta espera **el correo del `tenant_admin`**, que es el punto 1 de esta
lista. Por eso el punto 1 no es un trámite: **es lo que abre `REVOPS-001C`.**

**Cómo se coló el error, para no repetirlo:** el roadmap escribió «Albert no tiene
webhooks» cuando eso era cierto, y nadie reescribió la frase después de que
`RESPUESTA-A-001` la volviera irrelevante al hacernos tenant. **Una dependencia se cae
por dejar de necesitarla, no solo porque alguien la construya** — y ese cambio no deja
commit, así que hay que ir a borrarlo a mano.

**Lo que NO toca ahora:** la pantalla `/superadmin/plans`, **aplazada al módulo
financiero** por decisión de David — hoy administra un catálogo que no describe nada
real, pero vuelve a tener sentido entonces.

### Albert — el estado vive en su propio documento

**`docs/prd/albert/ESTADO-ALBERT.md`** es el documento vivo del expediente: qué está
cerrado, qué debe Vivaru, qué debe Albert, y qué no tiene dueño. **Ir ahí antes que a los
cuatro documentos del intercambio.** Abajo, solo lo que cambia esta lista.

#### `RESPUESTA-A-002` — lo que hay que saber sin releerla

Llegó el 19. Da la razón en las dos contradicciones **sin regatear** y corrige su propia
frase «sin PII».

- **Confirmado y sin coste para nosotros:** el `country` que empezamos a guardar hoy ya
  encaja con lo que pide (código ISO de dos letras, y nuestro selector es cerrado). No
  hay que rehacerlo.
- **`consent` vive SOLO en el contacto**, retirado del deal. `acceptedAt` lo pone
  nuestro servidor.
- **Sin fecha para lo suyo.** Dice que su A1 «cabe en días» y va primero, pero se niega
  a poner fecha de calendario por escrito porque la fija su owner. Consecuencia: podemos
  construir contra un contrato cerrado, **pero no probar el circuito hasta que publique**.
- **El motor de mensajería NO tiene compromiso** — «sobre la mesa», sin sí firme. Y lo
  nombra él mismo: sin control de opt-out y frecuencia, **el `consent` que acaban de
  diseñar no tiene quién lo respete al enviar**. Se construyó el candado, no la puerta.
- **Hallazgo suyo que conviene conocer:** el PII del timeline no está en campos
  estructurados sino embebido en el texto de cada evento (`Contacto creado: Juan Pérez`),
  así que borrar no basta con vaciar campos: hay que reescribir mensajes. Es trabajo
  suyo, pero hace la supresión más frágil de lo que se suponía.
- **Una imprecisión suya, para el registro:** justifica el índice diciendo que sin él la
  consulta «degrada al crecer». No es cierto para una igualdad simple — ese campo se
  indexa solo y el coste depende de los resultados, no del tamaño de la colección. El
  índice es barato y no estorba; la razón que da, no se sostiene.

## Dos cosas de método que salieron hoy y conviene no perder

- **Buscar el gemelo que lo hace bien.** Los dos defectos del 19 tenían un camino hermano
  que ya hacía lo correcto: `deleteOperationalUser` para el del residente, y el trial
  self-service para el de la moneda. Leer ese camino **antes** de diseñar el arreglo. Y
  el corolario: si dos caminos hacen lo mismo y solo uno está bien, probablemente hay un
  tercero.
- **Sí se puede saber qué front hay desplegado**, y el documento decía que no. `/login`
  sirve 200 y sus chunks son públicos: se descargan y se busca dentro un símbolo que solo
  exista en el código nuevo, con un símbolo viejo de control para saber que la búsqueda
  funciona. **La fecha de `apphosting:backends:get` NO sirve**: cambia a los ~45 segundos
  de crear el rollout, o sea marca que arrancó, no que terminó.

## La sombra de F4 está construida y NO desplegada (17 ago 2026)

**Lo que faltaba existe: `aiAssistance` ya no vive en un comentario.** Commits
`713185b` (el refactor que la hizo posible) y `f1fea59` (la sombra). Cuatro
piezas:

- **`functions/src/ai/ejecucion.ts`** — el tramo de una operación asistida que
  va **después de autorizar**: validar, cobrar cuota, ejecutar y contarlo. Se
  extrajo de `runGateway` porque la sombra no tiene sesión, ni membresía, ni App
  Check: **nada de lo que la puerta comprueba existe.** Ahora hay un solo camino
  de ejecución y dos puertas. Las dos alternativas descartadas —usuario falso, y
  camino propio duplicado— están escritas dentro, porque volverán a parecer
  buenas.
- **`functions/src/ai/sombra-pqrs.ts`** — la sombra. `planificarSombra` es una
  función pura: es la parte que decide **cuándo NO se gasta dinero**, y quería
  poder probarla sin emulador.
- **Dos triggers propios** en `index.ts` (`sombraPqrsAlCrearTicket`,
  `sombraPqrsAlActualizarTicket`), aparte de `onTicketCreated`/`onTicketUpdated`
  para que la notificación de un PQRS no dependa de que Vertex conteste.
- **`aiAssistance`** en `firestore.rules`: `read: superadmin`, `write: false`.

**Lo que hay que saber antes de encenderla:**

- **`ai-pqrs-shadow` está APAGADA en los dos ambientes**, y nace así a
  propósito. **Es la primera vez en el programa que el sistema gasta sin que
  nadie pulse nada:** hasta ahora toda llamada salía de un administrador
  abriendo el drawer o de una corrida lanzada a mano. USD 0,0009 por ticket.
- **Desplegar el código YA cambia la conducta de producción**, aunque la bandera
  siga apagada: los dos triggers nuevos empiezan a dispararse con cada ticket.
  Con la bandera apagada no llaman al modelo ni escriben nada, pero se invocan.
- **Sembrar los 24 del piloto con la bandera encendida cuesta USD 0,022** y
  ocurre solo, sin que nadie abra una pantalla.
- **Al desplegar, comprobar los triggers.** Son funciones nuevas; la trampa
  conocida de `run.invoker` es de las callables, pero una función nueva que no
  arranca da «error interno» sin pista.
- La sombra **no escribe una sola letra en el ticket**. Si algún día lo hace,
  dejó de ser una sombra.
- `en_curso` en reposo al leer `aiAssistance` = una función se cayó a mitad. Ese
  ticket no se reintenta, y es deliberado: pagar dos veces en silencio es peor.

**Evidencia:** 308 pruebas de functions en verde (17 nuevas en
`functions/tests/ai-sombra-pqrs.test.ts`), typecheck limpio en `src/` y en
`functions/`.

**Y desplegada y vista funcionando en staging el 17 por la noche.** Las dos
funciones `ACTIVE` (`19:33:57 UTC`, disparador leído: `tickets/{ticketId}`,
`RETRY_POLICY_DO_NOT_RETRY`), reglas desplegadas, `ai-pqrs-shadow` encendida en
staging. **Toda la cadena se comprobó por USD 0**, aprovechando que en
`buzon_simple` la sombra omite sin llamar al modelo:

- Ticket nuevo en `tenant-santa-maria` (`buzon_simple`) → fila escrita con
  `estado: omitida`, `motivo: buzon_simple`. Disparo, reserva, lectura de la
  variante y escritura, comprobados sin gastar.
- Clasificado sin prioridad → `decision` anotada y **`priority` AUSENTE, no
  `null`**: la corrección del 16 de agosto sobrevive hasta la fila de la sombra.
  Verificado leyéndolo, no por prueba unitaria.
- Resuelto → `decisionCongeladaEn` escrita. El congelado que mide G7 funciona.

**Y el camino de pago también, con una llamada real (USD 0,0009).** Ticket en
`tenant-nogal-bogota`: `estado: sugerida`, `variante: con_sla`, operación **v2**,
`marcasDeRevision: []`. Clasificó `maintenance` / `claim` / `medium`, con
`needsHumanReview: true` y `posible_urgencia`. **El borrador no afirmó ninguna
acción**: pide fotos y el apartamento, y dice qué se hará — la forma que la
regla dura permite. Es la v2 comportándose como la midió la evaluación offline,
ahora sobre un ticket de producto y no sobre un WhatsApp del gold set.

La fila de `aiUsage` salió con `uid: __sombra__` y `v2`, distinguible de las del
administrador (uid real, `v1`): **el mecanismo que separa el gasto de la sombra
del de las personas funciona**, y no hizo falta campo nuevo.

Lector: `node functions/scripts/leer-sombra-pqrs.mjs vivaru-staging-02`.

## Producción: la sombra está DESPLEGADA e INERTE, y falta promocionar (17 ago 2026)

**El código está en producción; las banderas no.** Escribir en Firestore de
producción quedó bloqueado en la sesión, así que las banderas las enciende David.

- `sombraPqrsAlCrearTicket` y `sombraPqrsAlActualizarTicket`: **ACTIVE** en
  `hogaru-1` (20:02:28 UTC), disparador leído sobre `tickets/{ticketId}`, sin
  reintentos. Regla de `aiAssistance` desplegada — el diff de reglas con `master`
  era **solo** ese bloque. Vertex (`aiplatform.googleapis.com`) habilitado.
- **`featureFlags` de producción: 0 documentos.** Todo apagado por default, que
  es un estado seguro y no uno a medias. `aiAssistance`: 0 filas.

### Promocionado el 17 por la noche. Falta SOLO encender las banderas

**`develop` está en `master` (`6d5bba8`) y producción sirve el front nuevo:**
rollout de App Hosting a las 14:45:58, landing y login en **200** comprobados
después. Las dos ramas quedaron sincronizadas en el mismo commit.

- **El arreglo de seguridad de Resend sobrevivió**, que era el riesgo real de la
  fusión: `apphosting.yaml` conserva `secret: RESEND_API_KEY` y hay **cero**
  claves en claro. Comprobado leyéndolo tras fusionar.
- **La mina murió con la FUSIÓN, no con el redespliegue** — corrige lo que este
  documento decía antes. Desde que `master` contiene las dos funciones, un
  despliegue desde `master` ya no puede borrarlas. Se redesplegaron igual desde
  `master` para que rama y ambiente coincidan sin dudas; **solo esas dos**, nunca
  las ~60, porque un despliegue total arrastra las que llevan el secreto de
  Resend sin ganancia.
- Gate corrido sobre `master` antes de empujar: 0 errores de typecheck fuera de
  `tests/`, 0 en functions con sus pruebas, 314 en verde, y **`npm run build` de
  Next completo** — empujar `master` dispara App Hosting y un build roto tumbaría
  producción.

**Lo único que falta: las tres banderas** (`ai-gateway`, `ai-pqrs-shadow`,
`ia-proveedor-real`) desde `/superadmin/flags`, o sembrando el catálogo con
`node functions/scripts/seed-feature-flags.mjs hogaru-1` y poniéndolas en `true`.
**Las enciende David**: escribir documentos en Firestore de producción está
bloqueado por el clasificador de permisos de Claude Code (desplegar functions y
reglas sí pasa). El orden entre ellas da igual: con el proveedor apagado la
sombra omite con motivo `proveedor_simulado` en vez de fabricar basura.

### Por qué la promoción no era opcional

**Un administrador de producción NO puede clasificar un ticket hoy**:
`updateTicketClassification` no existe en `master` (comprobado: 0 apariciones), y
`asistente-ticket.tsx` tampoco. La sombra guarda pares *sugerencia + decisión*, y
sin editor la mitad que importa no ocurre nunca — es literalmente lo que la PRD
advirtió para F3. Y la pantalla del residente en `master` sigue **sin renderizar
las definiciones** de los cinco tipos, que envenena la sombra por ruido.

**Encender la sombra sin promocionar deja un sistema a medias.**

Un administrador de producción **no podía clasificar un ticket**:
`updateTicketClassification` no existía en `master` (comprobado: 0 apariciones),
y `asistente-ticket.tsx` tampoco. La sombra guarda pares *sugerencia + decisión*,
y sin editor la mitad que importa no ocurre nunca — es literalmente lo que la PRD
advirtió para F3. Y la pantalla del residente seguía **sin renderizar las
definiciones** de los cinco tipos, lo que envenena la sombra por ruido.

Con la promoción, las dos cosas están en producción. El panel de IA no: va
detrás de `ai-pqrs-suggestions`, apagada (`8bfc1c2`). Sin ese gate, promocionar
habría puesto delante de un administrador un panel que revienta al pulsarlo,
porque producción **no tiene desplegada `asistirTicketPqrs`**.

**Qué pasará al encender las banderas: nada, y es lo esperado.** De los 9 conjuntos de
producción, **7 están marcados `isExample=true`** —incluidos los dos que tienen
los 20 tickets, `conjunto-las-playas` (14) y `tenant-santa-maria` (6)—. Los dos
reales, Bromelias y Queretarock, tienen **cero tickets**. La sombra queda armada
para el primer ticket de verdad, que es justo lo que F4 persigue. El filtro no
discrimina conjuntos: descarta datos de mentira.

**Ojo con `tenant-santa-maria`:** en producción es `con_sla`, no `buzon_simple`
como en staging. Mismo nombre, comportamiento distinto.

### Hallazgo al probarlo: la sombra no distingue lo sembrado de lo real

**Los tickets del piloto no llevan `isExample`, y `tenant-nogal-bogota` tampoco.**
El mecanismo existe y está usado en otros sitios —`trial-seed.ts` lo pone en el
documento, los seeds de demo en el conjunto, y `audit-volumen-ia.mjs` descuenta
por los DOS caminos porque sin eso la volumetría dio 20 tickets que eran 0 y 26
comunicaciones que eran 2—, pero `seed-pqrs-piloto.mjs` no lo escribe y la
sombra no lo lee.

Si se resiembra el piloto con la sombra encendida: 16 tickets `con_sla` gastan
USD 0,014 **y entran en el conjunto de evaluación de G7 indistinguibles de los
reales.** Es el mismo defecto que ya infló un baseline dos veces, esta vez en el
sitio donde se cobran las dos puertas de escala.

**ARREGLADO el 17 de agosto, y comprobado en staging.** La sombra omite con
motivo `sembrado` cuando el ticket **o su conjunto** traen `isExample` —hacen
falta los dos caminos, como en `audit-volumen-ia.mjs`— y `seed-pqrs-piloto.mjs`
ya marca lo que escribe. Verificado con un ticket sembrado en
`tenant-nogal-bogota` (`con_sla`, donde sí clasificaría): salió
`omitida`/`sembrado` y **`aiUsage` siguió con una sola llamada de la sombra**,
la de pago. Es decir: no se pagó por él.

**Staging quedó limpio el 17 por la noche.** Los tres tickets de prueba
(`PQRS-SOMBRA1/2/3`) y sus filas de `aiAssistance` están borrados: **0 filas**.
Se crearon para comprobar la sombra y su sitio no es el conjunto de evaluación —
uno llevaba además una decisión fabricada para probar el congelado, y eso en G7
es un par que nadie tomó.

**Y los dos comunicados del 14 en `tenant-palmas-cdmx` también**, tras comprobar
—no dar por bueno— que sus textos están transcritos en
`datasets/evaluacion/resultados/2026-08-14-sesion-administrador-2.md` (líneas 101
y 105). El conjunto queda con **0 comunicados**: si algún día se retoma la línea
base de comunicaciones, ya se puede tomar a ciegas.

**F3 CERRADA el 17 de agosto**: la entrada de §9 quedó firmada por David y
escrita en los dos sitios —el criterio de §9, tachado y reformulado como se hizo
con el de `category`, y el registro de decisiones—. El 0% de afirmaciones lo
cumple el sistema (comprobación de servidor + revisión forzada + resaltado), no
el modelo, que se queda en 6,6%. Con el alcance dicho: lo prohibido es **afirmar
acciones**; el compromiso futuro —«procederemos a revisar»— lo permite la regla
dura, y su subida de 45 a 59 es la conducta desplazándose a la forma buena.

**Tres decisiones de David del 17 de agosto que siguen rigiendo:**

- **Sin más pruebas con administradores por ahora.** La línea base del tercer
  administrador y H2′ quedan aparcadas, no canceladas; la pregunta por la
  respuesta 3 pasa a **mensaje asíncrono**. Los dos comunicados del 14 en
  `tenant-palmas-cdmx` pierden urgencia, pero siguen por borrar.
- **El orden: sombra de F4 primero; PRD de FEAT-001 (onboarding) después.**
  ~~Sombra de F4~~ **construida el 17 de agosto** (arriba). Sigue FEAT-001, que
  quedó más pequeña de lo que decía el plan maestro: el importador ya está en
  producción y `importRuns` recoge solo los encabezados no mapeados. Faltan los
  15–25 archivos reales (recolección comercial) y la corrección anotada: son
  **10** pasos de activación, no 7.
- **Por redactar y firmar: la entrada de §9 en el registro de decisiones** —
  el «0 afirmaciones no sustentadas» lo cumple el SISTEMA (comprobación de
  servidor + revisión forzada + frase resaltada), no el modelo, que queda en
  6,6%. Misma lógica de la decisión rectora: la exigencia se mueve a la puerta
  de salida. **Borrador entregado el 17 por la noche, pendiente de que David lo
  apruebe**; sin esto F3 no cierra.

## La frase marcada se resalta dentro del borrador, y staging ya sirve la v2 (16–17 ago 2026, noche)

**La decisión que más abajo figura como pendiente se tomó: las dos cosas, y las
dos están en el repo.** La comprobación del servidor (commit `20e341f`) ya
forzaba `needsHumanReview`; ahora además dice QUÉ frase y DÓNDE, y la pantalla
la resalta dentro del borrador y la nombra en el aviso. Es la única palanca que
la sesión de F3 dejó viva: el aviso general se probó con una persona y publicó
literal igual.

Dónde vive cada pieza, con su porqué al lado en el código:

- **El criterio no se movió ni se duplicó:** `afirmacionesDeAccion` en
  `functions/src/ai/afirmaciones.ts` devuelve todas las coincidencias con su
  posición, y `afirmaAccion` —de donde sale el 6,6%— delega en ella.
- **El fragmento viaja por el SOBRE de la callable (`frasesMarcadas`), no por
  `output`:** el esquema de salida se le manda al modelo dentro del prompt
  (`z.toJSONSchema`), así que meterlo ahí obligaría a subir a v3 y a remedir
  los 152. La operación sigue en v2 y la corrida del 17 sigue valiendo.
- **En `aiUsage` sigue entrando solo la categoría, nunca la frase** — la
  distinción está escrita en `FraseMarcada` del catálogo.
- El corte en pantalla es un módulo puro (`src/lib/ai/frases-marcadas.ts`) que
  **descarta toda posición que no corte exactamente su texto**: el frente se
  despliega con el push y las functions a mano, y en esa ventana el campo llega
  ausente (es opcional en `callables.ts`) o podría llegar de otro criterio.
  Resaltar palabras inocentes mataría la confianza igual que la mató el aviso.
- El aviso sin frase marcada corrige la cifra: **10 de 152 con el criterio
  congelado**. El «44 de 152» era el conteo a mano no reproducible, y su
  ejemplo («procederemos a…») es un compromiso futuro permitido, no una
  afirmación.

**Desplegado y verificado leyéndolo:** `asistirTicketPqrs` actualizada en
`vivaru-staging-02` el 17 de agosto a las 04:14 UTC (`updateTime` leído con
`gcloud describe`, estado `ACTIVE`). **Solo esa función, a propósito**: es la
única cuya conducta cambió, y un deploy total arrastraría functions con
secretos (Resend) sin ganancia. Ojo del día: **caducaron LAS DOS credenciales,
que son distintas** — `firebase login --reauth` (deploy) y `gcloud auth login`
(lecturas); la de ADC para scripts (`gcloud auth application-default login`) es
una tercera y no se renovó esa noche. El frente salió solo con el push; la
señal de que ya sirve lo nuevo es el aviso del borrador diciendo «10 de 152».

**Nadie ha visto el resaltado pintado.** La evidencia es de tests: 291 en
functions y 937 en cliente (los 7 rojos son preexistentes, comprobado
corriéndolos contra HEAD sin estos cambios). La comprobación de punta a punta
es una llamada real de David en staging (USD 0,0009) — y el resaltado solo
aparece si el borrador trae afirmación (~1 de cada 15 con la v2): no verlo en
una llamada no dice nada malo.

**De los tres bloqueos de F4, dos cayeron esta noche: el resaltado y el default
de `priority`.** «Media» ya no es el arranque: el selector parte de «Sin
prioridad» —estado real, solo visible mientras el ticket no la tenga—, guardar
sin elegir NO escribe el campo (se omite, no se pone en `null`) y el feedback
anota `null` en ese eje; `classifiedAt` se escribe igual, porque la persona sí
clasificó categoría y tipo. Cero cambios en functions: el esquema del feedback
ya aceptaba `null`. Lo sostiene por los dos lados
`tests/pqrs-clasificacion-prioridad.test.ts`. **Con el despliegue de arriba,
los tres bloqueos de F4 cayeron la misma noche** (`d08ec7c`, `e2686f8` y el
deploy). Antes de F4 quedan los pendientes que no son código: el censo de
producción, borrar los dos comunicados del 14 en `tenant-palmas-cdmx`, y la
pregunta al administrador por su respuesta 3.

## La v2 de `pqrs-asistir` está medida: las afirmaciones caen de 21,1% a 6,6% (16 ago 2026)

**Lectura en `datasets/evaluacion/resultados/2026-08-16-pqrs-v2-afirmaciones.md`.**
Un solo cambio: **una regla dura nueva** —no afirmar acciones de la
administración que no consten en el historial— en `reglasDuras` de
`functions/src/ai/catalog.ts`, con `version` de la operación subida a **2** para
que la telemetría no mezcle los dos contratos en una columna. 152 casos, USD
0,1435.

- **A (acción dada por hecha o en curso): 32/152 → 10/152.** −69%.
- **La clasificación NO se movió:** `category` 82,1→82,9%, `type` 70,7→69,3%,
  `priority` 72,4→71,7% — ±2 casos, que a temperatura 0,2 es ruido. **Las tres
  puertas duras intactas:** inyección 8/8, nulls 12/12, guardrail 32/32. Era el
  riesgo real del cambio y no se materializó.
- **B (compromiso futuro) sube de 45 a 59.** El comportamiento se desplaza a la
  forma permitida, que es justo lo que la regla pide («dice qué se hará»).
- **El criterio de §9 sigue sin cumplirse: pide 0 y hay 6,6%.**

**Y el prompt ya no es la palanca: 8 de los 10 que quedan son «estamos
verificando» o «estamos revisando», la frase que la propia regla cita como
prohibida con esas palabras exactas.** Para llegar a 0 hace falta algo
determinista — comprobación en el servidor que fuerce `needsHumanReview`, o
resaltar la frase en la pantalla. **Decisión tomada el 16 por la noche: las dos
— ver la sección del resaltado, arriba.** Otra vuelta de prompt no se
recomienda.

**Nota de método:** «44 de 152» de la Fase 2 **no era una línea base
reproducible** —conteo a mano sin criterio escrito, mezclando acciones afirmadas
con futuros condicionales—. El criterio de ahora está congelado en
`functions/scripts/medir-afirmaciones-pqrs.mjs`, **con autoprueba de 11 casos que
corre antes de contar**.

## La sesión de F3 se hizo: el circuito funciona y el criterio de veracidad falla 2 de 6 (16 ago 2026)

**Lectura completa en
`datasets/evaluacion/resultados/2026-08-16-sesion-pqrs-f3.md`.** Nueve tickets en
ocho minutos, seis con asistencia, **USD 0,0055 la sesión entera**. La hoja de
anotación no se llenó; se reconstruyó entera cruzando `aiUsage.createdAt`,
`ticket.classifiedAt` y `aiFeedback.createdAt`, que encajan uno a uno — **y salió
por suerte**: con dos tickets en paralelo o una recarga no habría salido.

**Lo que hay que saber sin abrir el documento:**

- **Cuatro pares limpios y CERO correcciones**: las cuatro clasificaciones
  guardadas son idénticas a la sugerida. Otras dos las leyó, publicó el borrador
  y **no guardó clasificación ninguna**. El instrumento de G7 existe y escribe;
  cuatro pares no miden una exactitud.
- **`distanciaEdicion: 0` en las seis.** Publicó el texto del modelo sin tocar
  una palabra.
- **El criterio de lanzamiento «0 afirmaciones no sustentadas» FALLA: 2 de 6.**
  `P010` («actualmente estamos verificando con el equipo de mantenimiento») y
  `P009` («estamos revisando los registros de mantenimiento y seguridad»), en
  tickets sin respuesta previa. **Y con el aviso de las 44/152 puesto en
  pantalla**: se probó con una persona y no cambió nada. La regla dura pasa a v2
  del prompt de `pqrs-asistir`.
- **Ninguna de las siete prioridades la eligió una persona:** tres son el default
  `medium` de tickets que nacen sin prioridad —la trampa anotada la víspera, que
  se cumplió en el primer bloque— y cuatro son del modelo aceptadas. **Arreglar
  el default es prerrequisito de F4**, ya no por deducción.
- **Los dos sintéticos se trabajaron A MANO y sin análisis:** eran los dos
  primeros de la bandeja porque se sembraron con 14 y 15 días y la lista ordena
  por antigüedad. La defensa de inyección sigue 8/8 offline y **sin verse en
  pantalla**. Si se repite, sembrarlos con antigüedad baja.
- **Buzón simple no se trabajó en la sesión**; una lectura suelta ese día
  confirma los nulls por tercera vez.
- **H2′ sigue sin medirse: cuarta sesión.** Escribió los dos comunicados **con el
  asistente y antes de PQRS**, y en `tenant-nogal-bogota`, no en el conjunto de
  comunicaciones. Los dos avisos del 14 en `tenant-palmas-cdmx` siguen sin
  borrar. Deja tres patrones confirmados por una **tercera persona
  independiente**: edición 0%, descartó tres preguntas de dato faltante y no
  contestó ninguna, y pidió dos propuestas en un aviso. **Tres de tres.**
- **La respuesta 3 abre una causa que la PRD no tenía prevista:** corrige «por
  conocimiento histórico del condominio que no viene inmerso en la PQRS» — una
  corrección que **no es un error del modelo**, porque §7 le niega esa entrada a
  propósito. Si es frecuente, la referencia de la sombra tiene que distinguir «se
  equivocó» de «no podía saberlo». Su límite: en los datos de la sesión no hay
  ni una corrección, así que habla de algo que no ocurrió ahí. **Hay que
  preguntárselo.**


## El guion de la sesión de F3 está escrito, y staging no estaba como decía el traspaso (16 ago 2026)

**El guion vive en `docs/guion-piloto-pqrs.md`**, con el patrón del de
comunicaciones. Seis partes, ~95 minutos. Dos decisiones tomadas ese día:

- **El participante es un tercer administrador, persona nueva**, así que la
  línea base de comunicaciones a ciegas **va, y va primero**. Prerrequisito duro
  que no estaba escrito en ningún sitio: `tenant-palmas-cdmx` **tiene dentro los
  dos avisos asistidos del 14 de agosto**, y son avisos bien redactados en
  pantalla — justo lo que la línea base no puede ver. Hay que borrarlos antes;
  sus textos quedan transcritos en la lectura del 14, así que no se pierde nada.
- **`SYN#2` y `SYN#6` entran, al final y fuera del bloque medido**, y se desvía
  al administrador si abre `PQRS-P017` o `PQRS-P018`. Se descartó borrarlos y
  reponerlos: volver a correr el sembrado reescribe los 24 por `merge` y borra la
  clasificación que el administrador acabe de dejar.

**Dos defectos de instrumentación encontrados leyendo el código, y los dos caen
sobre la cifra que la sesión viene a producir:**

1. **La fila de `aiFeedback` no dice de qué ticket habla.** El esquema es
   `.strict()` y no tiene `ticketId`; el servidor añade `tenantId`, `uid` y
   `createdAt`. Un mismo ticket abierto dos veces deja **dos filas**. Sin una
   columna de orden escrita a mano, «corrigió la categoría en 4 de 9» es un
   número sin tickets detrás. **Es lo que decide que los sintéticos vayan al
   final:** una fila suya en medio del bloque ya no se puede excluir.
2. **«Media» no es una decisión.** El selector de prioridad arranca en
   `selectedTicket.priority ?? "medium"` (`src/app/(admin)/admin/pqrs/page.tsx:168`)
   y los tickets de PQRS **nacen sin prioridad**. Guardar sin tocar nada escribe
   `guardada.priority: "medium"`, que si el modelo propuso `high` se lee como
   corrección deliberada. **Es la misma familia del `type: "petition"`** de buzón
   simple: un valor por defecto con apariencia de elección humana. En la sesión
   se sortea con una columna en la hoja; **en la sombra de F4 no hay nadie
   mirando, así que arreglarlo es prerrequisito de F4.** *(Arreglado el 16 por
   la noche — ver la sección del resaltado, arriba.)*

**Y el ambiente no estaba como decía este documento.** Decía 18 tickets en
`tenant-nogal-bogota` y 6 en `tenant-santa-maria`; **había 2 y 0** — un
`--limpiar` seguido de un sembrado que se cortó en el segundo ticket. Las cuatro
banderas sí estaban encendidas y la variante de buzón sí era `buzon_simple`.
**Vuelto a sembrar y verificado leyéndolo:** 18 y 6, 4 con respuesta previa, 0
con `priority`, 0 con `classifiedAt`. Hay que **volver a sembrar el mismo día de
la sesión**: la antigüedad se calcula al sembrar y el semáforo de SLA depende de
ella. Nota: `aiFeedback` ya arrastra 5 filas de `pqrs-asistir` de los ensayos y
`aiUsage` 17 llamadas — al leer el resultado, filtrar por fecha y `uid`.

**Sigue pendiente y sin hacer: el censo de tickets de producción.**

## F3 de PQRS: staging montado y ensayado; falta la sesión con la persona (15 ago 2026)

**El circuito entero funciona en staging y está ensayado a ciegas tres veces.**
Lo único que queda de la Fase 3 es la sesión con un administrador.

**Cómo está el ambiente, verificado leyéndolo y no de memoria:**

| Qué | Dónde | Estado |
|---|---|---|
| Functions | `vivaru-staging-02` | `asistirTicketPqrs` creada; `run.invoker` comprobado llamándola |
| Frente | `develop` → App Hosting | desplegado; remoto verificado |
| Tickets `con_sla` | `tenant-nogal-bogota` | 18 sembrados (16 casos + 2 de inyección) |
| Tickets `buzon_simple` | `tenant-santa-maria` | 6 sembrados; **variante cambiada a `buzon_simple`** |
| Banderas | `/superadmin/flags` | `ai-gateway`, `ia-proveedor-real` y `ai-pqrs-suggestions` **encendidas** |

**Accesos de la sesión:** `admin@elnogal.co` para el conjunto grande y
`admin@santamaria.co` para el de buzón — cuentas demo, contraseñas en
`seed-data-co.mjs` y `seed-demo-users.mjs`. **Ojo: `tenant-santa-maria` existe
también en PRODUCCIÓN**, con otros tickets y sin nada de esto; lo que distingue
un ambiente del otro es la URL, no el nombre del conjunto.

**Cifras reales del ensayo, con el proveedor de verdad:** 12 asistencias, todas
`ok`, `gemini-3.1-flash-lite`, **USD 0,00089 por asistencia** — confirma la cifra
de G5 (USD 0,001) ahora sobre entradas de producto y no sobre el gold set.

**Y la cadena de medición, probada de punta a punta**, que es lo que justificaba
la fase: un ticket que nace `pqrs`, el modelo propone `maintenance`/`high`, la
persona lo acepta y guarda, y la fila queda con las dos mitades juntas —
`sugerida` y `guardada`, más `distanciaEdicion` del borrador.

**Antes de la sesión hay que volver a sembrar.** El ensayo clasifica y responde
el primer ticket para poder probar `guardada`, así que deja huella:

```
FIREBASE_PROJECT_ID=vivaru-staging-02 node functions/scripts/seed-pqrs-piloto.mjs \
  --tenant-con-sla=tenant-nogal-bogota --tenant-buzon=tenant-santa-maria --limpiar
```

**Lo que encontró el ensayo y no se habría visto de otra forma: de once
asistencias llegaba UNA fila de feedback.** El envío estaba enganchado solo al
desmontaje de la pantalla, al cambio de ticket y al ocultarse la pestaña —
ninguno ocurre cuando alguien analiza, cierra el panel y se queda donde está, que
es lo que hace un administrador en una sesión guiada. Se habría hecho la sesión
entera y salido casi sin datos. Corregido: cerrar el drawer manda la fila.

**El validador falló cuatro veces antes que la aplicación**, y las cuatro se
arreglaron en él: comparaba distinguiendo mayúsculas contra rótulos con
`uppercase` en CSS; leía un `select` de la lista de atrás en vez del del drawer
(«all» antes y después: un check que pasa siempre mirando lo que no es); leía la
pantalla antes de que el drawer apareciera, dando resultados distintos en dos
corridas iguales; y mezclaba «falló» con «no llegó a correr», de modo que un
`waitUntil` mal elegido imprimía «PUERTA DURA: buzón simple enseñó clasificación»
sin haber mirado nunca esa pantalla.

**Dos cosas que quedaron anotadas y no se tocaron:**

- **La PRD dice «producción tiene 0 tickets» y no es exacto**: `tenant-santa-maria`
  en producción tiene 6, creados por la aplicación, anteriores y ajenos a esto
  (uno se llama «oiyutiuyt»). Es un conjunto demo, así que «0 tickets reales de
  residentes reales» probablemente siga siendo cierto — pero el número escrito no
  es el que hay. El censo completo de producción quedó sin hacer.
- `residencial-vista-prueba-012a42` se usó un momento como conjunto de buzón y se
  **devolvió a su estado original** (tickets borrados, variante de vuelta a
  `con_sla`): su único administrador es la cuenta del trial autoservicio, cuya
  contraseña no está en ningún seed, así que ni se podía ensayar ni enseñar.

**El hallazgo que más pesa: el administrador no podía clasificar, y eso dejaba
sin suelo a las DOS puertas de G7.** Al ir a pintar las sugerencias no había
dónde aceptarlas. Medido: `category` nacía constante, `type` lo fijaba el
residente y el drawer lo enseñaba de solo lectura, y **`priority` no se escribía
nunca** — el campo solo vivía en el tipo de TypeScript; todas las prioridades del
repositorio son del módulo de soporte, otra colección. Las dos puertas movidas a
G7 se cobran «contra la decisión real del administrador» acumulada por la sombra,
y esa decisión no existía: la Fase 4 habría acumulado sugerencias contra un
hueco. **Es el tercero de la familia de `category` y `type`** —constante,
descriptivo y ahora inexistente—, y llegó por el mismo camino: mirar el producto
y no el kappa. No es un fallo del instrumento sino del plan, que dio por supuesta
una capacidad que el producto no tenía. Decisión de David: los tres ejes
editables ya en F3.

**Lo demás que salió al construir:**

- **Puerta propia en el servidor** (`asistirTicketPqrs`), no `aiInvoke`: con la
  genérica el navegador afirmaría `variante`, que es lo que decide la puerta dura
  de `buzon_simple`. El cliente manda un `ticketId` y nada más.
- **El `historial` de producción es el contrario del que midió F2**: en el gold
  set lo escribe el residente (hilos de WhatsApp), en el producto solo la
  administración. Se mapea fiel al producto y el sembrado incluye 4 tickets con
  respuesta previa para verlo en la sesión.
- **`npm test` corría CERO tests y salía con error.** `sh` no expande
  `tests/**/*.test.ts` porque los 58 archivos están directos en `tests/`. Estaba
  anotado aquí desde el 15 como una de las cuatro veces que falló el instrumento,
  **pero el script nunca se arregló**. Ahora corre 922 tests: 915 verdes y **7
  rojos preexistentes** —`data-table.tsx`, reservas, regulations y descarga de
  QR—, ajenos a PQRS y sin tocar. Son un frente aparte.

**Lo único que queda de F3 es la sesión.** Y con la regla de orden delante: **si
usa al tercer administrador, ANTES hay que tomarle la línea base de
comunicaciones a ciegas.** Van tres sesiones sin medir H2′ porque se quemó a la
persona enseñándole la herramienta primero; aquí el riesgo es el mismo y la
herramienta es más vistosa.

Lo que la sesión tiene que mirar, que es lo que el gold set no puede dar: si el
resumen sirve, si el borrador se acepta o se reescribe, si `needsHumanReview`
aparece donde debe, y sobre todo **cuántas veces corrige la clasificación
sugerida** — que ahora, por primera vez, se puede contar.

## El desplegable del residente está corregido: F3 se queda sin prerrequisitos (15 ago 2026)

**El último bloqueo de la F3 de PQRS está cerrado**, en un solo archivo:
`src/app/(resident)/resident/pqrs/page.tsx`. Las cinco definiciones de `type`
quedan alineadas con `datasets/pqrs/taxonomia.md` —el eje es **de quién o de qué
se queja**: persona (queja) contra servicio (reclamo)— y `other` se ofrece como
«General», que es el rótulo que ya usaban las dos pantallas del administrador.

**Pero el defecto no era el que estaba escrito, y esa es la parte que vale.**
El informe decía que el residente leía las definiciones cruzadas. No las leía:
**el `map` de los botones pintaba solo `label`, y el campo `description` llevaba
muerto desde siempre.** El residente elegía entre cuatro palabras desnudas
—`Petición | Queja | Reclamo | Sugerencia`— sin una sola línea de ayuda.
Envenenaba la sombra de F4 igual, pero **por ruido y no por engaño**.

**La lección de método, que es la de siempre en este programa:** corregir las
cinco cadenas —que era el arreglo que pedía el documento— habría dejado la
pantalla **idéntica**, con el prerrequisito dado por cerrado y la sesión de
staging corriendo sobre el mismo defecto. Se vio abriendo el JSX, no leyendo la
constante. **Es la cuarta vez que el instrumento falla antes que la cosa
medida** — el tamiz que se creía sus cifras, los checks de inyección que
premiaban el rechazo, `npm test` corriendo cero tests, y ahora un campo de datos
que nadie renderizaba.

**Y apareció un tercer defecto que no estaba en ningún documento: en
`buzon_simple` todo ticket nacía con `type: "petition"`.** El selector se oculta
en esa variante, pero el estado inicial se enviaba igual — una etiqueta falsa
**con apariencia de elección humana**, y precisamente en el eje donde la PRD
exige nulls como puerta dura. **Decidido por David:** no se envía `type` y
`createTicket` cae a su default `other`.

**Dos cosas más que quedaron en la pantalla:**

- **La precedencia del árbol, escrita arriba del grupo:** «Si reportas algo que
  ya salió mal, elige Queja o Reclamo aunque además pidas que lo arreglen». Es
  la regla que **el kappa tumbó dos veces** con anotadores que conocen el
  producto; dejar que un residente la deduzca era peor.
- Las opciones pasan a una columna en móvil (ahora llevan texto, no una palabra)
  y anuncian su estado con `aria-pressed`.

**Deuda que se ve desde aquí y NO se tocó, con su prueba de que no es teórica:**
los rótulos de `type` están **duplicados en tres sitios** —esta pantalla,
`/admin/pqrs` y `pqrs-aging-widget`— y **ya divergieron**: el widget pinta
`other` como **«Otros»** y los otros dos como **«General»**, así que el mismo
ticket cambia de nombre según la pantalla. Se comprobó al ir a escribir que
coincidían. Un solo módulo compartido lo cerraría, pero es refactor con su
propio alcance —y con una decisión de copy dentro— no parte de este arreglo.

## La Fase 2 de PQRS está HECHA, y `category` se cobra ahora en la puerta de escala (15 ago 2026)

**La operación `pqrs-asistir` existe y la corrida está hecha.** Segunda
operación del catálogo, sobre el gateway que ya estaba: entrada que puebla el
servidor, salida estricta del §7 de la PRD, sin infraestructura nueva. 456
llamadas reales, **USD 0,45**. Lectura completa en
`datasets/evaluacion/resultados/2026-08-15-pqrs-evaluacion-offline.md`.

**Dos puertas duras pasan y una no:**

- **`buzon_simple` 12/12** y **inyección 8/8**, en las tres versiones de prompt.
- **`category` se queda en 82,1%** (p1), 81,4% (p2), 82,9% (p3), contra una
  puerta de ≥90%. **David decidió esa misma noche moverla a la puerta de escala
  (G7), contra la sombra** — no por no haber llegado, sino por lo que se
  encontró al mirar el código: ver abajo. **F2 queda HECHA y F3 desbloqueada.**
- Se reportan sin bloquear: `type` 70,7%, `priority` 72,4%, **recall de `high`
  94,7%** (18/19) y el guardrail **32/32** — todo `high` que propone el modelo
  llega con `needsHumanReview`. El recall va con asterisco: la definición sigue
  sin validar (kappa 0,47).
- **G5 tiene su cifra: USD 0,001 por asistencia**, del mismo orden que
  comunicaciones. 300 asistencias al mes por conjunto son USD 0,30.

**`p1-minima` gana y queda activa** — la versión con la taxonomía entera dentro
del prompt no paga su costo, igual que en comunicaciones y más marcado.

**LO QUE DECIDIÓ ESTO, y es el hallazgo que más vale de la sesión:
`category` hoy es una constante en producción.** Todo ticket que crea el portal
del residente nace con `category: "pqrs"` escrito a fuego
(`src/features/pqrs/use-tickets.ts:129`) — el residente elige `type`, no
`category`—, y **no la lee nadie**: ni `firestore.rules`, ni `functions/`, ni
`/admin/pqrs` (esa pantalla filtra y muestra `type`), ni el SLA. Su único
consumidor es un conteo del reporte del comité
(`src/features/reports/use-committee-report.ts:439`). **Es el hallazgo gemelo
del de `type`, y llegó igual: mirando el producto, no el kappa.**

**Y el baseline real no es cero: es 61,4%.** Clasificar todo como `pqrs`
—literalmente lo que hace el código— acierta 86 de 140. Salió medido sin
buscarlo: es la cifra de la corrida en simulado, porque el simulador siempre
contesta `pqrs`. Así que la comparación no era 82 contra 90 sino **82 contra
61**. Su límite, dicho: el gold set son dos edificios, no dos mercados.

**Se intentó arreglarlo con prompt y no se puede:** 19 de los 25 fallos son
`pqrs → maintenance` —preguntas y sugerencias SOBRE un tema físico— y la
versión que se lo explica (p3) **giró la frontera en vez de afinarla**: +12 en
`pqrs`, −11 en `maintenance`, neto +1, y `type` cayó nueve puntos. Cada
instrucción de frontera mueve la frontera entera.

**El candado de la decisión, para que no se convierta en costumbre.** Es la
segunda puerta que se mueve a G7, así que la PRD fija ahora **cinco criterios
que no se tocan** —inyección 8/8, nulls de `buzon_simple`, revisión humana
total con `needsHumanReview` en los `high`, cero cambios automáticos, cero
acceso cruzado— y una regla: mover cualquier otro exige la medición que lo
sostenga **y** una puerta posterior que lo recoja; nunca la sola constatación
de que no se alcanzó.

**Dos cosas más que salieron y valen para F3:**

1. **El modelo afirma acciones que nadie tomó** — «procederemos a programar la
   inspección», «hemos activado el protocolo»: 44 de 152 borradores. No lo mide
   el gold set (mide clasificación), pero en el drawer un administrador puede
   publicarlo sin que nadie haya activado nada. **Candidata a regla dura de la
   v2 de la operación.**
2. **El examen falló dos veces antes que el modelo.** Los checks de inyección
   contaban como obediencia que el borrador RECHAZARA la compensación
   (`SYN#6`) y que propusiera `low` razonándolo (`SYN#4`). Es
   **mención-no-es-obediencia por tercera vez** en este programa. Corregido, con
   prueba en los dos sentidos, y la corrida pagada se **recalificó sin volver a
   llamar al modelo** (`functions/scripts/recalificar-pqrs.mjs`).

**El prerrequisito de `buzon_simple` está cerrado:** 12 casos declarados (7 MX,
5 EC) con una columna opcional `variante` en `etiquetas.tsv`. Se eligieron
evitando `billing`, `high` y los casos ancla de la taxonomía — sus etiquetas
están impresas en el documento y ahora la taxonomía viaja en un prompt.

## El gold set de PQRS existe, con 152 casos y tres huecos dichos (15 ago 2026)

**Fase 1 de `PRD-VAI-FEAT-002`** —«medir baseline y construir gold set»— a
medias: el gold set está, el baseline no. Todo en `datasets/pqrs/`, y la
taxonomía con las definiciones y su evidencia en `datasets/pqrs/taxonomia.md`.

**Cinco ejes.** Los tres primeros son el contrato de la PRD y de `Ticket`, no
invención: `category`, `type` y `priority`. **`priority` casi se queda fuera**, y
es el que sostiene el criterio más duro de la PRD —recall de `high` ≥95%—. Los
otros dos son el tema (once, con frecuencias de dos países) y las banderas.

**152 casos: 84 de México, 60 de Ecuador y 8 sintéticos** de prompt injection,
que son los únicos que no salen de un corpus real porque un ataque no aparece
espontáneamente en un chat vecinal. Prueba en
`functions/tests/pqrs-goldset.test.ts`, mutada para comprobar que atrapa.

**Se edita `etiquetas.tsv`, NO el JSON**, y se regenera con
`scripts/construir-gold-set-pqrs.mjs`. El texto de cada caso lo pone el corpus:
tecleándolo se cuela una corrección ortográfica, y la mala ortografía es lo que
hace útil el material.

**Tres cosas que aparecieron y valen más que el conjunto:**

- **Las definiciones de `type` estaban cruzadas.** Se habían escrito en el eje de
  la severidad; el canónico es **de quién o de qué se queja** — persona (queja)
  contra servicio (reclamo). Verificado contra fuente pública, con su límite
  anotado: ese marco regula entidades públicas y una copropiedad es privada.
- **Los avisos del comité contaminaban el muestreo.** Un aviso es la salida del
  administrador; un ticket es la entrada del residente. Filtrar por remitente no
  basta: 27 de 83 avisos mexicanos los escriben residentes del comité.
- **«Cambió tu código de seguridad» inflaba `seguridad_porteria`.** Lo escribe
  WhatsApp, no una persona: 89 en México y 141 en Ecuador, y el tema entero en
  Ecuador tenía 132. Corregido, baja del tercer puesto al sexto en México. **No
  se vio contando, se vio muestreando** — el contador se creía sus cifras porque
  el ruido pasaba su propio tamiz.

**El doble etiquetado SE HIZO el mismo 15 de agosto** — 20 casos, David a
ciegas contestando en lenguaje natural. **Tumbó dos ejes de cuatro**, que es
para lo que existía: `category` 0,91 y `tema` 0,89 pasan; `type` dio **0,42**
—la definición no decía qué gana cuando un mensaje reporta un fallo Y pide el
remedio, que es el formato más común de PQRS— y `priority` dio **0,08, acuerdo
de azar**. Lectura completa en
`datasets/pqrs/doble-etiquetado/resultado-2026-08-15.md`.

**Las dos definiciones se reescribieron y los 152 casos se re-etiquetaron**:
`type` es ahora un árbol con precedencia (reportar manda sobre pedir; conducta
de personas → queja, servicios → reclamo) y `priority` tiene anclas con casos
concretos y la prueba «¿esperar a mañana empeora el resultado?». Cambiaron 23
casos, el 16%.

**La SEGUNDA muestra ciega se hizo el mismo 15 de agosto, por la tarde, y los
dos ejes siguen suspendiendo:** `type` **0,53** (umbral 0,70) y `priority`
**0,47** (umbral 0,60). Lectura completa en
`datasets/pqrs/doble-etiquetado/resultado-2026-08-15-ronda2.md`; la muestra, en
`muestra-2.tsv`. Lo que hay que saber sin abrirlos:

- **`priority` salió del azar** —de 0,08 a 0,47— y las marginales ya casi
  coinciden: **las anclas con casos funcionaron**, la frase sola no.
- **`type` falla por lo mismo que la primera vez:** cuatro de siete desacuerdos
  son A `claim`/`complaint` → B `petition`. **La precedencia «reportar manda
  sobre pedir» no prendió, y esta vez B la tenía escrita delante** — así que la
  explicación de la ronda 1 ya no sirve.
- **Sobre los `high`, que es para lo que se sobremuestreó: coinciden 3 de 5.** El
  criterio «recall de `high` ≥95%» sigue **sin ser evaluable**, ahora con número.
- **El pool limpio baja de 116 a 96, y solo 5 son `high`.** Una tercera ronda ya
  no es barata. (116, no 124: hay que excluir también los 19 identificadores que
  `taxonomia.md` usa de ancla o ejemplo — su etiqueta la imprime el documento.)

**La vuelta de definiciones de `priority` SE HIZO la noche del mismo 15 de
agosto**, por chat sobre los 7 desacuerdos de la ronda 2. Registro completo en
`datasets/pqrs/doble-etiquetado/definiciones-priority-2026-08-15.md`. En corto:
cuatro golds quedaron como estaban —B llegó solo al criterio escrito en cuanto
lo conversó, así que la sección se reescribió como **tres preguntas en orden**,
la medicina del árbol de `type`—; dos cambiaron con regla nueva (`MX#4689`
high→medium: riesgo verificado y no confirmado baja un nivel; `MX#4053`
low→medium: recurrente con evidencia que caduca); y `MX#3441` fijó la decisión
de producto: **el enfado no sube la prioridad, va en la bandera `enfado`**. Los
`high` quedan en 19 (mínimo de la prueba: 15), todo regenerado y la suite en
verde. **Y la tercera ronda se APLAZÓ por decisión de David** — el programa
lleva demasiado en validaciones de muestra—, así que `priority` queda
**corregido sin validar**: el kappa vigente sigue siendo 0,47 y el criterio
«recall de `high` ≥95%» sigue sin ser evaluable. El plan si se retoma (muestra
fresca de Colombia estratificada a candidatos `high`, kappa completo + binario
high/no-high) está escrito en el registro.

**Y la PRD se consolidó en el repo esa misma noche:**
`docs/prd/ia/PRD-VAI-FEAT-002-asistente-pqrs.md` — desde ahí es la fuente de
verdad; la copia de Drive queda como lectura. Trae la **decisión rectora de
David**: el recall de `high` ≥95% se cobra en la puerta de escala (G7), no en
la de lanzamiento — el piloto se protege con revisión humana total, no con una
métrica que hoy no es evaluable. G0–G3 superadas. Fases renumeradas: ~~**F2
evaluación offline contra el gold set (el siguiente paso ejecutable**, cuesta
centavos; prerrequisito: declarar casos `buzon_simple`)~~ **— F2 HECHA esa
misma noche; G4 y G5 superadas: ver la sección de arriba —**, F3 piloto
simulado en staging con tickets sembrados desde los corpus (**sin
prerrequisitos: el desplegable se corrigió el 15 de agosto**; si la sesión usa
al tercer administrador, ANTES se le toma la línea base de comunicaciones a
ciegas), F4
sombra en producción + piloto visible por bandera (la sombra fabrica los
150–250 tickets etiquetados que piden el Paso 3 y la Fase 5), F5 escala. El
tenant piloto se decide después de staging.

**Y lo que apareció mirando el producto vale más que el kappa:**

1. **`type` no decide nada, y ya no es pregunta: David lo confirmó el 15 de
   agosto** («van al mismo lado» — un reclamo y una petición reciben el mismo
   tratamiento). En el código tampoco: solo pinta la etiqueta y llena el filtro
   de `/admin/pqrs`. **Consecuencia: el 0,53 de `type` no bloquea nada.** El eje
   queda como etiqueta descriptiva con definiciones corregidas sin validar, y
   no se le dedica una tercera ronda. `priority` es distinto: declarado en
   `domain.ts`, usado en cero pantallas, pero la PRD le exige revisión humana
   en los `high` — **ahí va el esfuerzo de definiciones.** *(Hecho la noche del
   15 — ver el párrafo de la vuelta de definiciones, arriba.)*
2. ~~**DEFECTO VIVO EN PRODUCCIÓN:** el desplegable del residente enseña las
   **definiciones cruzadas** y no ofrece `other`.~~ **CORREGIDO el 15 de agosto
   de 2026** — ver la sección de arriba. Era mayor de lo que decía este punto:
   las descripciones **no se renderizaban**.
3. **La consecuencia de producto del kappa de `priority`:** el criterio «recall
   de `high` ≥95%» no es evaluable mientras dos personas no coincidan en qué es
   `high`. Y en los dos casos con hilo previo de la ronda 1, David etiquetó la
   conversación en vez del mensaje — si le pasa a un humano, le pasará al modelo
   con `responseHistory`: el prompt deberá separar «el ticket» de «el historial».
3. **`billing` tiene 15 casos y `buzon_simple` ninguno.** El primero no se
   arreglaba con los corpus de México y Ecuador —en Ecuador las cuotas son el
   1,3%—, pero **el 15 de agosto por la tarde llegó el tercer corpus:
   `datasets/chat-vecinal-colombia/`, 2.984 mensajes de un conjunto de Bogotá**,
   ya anonimizado con `scripts/anonimizar-chat-colombia.mjs` (llegó descrito
   como «datos limpios» y traía la dirección exacta del edificio — el README
   del corpus cuenta qué sobrevivía y qué se hizo). **Su `analisis.md` ya
   respondió lo de las cuotas: 1,7% — Colombia se parece a Ecuador y México es
   el atípico, así que `billing` NO crece por proporción; pero hay 46
   candidatos (~35–40 limpios) si se decide crecerlo por muestreo dirigido.**
   Los once temas aguantan el tercer país sin categorías nuevas; el tamiz ganó
   «celador», las grafías de sistema colombianas y el marcador `<adjunto:`,
   con México y Ecuador idénticos al dígito tras cada cambio.
   `buzon_simple` sigue siendo declarar la variante en unos cuantos casos.
4. **El baseline de G1 sigue TBD** en la propia PRD: volumen de tickets, tiempo
   de primera respuesta, reclasificaciones. No lo da ningún corpus, y producción
   tiene **cero tickets**.

## Todo el lote está en producción, verificado contra el ambiente (15 ago 2026)

**`master` quedó en `512ba38`: 75 commits promocionados**, los primeros desde el
8 de agosto. El orden fue el seguro —reglas → índices → functions → front— y
cada paso se comprobó contra el ambiente, no contra el «Deploy complete!»:

- **Reglas:** antes de desplegar se bajó el ruleset vivo y era idéntico a
  `master` byte a byte — nadie había tocado la consola. Las nuevas (849 líneas)
  quedaron idénticas a `develop`, comprobado igual.
- **Índices:** 50, los dos nuevos de `aiUsage` en `READY`.
- **Functions: 64** (eran 60). `aiInvoke`, `registrarFeedbackIa`,
  `registrarImportacion` y `getAiUsage` nacieron **con** `allUsers →
  run.invoker` — la trampa no mordió, comprobado servicio por servicio.
  `onCommunicationCreated` ya lee `notificationSummary`, y el cron de retención
  purga la telemetría de IA vencida.
- **Front:** `vivaru-build-2026-08-15-001` sirviendo; landing 200 en la raíz.
  El rollout lo dispara la conexión de App Hosting con el repo al empujar
  `master` — tarda unos diez minutos, verificado mirando la revisión de Cloud
  Run, no el reloj.

**La IA está desplegada e INERTE:** `featureFlags` y `featureFlagOverrides`
están **vacías** en producción, así que todo resuelve por el default del
catálogo — las de IA apagadas. Y eso corrigió un pendiente viejo: **sembrar el
catálogo ya no hace falta.** La consola `/superadmin/flags` se pinta desde el
código y escribe el documento al primer toque; la colección vacía es un estado
completo, no un hueco.

**Lo único que un administrador ve distinto:** el importador con paso de mapeo.
Va detrás de una bandera nueva, `producto-importacion-masiva`, que **nace
encendida** porque los asistentes ya estaban vivos —una bandera apagada por
defecto los habría retirado—. Apagarla oculta la carga masiva entera, y el corte
cubre las tres entradas: botones, recorrido guiado (`?guia=`) y los modales.
Test propio en `tests/import-feature-flag.test.ts`, mutado para comprobar que
atrapa.

**Tres cosas que aparecieron por el camino:**

- **La `RESEND_API_KEY` del backend de App Hosting está en texto plano** en su
  `overrideEnv` — visible con una llamada a la API para cualquiera con lectura
  sobre el proyecto — y además quedó impresa en la sesión del 15 de agosto.
  **Rotarla**, y al rotarla guardarla como secreto referenciado, no como
  variable en claro. **HECHO el mismo 15 de agosto** — el cierre completo, con
  sus dos hallazgos, en la sección de Seguridad.
- **El gate de CI falla por tres causas y el job de deploy nunca corre.** Los
  40 errores de typecheck viven en `tests/`; `npm test` usa un glob (`tests/**`)
  que el `sh` de npm no expande — corre **cero tests y sale en 1**, por eso el
  gate está rojo hasta con la suite en verde—; y hay errores de lint
  preexistentes (4 en `UnitBulkImportWizard` vienen de `master`). Como
  `deploy-production` depende del gate, nunca ha corrido: el despliegue real lo
  hace App Hosting por su cuenta. Y si algún día se arregla el workflow, ojo:
  `firebase.json` declara `backendId: "hogaru-web"`, **que no existe** — el
  backend de producción se llama `vivaru`.
- **El CLI de Firebase (15.4.0) puede inventarse un «Changing from an HTTPS
  function to a background triggered function»** al desplegar
  `onCommunicationCreated` en lote con otras cinco. El ambiente decía lo
  contrario (`GEN_2`, trigger de Firestore, verificado con `gcloud`). Sola, se
  desplegó sin queja. Si reaparece: desplegarla aparte antes de creerle al
  error.

## Segunda sesión con administrador: el canario acertó, y la línea base volvió a quedarse sin tomar (14 ago 2026)

**Se hizo la sesión** sobre `tenant-palmas-cdmx`, con el modelo real y el
contexto desplegado. Dos avisos, cuatro llamadas, **USD 0,00262**, cero fallos.
Lectura completa en
`datasets/evaluacion/resultados/2026-08-14-sesion-administrador-2.md`.

**H2′ SIGUE SIN MEDIR, y van tres sesiones.** Los dos avisos escritos a mano no
se hicieron —las filas están borradas de la hoja, y el conjunto solo tiene los
dos comunicados asistidos—. Sin la mitad de a mano no hay comparación, y esta
persona ya no sirve para tomarla porque ya vio la herramienta. **Hace falta un
tercer administrador, y para la línea base bastan veinte minutos.**

**El hallazgo que sí vale, y contradice la lectura optimista del 13 de agosto:**
descartó **2 de 2** preguntas de dato faltante y contestó **0**
—`respondidos: []`—. El 13 eso se leyó como fallo de pantalla y se arregló; con
la pantalla arreglada, el siguiente administrador hizo lo mismo. **Ya no se
explica con la pantalla.** Y en los dos avisos el dato que falta es exactamente
el que el modelo señaló y él descartó: el modelo acertó las dos veces.

**Segundo patrón, igual de incómodo: edición 0% otra vez —dos administradores
seguidos— pero pidió dos propuestas por aviso.** La palanca que usan es
**regenerar, no corregir**, y el producto está construido para que corrijan.

**Lo que esto abre para el Paso 2.7:** si dos administradores de dos conjuntos
distintos descartan el 100% de las preguntas y editan el 0% del texto, «la lista
de lo que falta es el producto» —escrito el 12 de agosto— lleva dos sesiones sin
usarse. Es decisión de producto, no ajuste de prompt. **No tocar el contrato con
esta evidencia:** dos sesiones no son una muestra.

**El contexto del conjunto quedó comprobado fuera del banco:** las cuatro
llamadas en `operationVersion 3` y **ni una «torre», «bloque» o «manzana»** en
los dos textos publicados. Con su límite dicho: el contenido de los borradores no
se guarda, así que se comprueba sobre lo publicado, no sobre los cuatro
borradores.

## El canario está desplegado en staging y esperando a la persona (14 ago 2026)

**Desplegadas `aiInvoke` y `registrarFeedbackIa`** en `vivaru-staging-02`, a las
12:25 hora de México. Solo esas dos: el cambio del contexto vive entero en
`functions/src/ai/`, y un despliegue completo habría mezclado sesenta funciones
que nadie revisó hoy con la única que cambió. ~~**Producción sigue sin
nada.**~~ **En producción desde el 15 de agosto de 2026** — ver la sección de
arriba.

**Lo que NO hizo falta tocar, comprobado y no supuesto** —los documentos decían
que faltaba y era mentira—: las reglas desplegadas son **idénticas** a
`firestore.rules` byte a byte, los **50 índices** declarados están desplegados y
en `READY`, las **9 banderas** del catálogo están sembradas, y `aiInvoke` y
`registrarFeedbackIa` ya tenían `allUsers → roles/run.invoker` en Cloud Run. La
trampa de la callable nueva sin permiso **no aplicaba**, porque no se creó
ninguna callable nueva; y el permiso sobrevivió al despliegue, verificado
después.

**Banderas en staging, ahora mismo:** `_global.killSwitch` en `false`,
`ai-gateway` y `ai-communications-draft` **encendidas globalmente**, y
`ia-proveedor-real` **apagada**. No hay ni un override por conjunto y no hace
falta ninguno. **El día de la sesión es un solo interruptor:** encender
`ia-proveedor-real` en `/superadmin/flags`. Se dejó apagada a propósito — el
canario funciona entero con el simulador y así nada gasta dinero esperando.

**El conjunto del piloto está sembrado y vacío de avisos.**
`tenant-palmas-cdmx` («Privada Las Palmas», 24 unidades, 6 personas) es el único
sembrador que produce un **edificio único**, que es el caso donde se ve el
cambio del contexto. Verificado contra los datos reales con
`resolverContextoConjunto`: da `{tieneAgrupaciones: false}`, y
`conjunto-las-playas` —el de la sesión del 13— da `true`. Sus tres avisos
sembrados se borraron con `functions/scripts/vaciar-avisos-sembrados.mjs`, para
que la línea base se pueda tomar a ciegas: tres avisos bien redactados en
pantalla le enseñan el formato igual que se lo explicaría yo. Cuenta de
administrador: `admin@privadapalmas.mx`, clave en el seed.

**Dos comprobaciones más, para no fiarse del «Deploy complete!»:** la prueba de
humo del proveedor real **desde staging** respondió en 5,2 s por **USD
0,000338** con el contrato válido, y la suite de emulador —31 casos, la que la
suite normal no corre— pasa entera, incluida la que sigue el contexto desde las
unidades de Firestore hasta el mensaje del modelo.

~~**Lo único que falta es la persona.**~~ **La sesión se corrió el mismo 14 de
agosto** — ver la sección de arriba. `ia-proveedor-real` se encendió con un
override para el conjunto del piloto y **David lo retiró desde
`/superadmin/flags` a las 16:29**, en cuanto terminó. Staging vuelve a estar
entero en simulador (`valor_global`), con el panel «Redactar con IA» encendido.
**Para la tercera sesión hay que volver a encenderlo**, y ahí está el interruptor
que se olvida.

Queda un `featureFlagOverrides/tenant-palmas-cdmx` con el mapa de banderas vacío.
Es el rastro normal de «Quitar override» —distinto de «Invertir», que dejaría un
`false` explícito y pintaría el conjunto como apartado a propósito— y **no hay
que limpiarlo**.

**Una trampa nueva, que casi cuesta cara:** `seed-tenant.mjs` apunta a
**producción por defecto** (`FIREBASE_PROJECT_ID || "hogaru-1"`). Olvidar la
variable siembra en `hogaru-1`. Siempre
`FIREBASE_PROJECT_ID=vivaru-staging-02 node functions/scripts/seed-tenant.mjs …`.

## La volumetría real de producción, por primera vez sin inflar (14 ago 2026)

**Se arregló el instrumento y el número quedó desnudo.** Los seeds de demo no
marcaban nada, así que toda métrica de producción salía inflada. Ahora el
marcador va en el CONJUNTO —una línea, en vez de recordarlo en 28 colecciones— y
`audit-volumen-ia.mjs` descuenta por los dos caminos: por documento (para los
trials, que son conjuntos reales con filas de ejemplo dentro) y por conjunto.

Marcados 7 de los 9 conjuntos de producción: los cuatro sembrados por script y
tres internos que confirmó David —la prueba E2E, el de Qintilab y
`pXHEn5iWKWgX` (suspendido, y era el que aportaba la única comunicación «real»
que se contaba)—. La lista vive en
`functions/scripts/marcar-conjuntos-de-ejemplo.mjs`, con el origen de cada uno.

**Quedan dos conjuntos reales, y esto es todo lo que hay:**

| | Conjunto Bromelias (activo) | Queretarock 229 (trial) |
|---|---|---|
| Unidades propias | 1 | **0** (6 sembradas por el trial) |
| Personas propias | 1 | **0** (6 sembradas) |
| Cobros propios | 0 | **0** (24 sembrados) |
| Tickets | 0 | 0 |
| Comprobantes | 0 | 0 |
| Comunicaciones | 1 (16 mar 2026) | 0 |

**Queretarock nunca cargó datos suyos**: todo lo que tiene se lo puso el trial.
Y en los últimos 30 días no hay ni un ticket, ni un comprobante, ni una
comunicación en toda la plataforma.

Las cifras que este documento y la hoja de ruta traían —26 comunicaciones, 20
tickets, 5 comprobantes— eran los conjuntos de demo contándose como reales. El
muro del programa de IA no se movió: **se hizo más alto de lo que se creía.**

## El contexto del conjunto, construido y medido (14 ago 2026)

**El borrador ya no pregunta por torres donde no hay torres.** La operación
recibe del servidor si el conjunto tiene agrupaciones, sacado de `units.tower`, y
subió a **v3**. El cliente no cambió una línea.

Medido con tres corridas reales, 204 llamadas, **USD 0,065**: la palabra «torre»
pasa de aparecer en 24 preguntas a **cero**; el modelo **no aprendió a callarse**
—2,09 → 2,14 preguntas por caso—; y donde sí hay torres el número no se movió
(87% antes, 87% después). Se confirmó además la sospecha del 13 de agosto: sin
contexto, en un aviso de cobro el modelo gastaba sus preguntas en las torres y
**no preguntaba el monto**.

En los ocho casos escritos para un edificio único, de **3 de 8 a 7 u 8 de 8**.

**Decidido el 14 de agosto:** en un edificio de once pisos, «¿afecta a todo el
edificio o a pisos específicos?» **sí** es una pregunta útil. Tres casos fallaban
por una afirmación mía que prohibía *cualquier* pregunta de alcance, cuando la
decisión que implementaba decía lo contrario. Ahora se prohíbe la **palabra**
—torre, bloque, manzana—, no la categoría. Se recalificó sobre los borradores ya
guardados con `functions/scripts/recalificar.mjs`, sin volver a llamar al modelo.
Lectura completa en
`datasets/evaluacion/resultados/2026-08-14-contexto-conjunto.md`.

~~**Lo siguiente, y es tuyo:** nada está desplegado.~~ **DESPLEGADO en staging
el 14 de agosto de 2026** — ver la sección de arriba. ~~**Sigue sin haber nada
en producción.**~~ **En producción desde el 15 de agosto de 2026, con las
banderas de IA apagadas.**

## El canario, tras la primera sesión con un administrador (13 ago 2026)

**Se hizo la sesión.** Un administrador real escribió cuatro avisos con la
herramienta, en staging y con el modelo de verdad. Costó **USD 0,003** y **guardó
dos avisos sin cambiar una palabra** —edición 0%—. A la pregunta de si pedirle
datos era útil o pesado contestó **«útil»**, que era el riesgo de diseño que más
preocupaba.

**Cuatro decisiones de producto quedaron cerradas por él:** no pedir el motivo,
las inferencias las firma, el resumen de la app es lo que debería llegarle al
residente, y los cuatro datos son los correctos.

**Lo que salió y ya está corregido:**

- **No sabía dónde contestar las preguntas** de qué faltaba, y usó «No aplica»
  para salir del paso — contaminando la métrica desde su primer uso. Ahora cada
  pregunta tiene su campo debajo, y **contestar se cuenta aparte de descartar**.
- **El modelo alteró un dato en un aviso de dinero**: él escribió «2500 por
  residente» y el borrador publicó «por unidad», reproducido 3 de 3. De ahí
  salieron **dos reglas duras** y una tercera clase de fallo en el evaluador
  (`ALTERADO`). v2-estructura pasó de **80% a 87%**, cuatro casos arreglados y
  ninguno roto.
- **`notificationSummary` ya llega al residente.** Antes la notificación decía
  la misma frase genérica para todos los comunicados.

**Lo que la sesión NO midió, y hay que decirlo:** **H2′ sigue sin medir.** Los
dos avisos escritos a mano —la línea base— no se hicieron, y **con este
administrador ya no se pueden tomar**: al final se le enseñaron los cuatro
datos. Lectura completa en
`datasets/evaluacion/resultados/2026-08-13-sesion-administrador.md`.

**Y hay un segundo corpus.** `datasets/chat-vecinal-ecuador/` — un edificio de
Quito, seis años y nueve meses. Contesta la limitación que arrastraban los tres
documentos del canario: **los cuatro datos generalizan** (1,13 de 4 en Ecuador
contra 1,31 en México, cifras corregidas el 14 de agosto al arreglar dos
detectores del tamiz) y **«cuánto dura» es el peor dato en los dos países**, que
es lo que sostiene la decisión más visible de la pantalla. De paso reinterpreta
la mitad de los fallos que le quedan al modelo: pedir «a quién afecta» donde no
aplica no es defecto del modelo, es del diseño — el conjunto mexicano tiene
torres y el ecuatoriano no. Detalle en su `analisis.md`.

## El canario está construido y probado con manos humanas (12 ago 2026)

**El Paso 2.5 está cerrado.** Existe una pantalla: el panel «Redactar con IA»
dentro del formulario de crear comunicado, plegado detrás de un botón, con la
lista de lo que falta ordenada y el feedback registrándose. Detalle completo en
el registro de ejecución de `docs/hoja-de-ruta-ia.md`.

**Probado en staging con el modelo real el 12 de agosto:** 4 llamadas, 3.805
tokens, **USD 0,0018**. El borrador salió correcto y David lo aplicó. La
bandera `ia-proveedor-real` quedó **apagada** al terminar.

**Lo que bloquea el piloto (Paso 2.6), en orden:**

1. ~~**Nada de esto está en producción.** Reglas, índices, functions y banderas
   viven solo en `vivaru-staging-02`. Los administradores reales están en
   `hogaru-1`.~~ **RESUELTO el 15 de agosto de 2026:** todo está en producción,
   con las banderas de IA apagadas. Encender el canario para un conjunto real
   ya no exige desplegar nada — es la consola de banderas.
2. ~~**A quién se le entrega el piloto.**~~ **DECIDIDO el 12 de agosto de 2026:
   al administrador, hipótesis H2′.** Es para quien se está comercializando
   Vivaru. **No exige tocar código**: el catálogo ya autoriza solo a
   `tenant_admin` y `admin_tenant`. **H3 queda aparcada, no descartada** —para
   una administradora con varios conjuntos, «que cualquiera escriba como un
   profesional» es consistencia de cartera, y el rol `committee` ya existe, así
   que habilitarlo sería una línea.
3. **Conseguir al administrador.** El guion de la sesión está escrito y listo
   para ejecutar: `docs/guion-piloto-comunicaciones.md`. Falta la persona.

**Por qué el piloto es una sesión y no una bandera encendida:** producción tiene
**una sola comunicación real en toda su historia**, del 16 de marzo de 2026
(medido el 14 de agosto, ya sin conjuntos de demo contándose). No es rechazo del
módulo: **Vivaru todavía no se comercializa para ese uso.** Esperar tráfico
orgánico es esperar sentado.

*(La duda quedó resuelta el 14 de agosto: ni una cosa ni la otra. Las 26 eran
los cuatro conjuntos de demo contándose como reales. **No entraron clientes.**
Con el marcador puesto, las comunicaciones reales de toda la historia de
producción son **1**.)*

**Decisiones de producto abiertas, las tres pequeñas:**

- ¿El borrador debe pedir el motivo? Hoy no lo pide **nunca** y tampoco se lo
  inventa nunca — comprobado en cinco corridas.
- Las dos inferencias que aparecieron en la primera prueba real: escribió «por
  24 horas» (aritmética sobre 7am–7am) y «recomendamos almacenar agua»
  (deducido de que no hay pipas). La segunda la pide el conjunto de evaluación
  a propósito; la primera no la pidió nadie.
- ~~**`notificationSummary` se genera y se tira.**~~ **RESUELTO el 13 de agosto
  de 2026**, después de que el administrador confirmara que ese resumen es lo
  que debería llegarle al residente. Campo opcional en el formulario; cuando
  falta, la notificación cae a la frase de siempre.

**Deuda menor, sin prisa:**

- **`qualityFlags` sigue sin cerrar, y no es olvido:** la lista de cinco
  valores de la PRD no tiene dónde meter «hechos contradictorios» ni
  «instrucción incrustada», que son 2 de los 5 problemas que el conjunto
  comprueba hoy. Cerrarlo exige inventar dos valores y reescribir cinco
  afirmaciones — su propio incremento, con su propia corrida.
- Leer a mano los 3 casos de `requiereJuicioHumano`.
- El campo `length` y el tono `formal` de la PRD, **aplazados a propósito**:
  ninguno de los 59 casos los cubre.
- **Revisar en el piloto el costo del contrato v2.** Categorizar lo que falta
  hizo que el modelo pregunte menos (de 2,32 a 1,93 datos por borrador). Se
  aceptó con los números delante; la salida, si molesta, es hacer `categoria`
  opcional. Lectura completa en
  `datasets/evaluacion/resultados/2026-08-12-contrato-v2.md`.

## Dos trampas de infraestructura que costaron una tarde (12 ago 2026)

Las dos estaban ahí desde antes y no las provocó el trabajo de IA. Se
documentan porque **el mensaje de error no dice cuál es la causa** y volver a
diagnosticarlas cuesta lo mismo la segunda vez.

- **`npm error Invalid Version:` en Cloud Build, sin decir qué paquete.** Era
  una entrada fantasma en `functions/package-lock.json`
  —`lightningcss-darwin-x64` sin `version` ni `resolved`—, que viene de
  `vitest → vite → lightningcss`. En macOS no salta nunca; en Linux tumba
  **todos** los despliegues de functions. Reparada con los datos reales del
  registro. **Su origen sigue vivo:** la caché de npm de la máquina de David
  tiene archivos que su usuario no puede escribir (`EACCES` en
  `~/.npm/_cacache`), npm no pudo cachear el paquete y dejó el hueco. Al
  regenerar el lockfile desde esa máquina, la entrada rota vuelve. **RESUELTO el
  13 de agosto de 2026**: se corrigió el permiso de la caché y se comprobó
  regenerando el lockfile en una copia — ya no reaparece la entrada rota.
- **Las funciones nuevas nacen sin permiso de invocación.** *(Matiz del 14 de
  agosto de 2026: la callable nueva `registrarImportacion` **sí** nació con
  `allUsers` en staging. Así que el fallo no es universal —depende de la versión
  de la CLI o de la política del proyecto— pero **comprobarlo sigue siendo
  obligatorio**: cuesta diez segundos y el síntoma cuando falta es un «error
  interno» sin ninguna pista.)* `aiInvoke` y
  `registrarFeedbackIa` se crearon sin `allUsers` / `roles/run.invoker` en
  Cloud Run, que es lo que tienen las otras sesenta callables. Sin él la
  petición muere antes de tocar el código y el navegador ve «error interno».
  Se arregla con `gcloud run services add-iam-policy-binding`. **Comprobarlo
  cada vez que se despliegue una callable nueva.**

## Lo que se cerró y no hay que rehacer

- **El SEO técnico se promocionó.** Llevaba un mes parado en `develop`.
  Producción sirve el landing en la raíz, `/mx` redirige con 308, y hay canónica
  por página, sitemap, `llms.txt` válido y JSON-LD.
- **Auditoría AEO: 44/100 (D) → 67/100 (C+)**, fundamentos de 34 a 76. El antes,
  el después y **por qué no se persiguen los cuatro fallos restantes** están en
  `docs/auditoria-aeo-base-ago2026.md`. Ojo con `image-alt`: es un falso positivo
  del auditor sobre un patrón de accesibilidad correcto. **No lo «arregles».**
- **Los Términos publicaban `[X días]`, `[Y días]` y `[Z días]`** en la cláusula
  de mora, y el Anexo un placeholder del DPA de Google. Rellenados: 10/15/30.
- **El copy dejó de hablar colombiano y dejó de nombrar países.** Vocabulario y
  reglas en `docs/glosario-mercados.md`; qué cadena cambió y por qué, en
  `docs/propuesta-copy-neutro.md`.
- **Los correos de demo y de lead apuntaban al apex**, que devuelve 404. Cada
  prospecto que pulsaba «Agenda una demo» desde el correo caía en una página
  rota. Corregidos al `www`.

## Decisiones cerradas, no reabrir sin que las pidan

- **Panamá NO se anuncia.** Coincide con la precedencia técnica: el país fiscal
  es `z.enum(["EC","CO","MX"])`, así que un conjunto panameño no se puede dar de
  alta. Anotado en `PAISES` de `src/lib/marketing/sitio.ts`.
- **Copy en español neutro.** La geografía sale de la prosa; los países viven
  SOLO en `PAISES`. **Abrir un mercado es editar esa línea.**
- **Primero se diferencia el contenido, después se parten las URL.** El día que
  el copy de un país sea distinto, su ruta se justifica sola. Antes no.

## Frente de IA — congelado por falta de datos, no por gobierno

- **Medido el 8 de agosto: producción tiene 0 tickets reales, 0 comprobantes y
  2 comunicaciones** en toda su historia. Todo lo demás que se cuenta pertenece
  a los tenants sembrados. **No falta owner, ni presupuesto, ni proveedor:
  falta operación.** No tiene sentido cotizar ni nombrar a nadie para evaluar
  capacidades sobre procesos que se ejecutan cero veces al mes. Para reabrir
  basta volver a correr `functions/scripts/audit-volumen-ia.mjs <projectId>`
  —solo lectura— y mirar si la columna «Real» se movió; los gold sets piden
  150–250 tickets y 100–200 comprobantes. Medición y lectura completa en
  `docs/auditoria-prd-ia-ago2026.md`.
- **La hoja de ruta para habilitarlo está escrita**, con el orden confirmado
  —Plataforma → Comunicaciones → PQRS → Onboarding → Comprobantes—, la lógica
  explicada para primer proyecto de IA y el reparto de quién hace qué:
  `docs/hoja-de-ruta-ia.md`. **El canario sí es ejecutable hoy**: comunicaciones
  es la única capacidad cuya entrada la escribe el administrador, no la base de
  datos, así que su conjunto de evaluación se construye y el muro de datos no la
  toca. El muro aparece en el paso 3, PQRS.
- **Lo que hay que empezar a acumular ya**, aunque la IA no exista: tiempos de
  redacción a mano, clasificación en sombra de cada ticket, el archivo de
  importación de cada conjunto nuevo, y comprobantes anonimizados. Es la
  diferencia entre que cada paso tarde una semana o tres meses. Tabla en la
  Parte IV de la hoja de ruta.
- **Las cinco PRD de IA están cotejadas contra el código y son sólidas.** No hay
  que rehacerlas: todo lo que declaran como baseline existe con el nombre
  exacto. Quedan válidas y en espera. Los cuatro hallazgos que mueven el plan y
  la corrección de las puertas G0–G7 —que el documento de transferencia numera
  mal— están en el mismo documento.
- **`FEAT-001` no necesita IA para su primera mitad.** Su Fase 2 es «parser,
  reglas y preview sin IA» sobre `papaparse` y `xlsx`, que ya están instalados.
  Sacarla del programa de IA y tratarla como producto normal genera el baseline
  de activación que la propia PRD necesita para cerrar G1. **Es el único
  hallazgo que cambia el orden del programa.**
- **~~Las cinco dependen de un feature flag que no tiene lector.~~ RESUELTO
  (9 ago 2026, Paso 1.1).** Las banderas tienen lector real en cliente y
  servidor, kill switch por bandera y maestro, overrides por conjunto aislados
  en `featureFlagOverrides`, y consola en `/superadmin/flags`. Se construyó
  genérico: no es una pieza del programa de IA, sirve para cualquier capacidad
  que deba poder apagarse sin desplegar. Detalle en el registro de ejecución de
  `docs/hoja-de-ruta-ia.md`. ~~**Queda por hacer en consola:** sembrar el
  catálogo (`node functions/scripts/seed-feature-flags.mjs <projectId>`) y
  desplegar reglas en cada ambiente.~~ **Ya no (15 ago 2026):** las reglas
  están desplegadas en los dos ambientes, y sembrar no hace falta — la consola
  se pinta desde el catálogo del código y escribe el documento al primer toque.
- **Ecuador no está en ningún dataset de evaluación** de `DOC-001` ni
  `FEAT-001`: piden Colombia y México, y Ecuador está en `PAISES`. Mismo punto
  ciego que `docs/brief-legal-ecuador.md`, pero aquí aprobaría una capacidad
  que falla con el primer conjunto ecuatoriano — opera en USD.
- **La wiki de negocio canónica es `Hogaru/Vivaru business - WIKI/`** (90
  archivos). `Hogaru/vivaru-wiki-negocio/` (32) es un subconjunto viejo; no
  citarla.
- **No se tocó ninguna fuente.** Drive, wikis y los dos Markdown de Hogaru
  quedaron como estaban.

## Necesita asesoría legal, no redacción

- **Ecuador no está cubierto.** Los tres documentos legales citan Colombia y
  México; Ecuador está en `PAISES` y en el `areaServed` y no aparece en ninguno.
  El brief, con el hueco localizado cláusula por cláusula, en
  `docs/brief-legal-ecuador.md`. **No hay ningún conjunto ecuatoriano firmado**,
  así que es riesgo medio y no urgente — pero el disparador es observable: el
  registro del trial guarda `pais` en el lead y en el tenant.

- **El SLA de PQRS son 15 días hábiles colombianos, aplicados a los tres
  países** (encontrado el 15 de agosto de 2026 preparando el gold set de PQRS,
  no buscándolo). `src/features/pqrs/sla.ts` hace
  `addBusinessDays(radication, 15)` sin distinguir país ni conjunto. Quince días
  hábiles es el plazo del **derecho de petición colombiano ante entidades
  públicas** (Ley 1755 de 2015). Una copropiedad es privada, así que ni siquiera
  en Colombia se sigue solo; en México y Ecuador no rige.

  **Está vivo y es el default, comprobado los dos extremos:** lo consume
  `src/app/(admin)/admin/pqrs/page.tsx:118`, y `con_sla` es el valor por defecto
  de la variante en `src/lib/config/module-variants.ts:37`. Es decir, **todo
  conjunto nuevo nace con el semáforo encendido**, y a un administrador mexicano
  le pinta el ticket en rojo por una norma que no lo rige.

  Es el mismo patrón que el copy colombiano en la página de México y que Ecuador
  ausente de los datasets: **una decisión de un país aplicada a los tres sin
  decirlo.** Y tiene una ironía que conviene ver: `PRD-VAI-FEAT-002` prohíbe
  expresamente que la IA «calcule obligaciones legales» y saca de alcance el
  «cálculo jurídico de términos» — el riesgo está vigilado del lado de la IA y
  ya existe del lado de las reglas.

  **No se ha tocado nada.** Las salidas son decisión de producto, no de
  ingeniería: dejarlo con su origen documentado, hacerlo configurable por
  conjunto, o llamarlo «meta de servicio» y no plazo legal. Entra en el mismo
  repaso legal que el hueco de Ecuador.

## Necesitan consola, no código

- **Presupuesto del proyecto completo, con SOLO ALERTAS.** El de IA ya está
  puesto (80.000 COP, con límite de inversión sobre Vertex AI). Falta el del
  proyecto entero, que es la red que atrapa lo que no viene de la IA. **Nunca
  con «Aplicación del límite de inversión»**: suspender los servicios del
  proyecto tumbaría Firestore, Auth y App Hosting. El importe sale de
  Facturación → Informes, **en pesos** — la cuenta `01E210-7D2C3B-4EB5BE` está
  en COP, no en USD, y ese detalle ya casi cuesta un incidente.

- **App Check está dormido de punta a punta** (verificado el 9 ago 2026, no es
  lo que decía la auditoría). El cliente ya llama a `setupAppCheck()` desde el
  Paso 1.2, pero sin clave no hace nada. Tres cosas, en orden:
  1. Crear una clave de **reCAPTCHA Enterprise** en Google Cloud.
  2. Registrar la app en **Firebase Console → App Check** con esa clave.
  3. Poner `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY` en `apphosting.yaml` (y en
     `apphosting.staging.yaml`) y desplegar.

  Y solo después, mirando en los logs de `aiInvoke` que el tráfico legítimo trae
  token, apagar la bandera `operacion-app-check-monitor` en `/superadmin/flags`.
  **Apagarla antes cierra la puerta para todos.** Mientras tanto no hay riesgo:
  detrás de la puerta no hay nada que cueste dinero todavía.

- **El apex `grupovivaru.com` devuelve 404.** El registro A es correcto
  (`35.219.200.1`, el mismo que el `www`); falla solo la verificación de
  propiedad porque el TXT tiene un token viejo. **Estos dos valores no están
  escritos en ningún otro sitio:**

  ```
  quitar:  fah-claim=002-02-30634e11-5bdb-4497-8f2b-bfbac3583c19
  añadir:  fah-claim=002-02-d6e6e2d2-f549-4bd2-b2fe-e34695e9f910
  ```

  No tocar el registro A. **No borrar y volver a añadir el dominio en App
  Hosting:** cada alta genera un token nuevo y reproduce el fallo.

  Dato nuevo del 8-ago: los nameservers son `ns-cloud-d1..d4.googledomains.com`,
  o sea que **la zona vive en Google Cloud DNS**, no en un registrador.
  Reconfirmado que no es visible desde `dev@qintilab.com`. **Y la misma cuenta
  Owner que hace falta aquí es la que lleva meses bloqueando la URL de acción de
  Firebase Auth: dos pendientes de largo plazo, un solo inicio de sesión.**
  Conviene pedir `roles/dns.admin` sobre ese proyecto en vez de un arreglo
  puntual. Estado consultable con
  `GET firebaseapphosting.googleapis.com/v1beta/…/backends/vivaru/domains`.

- **Dimensiones personalizadas de GA4** sin registrar: `entorno`, `section` y
  `cta`. Se recogen pero no son consultables, y GA4 no rellena hacia atrás.
  Topología de propiedades y cuentas en la memoria `analitica-ga4-vivaru`.

- **URL de acción de Firebase Auth** — pendiente desde antes, requiere la cuenta
  Owner. Ver `CLAUDE.md`, sección de estado actual.

## Seguridad

- ~~**Rotar la `RESEND_API_KEY` del backend de App Hosting de producción.**~~
  **ROTADA el 15 de agosto de 2026, de punta a punta:** clave nueva (versión 6
  del secreto), las 25 functions redesplegadas apuntando a ella, la variable en
  claro borrada de la consola, `apphosting.yaml` de `master` la referencia como
  `secret:`, la clave vieja revocada en Resend y las versiones 1–5 del secreto
  deshabilitadas. Verificado con un envío real: `[demo/email-notif-ok]` y
  `[demo/email-confirm-ok]` en los logs de la revisión `-003`.

  Dos cosas que dejó la rotación:

  - **Trampa nueva:** borrar una variable en la consola de App Hosting dispara
    su PROPIO rollout. El 15 de agosto ese rollout corrió en paralelo con el del
    push y hubo una ventana de ~5 minutos (revisión `-002`) sirviendo **sin
    clave ninguna** — dos formularios de prueba cayeron ahí y sus correos no
    salieron (los leads sí se guardaron: el envío es best-effort a propósito).
    Si se repite el patrón consola+push, esperar a que el tráfico esté en la
    revisión buena antes de verificar.
  - **Secreto huérfano:** existe un segundo secreto `resend-api-key` (en
    minúsculas, del 1 de junio) que no referencia nadie — ni funciones ni
    backend. Confirmar que nadie lo usa y borrarlo: un secreto sin dueño es una
    credencial que nadie rota.
- **Rotar cinco credenciales de producción** pegadas en el chat el 8 de agosto
  (admin, portería y tres residentes del conjunto Las Playas, dominio
  `david.macar.18+*@hotmail.com`).

## En parking lot

- **Cobranza de la suscripción.** La cláusula 5.5 de los Términos compromete una
  escalera de mora 10/15/30 que **no ejecuta ningún proceso**: hay que suspender
  a mano desde la consola. PRD completa en Drive,
  `PRD-V-OPS-001 — Cobranza de la suscripción`. Dos puertas la bloquean y
  ninguna es técnica: **G1** no hay baseline (contar conjuntos `active` contra
  cobros recibidos) y **G5** nadie tiene asignada la cobranza. Al salir del
  parking lot su sitio es
  `docs/prd/funcionales/PRD-V-OPS-001-cobranza-suscripcion.md`.

## Deuda conocida, con su porqué

- **~~Los seeds de demo no escriben `isExample`.~~ RESUELTO el 14 de agosto de
  2026.** El marcador va ahora en el documento del CONJUNTO —`seed-tenant.mjs` y
  `seed-demo-users.mjs`—, no en cada fila: ese script escribe en 28 colecciones y
  marcarlas todas dejaba el mismo agujero para la 29. `audit-volumen-ia.mjs`
  resuelve primero qué conjuntos son de ejemplo y descuenta todo lo suyo, además
  del filtro por documento que sigue haciendo falta para los trials. Lo ya
  sembrado se marcó con `functions/scripts/marcar-conjuntos-de-ejemplo.mjs`
  (en seco por defecto). **Había mordido dos veces**: los 20 tickets que eran 0,
  y las 26 comunicaciones que eran 1.

  Lo que **no** se hizo y conviene saber: las métricas de `/superadmin` no
  descuentan conjuntos de ejemplo. Ahora tienen con qué —el campo existe—, pero
  es una decisión de qué debe ver el superadmin, no una corrección.

- **Las respuestas del FAQ no llegan al DOM.** El acordeón arranca cerrado y no
  monta el contenido: solo existen en el JSON-LD y en el payload RSC. Eso hace
  que **el marcado `FAQPage` sea la única copia citable**, y convierte la
  duplicación entre `FAQ.tsx` y `sitio.ts` en algo que hay que proteger, no
  limpiar. `landing-contract.test.ts` solo compara las PREGUNTAS; las respuestas
  se sostienen a mano.
- **El comentario de `FondoHero` viaja al navegador.** Es un comentario CSS
  dentro del `<style>`, no JSX, así que el compilador no lo borra: 3,5 KB de los
  4,5 KB de comentarios que se sirven en cada visita. Documenta cómo se calibró
  el contraste del fondo animado y **tiene valor**; lo correcto es moverlo a un
  comentario de TypeScript encima del componente, no borrarlo.
- **El contrato y el sistema no dicen lo mismo sobre la suspensión.**
  `terminos.md` §5.5 promete que «inhabilita el acceso»; `tenantOperable()` deja
  solo lectura. El cliente recibe más de lo prometido. Recomendación en la PRD:
  cambiar el texto, no el código.
- `src/lib/firebase/client.ts:20` incrusta el `measurementId` de producción como
  respaldo, contradiciendo la política que documenta `config.ts`. Al lado, un
  `projectNumber` de producción que también se aplica corriendo contra staging.
  Una línea cada uno; tocarlos obliga a verificar los portales.

## Contenido

- Dos capturas del deck siguen vacías: `residente-08-documentos` y
  `residente-04-visitantes`. Las dos porque el portal del residente no muestra
  lo que crea el administrador — es una limitación del producto, no del script.

## Decisiones de negocio, no técnicas

- **Publicar precios** (punto 7 de `docs/auditoria-seo-y-llm.md`). `Pricing.tsx`
  existe y está comentado en la página. Es una de las consultas con más
  intención de compra de la categoría.
- **Páginas por intención** (punto 8). Exige validar volúmenes de búsqueda antes
  de construir nada. Las skills de investigación están en `~/.claude/skills/`;
  `research-keywords` necesita una key de SerpAPI de pago.
- **`/registro` y `/diagnostico` fallan profundidad de contenido.** Son
  formularios. Se arregla con contenido de verdad, y eso es decisión de
  conversión, no de SEO. **No rellenar con paja.**
- **Feed RSS.** Vale 8 puntos en la auditoría, pero presupone publicar contenido
  con regularidad. Un feed vacío no sirve.
- El fondo del hero se mueve 23,3 en escritorio y 9,1 en móvil. No es un fallo
  —la sección vertical deja menos superficie libre—, pero si molesta se trata
  aparte con su propia consulta de medios.
