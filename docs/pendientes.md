# Pendientes

Índice de traspaso, no resumen. Cada línea apunta a dónde está el detalle.
Actualizado el 14 de agosto de 2026, tras desplegar el contexto del conjunto en
staging y correr la segunda sesión con un administrador.

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
que nadie revisó hoy con la única que cambió. **Producción sigue sin nada.**

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
el 14 de agosto de 2026** — ver la sección de arriba. **Sigue sin haber nada en
producción.**

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

1. **Nada de esto está en producción.** Reglas, índices, functions y banderas
   viven solo en `vivaru-staging-02`. Los administradores reales están en
   `hogaru-1`.
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
- **Las funciones nuevas nacen sin permiso de invocación.** `aiInvoke` y
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
  `docs/hoja-de-ruta-ia.md`. **Queda por hacer en consola:** sembrar el catálogo
  (`node functions/scripts/seed-feature-flags.mjs <projectId>`) y desplegar
  reglas en cada ambiente.
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
