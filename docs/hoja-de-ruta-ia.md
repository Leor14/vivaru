# Hoja de ruta para habilitar la IA en Vivaru

**Escrita el 8 de agosto de 2026.** Documento de trabajo: se ejecuta paso a paso
y se actualiza al cerrar cada uno.

El orden es el del plan maestro y está confirmado:
**Plataforma → Comunicaciones → PQRS → Onboarding → Comprobantes.**

Esta guía asume que es la primera vez que haces un proyecto de IA, así que cada
paso trae el *por qué* además del *qué*. Si algo aquí te parece burocracia, lee
el porqué antes de saltártelo: casi todo lo que parece ceremonia existe porque
alguien se saltó ese paso y le costó caro.

Contexto medido que condiciona el plan: `docs/auditoria-prd-ia-ago2026.md`.

---

## Parte I — La lógica, antes de los pasos

### Qué estamos construyendo en realidad

No estamos construyendo «IA». Estamos construyendo **un circuito con un modelo
de lenguaje dentro**. El modelo es la pieza barata y reemplazable; el circuito
es el trabajo. El circuito tiene cinco eslabones y siempre son los mismos:

```
entrada acotada → llamada controlada → salida validada → revisión humana → decisión de Vivaru
```

Todo el diseño de las cinco PRD sale de proteger esa cadena. Cuando dudes de si
algo pertenece al alcance, pregunta en qué eslabón cae. Si no cae en ninguno,
sobra.

### Las siete ideas que hay que entender

**1. La plataforma va antes que la función, y no es opcional.**
Es el tablero eléctrico antes de los electrodomésticos. Si cada módulo llama al
proveedor por su cuenta, acabas con la clave del proveedor en cuatro sitios,
cuatro formas distintas de manejar errores, ninguna forma de saber cuánto gastó
un cliente, y ninguna forma de apagarlo sin desplegar. Esa es toda la razón de
`PLAT-001`. No es infraestructura por gusto.

**2. Sin línea base no hay proyecto, hay opinión.**
«Se siente más rápido» no es evidencia. Si no mediste cuánto costaba antes, no
puedes demostrar que mejoró y —más importante— **no puedes decidir matarlo**. La
línea base no es un trámite: es lo único que te permite apagar algo que no
funciona sin discutir con nadie, incluido contigo mismo.

**3. Un demo siempre funciona. Por eso el demo no vale.**
Vas a probar tu prompt con tres ejemplos y los tres van a salir bien. El cuarto
es el que te importa. Un **conjunto de evaluación** —cincuenta o cien casos con
la respuesta esperada escrita de antemano— es lo que convierte «me funcionó» en
«funciona el 92% de las veces, y los fallos son de este tipo». Escribirlo antes
de construir es incómodo y es el paso que más gente se salta.

**4. Modo sombra: probar sin arriesgar.**
Ejecutar la IA de verdad, con datos de verdad, y **no mostrarle el resultado a
nadie**. Se guarda y se compara después contra lo que hizo la persona. Riesgo
cero, aprendizaje real. Es la técnica más infravalorada del oficio.

**5. La IA propone; Vivaru decide.**
Ninguna salida generada puede convertirse sola en un estado, un saldo, un envío
o un permiso. Esto no es prudencia excesiva: es lo que te permite equivocarte
barato. Una sugerencia mala se descarta; un pago aplicado mal se reversa a mano
y con un cliente enfadado.

**6. Apagar tiene que ser gratis.**
Toda capacidad se enciende y se apaga por bandera, sin desplegar. Si apagarla
requiere un despliegue, en el momento en que la necesites apagar no vas a poder.

**7. El costo que importa no es el del token.**
Nadie compra tokens. Lo que se mide es **costo por acción y por conjunto contra
el ingreso de ese conjunto**. La estrategia fija la meta en 2–3% del ingreso, con
alerta al 5%. Un modelo carísimo usado diez veces al mes es barato; uno baratísimo
en un bucle es una factura sorpresa.

### Las puertas G0–G7, en cristiano

Son ocho preguntas que se responden en orden. No son un formulario: son la lista
de formas conocidas de que esto salga mal.

| | Pregunta de verdad |
|---|---|
| **G0** Necesidad | ¿Esto no se resuelve mejor con un formulario, una regla o una plantilla? |
| **G1** Valor | ¿Cuánto duele hoy, medido? ¿Cuánto queremos que duela? |
| **G2** Datos | ¿Tenemos con qué probarlo, y tenemos permiso de usarlo? |
| **G3** Riesgo | Cuando falle —va a fallar— ¿qué se rompe y cómo lo apagamos? |
| **G4** Evaluación | ¿Funciona fuera del demo? Enséñame los números por categoría. |
| **G5** Economía | ¿Cuánto cuesta servir esto a un cliente al mes? |
| **G6** Piloto | Con gente real usándolo, ¿mejoró algo? |
| **G7** Escala | ¿Aguanta más clientes sin que se caiga la calidad ni el margen? |

**Ojo:** el documento de transferencia (`VIVARU_Priorizacion_IA_Transferencia.md`)
numera estas puertas mal. Esta tabla es la buena; coincide con el plan maestro,
con las cinco PRD y con el uso en el repo.

Una puerta se aprueba, se aprueba con condiciones, o se rechaza. Ninguna prisa
sustituye la evidencia. Con una sola persona ejecutando, «aprobar una puerta»
significa escribir en el documento de la PRD qué respondiste y con qué dato.

---

## Parte II — Cómo trabajamos tú y yo

Reparto realista, porque somos dos y uno de los dos no tiene manos:

**Solo tú puedes:** decidir presupuesto y proveedor, hablar con administradores
reales, conseguir archivos y comprobantes de clientes, entrar a consolas de
Google y Firebase, autorizar despliegues, y decir «esto no vale la pena».

**Yo puedo:** escribir el código, escribir y versionar los prompts, construir el
conjunto de evaluación, correr las evaluaciones, medir, escribir los documentos,
y decirte cuándo un número no da.

**Cadencia sugerida:** una sesión por incremento, no por fase. Se cierra en
estado limpio y con el documento actualizado, según `docs/flujo-de-trabajo-con-claude.md`.

Al final de cada paso, la pregunta es siempre la misma: **¿seguimos, corregimos
o retiramos?** Retirar es un resultado válido y barato. Lo caro es arrastrar algo
que no funciona porque ya se invirtió en ello.

---

## Parte III — Los pasos

### Paso 0 — Cuatro decisiones, ninguna línea de código

Una sesión. Son decisiones tuyas; yo solo te doy el argumento y lo dejo escrito.

**0.1 Responsable.** Eres tú, en los tres papeles. No lo maquillemos con una
matriz RACI de una persona. Lo que sí importa es la consecuencia: **tú apruebas
las puertas, y tienes que poder decir que no.**

**0.2 Proveedor y modelo.** No está abierto realmente: `Estrategia_IA_Minima_Viable_Vivaru.md`
ya lo razona —un solo LLM económico en Vertex AI, más Document AI para OCR
cuando toque— y el argumento es bueno: ya estás en Google Cloud, un proveedor
único evita triplicar pruebas y contratos. Lo que hay que hacer es **ratificarlo
o rechazarlo, y quitarlo de la lista de pendientes.** El catálogo y los precios
quedaron verificados el 8 de agosto; el registro de la decisión está al final de
este documento.

**0.3 Presupuesto de experimentación.** Un número al mes y un tope duro. Para el
canario, algo entre 20 y 50 dólares sobra de largo. El propósito no es controlar
el gasto —va a ser ridículo— sino **obligar a que exista el mecanismo de tope
antes de que haga falta**.

**0.4 Política de datos.** Qué se guarda de cada llamada, cuánto tiempo, y qué
nunca sale de Vivaru. La regla corta: metadatos y métricas sí, contenido
completo no salvo muestra autorizada para evaluación.

> **Cómo sabes que terminó:** las cuatro respuestas están escritas en el plan
> maestro y en las PRD, y ya no aparecen como «TBD».

---

### Paso 1 — `PLAT-001`: la plataforma mínima

Varias sesiones. Es el paso más largo y el único que no produce nada visible.
Aguántalo: todo lo demás se apoya aquí.

Va en este orden porque cada pieza necesita la anterior.

**1.1 Banderas de verdad, y kill switch. — HECHO (9 de agosto de 2026).**
Existía la colección `featureFlags` en `firestore.rules` **y no la leía nadie**:
diez líneas de reglas sin consumidor. Era lo primero porque es la red de
seguridad de todo lo que viene después, y porque las otras cuatro PRD lo dan por
hecho.
*Terminado cuando:* puedes encender y apagar una capacidad para un tenant
concreto desde Firestore, sin desplegar, y se nota en la aplicación.
*Cómo quedó:* el detalle, en el registro de ejecución al final de este documento.
Se construyó **genérico**: nada bajo `src/lib/feature-flags/` sabe qué es una
operación de IA, y el programa de IA es su primer cliente, no su dueño.

**1.2 El punto de entrada único. — HECHO (9 de agosto de 2026).**
Un callable de servidor que autentica, resuelve el tenant **desde la sesión y
nunca desde lo que mande el cliente**, comprueba el rol y exige App Check. Sin
llamar todavía a ningún modelo.
*Terminado cuando:* una prueba que intenta pasar un `tenantId` ajeno falla.
*Cómo quedó:* el detalle, en el registro de ejecución al final de este documento.
Con una corrección: App Check no estaba «inicializado en cliente sin enforcement
en servidor» como decía la auditoría — estaba **dormido de punta a punta**.

**1.3 Catálogo de operaciones. — HECHO (9 de agosto de 2026).**
Cada cosa que la IA puede hacer es una `operationKey` con versión, esquema de
entrada, esquema de salida, permisos y límites. Nada se invoca si no está en el
catálogo. Esto es lo que impide que dentro de seis meses haya once llamadas
distintas que nadie sabe de dónde salen.
*Terminado cuando* (el criterio no venía en el plan, se fijó al ejecutar): la
puerta abre para una clave del catálogo y sigue negando las que no están; una
entrada que no cumple el esquema se rechaza antes de gastar nada; un rol no
autorizado *para esa operación* se rechaza; y apagar la bandera de la operación
la cierra sin tocar el resto.

**1.4 Adaptador del proveedor y validación de salida. — HECHO A MEDIAS, a
propósito (9 de agosto de 2026).**
La llamada real, y un validador con Zod que **rechaza** lo que no cumpla el
esquema. Si el modelo devuelve algo raro, el usuario ve un error limpio, no un
objeto a medias.
*Terminado cuando:* una respuesta deliberadamente malformada se rechaza y no
llega al módulo. **Cumplido.**
*Lo que falta:* la llamada real a Vertex AI. El proveedor es simulado detrás de
la misma costura que usa `SriTransport`. El validador, que es la mitad que
importa, es definitivo. **Ya no está bloqueado**: el endpoint y el tope se
cerraron el 10 de agosto (ver el registro de cierre). Solo falta escribirlo.

**1.5 Telemetría de uso y costo. — HECHO (9 de agosto de 2026).**
Por cada llamada: tenant, usuario, operación, versión de prompt y modelo, tokens,
costo estimado, latencia, resultado. Sin contenido sensible.
*Terminado cuando:* puedes responder «cuánto gastó este conjunto este mes»
mirando datos, no estimando. **Cumplido:** `/superadmin/ia`.

**1.6 Cuotas. — HECHO (10 de agosto de 2026).**
Por tenant, usuario y operación. Con actualización atómica: si no es atómica, se
evade repitiendo la llamada rápido.
*Terminado cuando:* al agotarse la cuota la acción asistida se deshabilita y el
flujo manual sigue funcionando. **Cumplido**, con la atomicidad demostrada
lanzando peticiones simultáneas contra el emulador, no dada por buena.

**1.7 Las pruebas que importan. — HECHO (10 de agosto de 2026).**
Aislamiento entre tenants, cuota bajo concurrencia, kill switch, y qué pasa
cuando el proveedor no responde.

> **Puertas que cierras aquí:** G3 (riesgo) para toda la plataforma, y la parte
> técnica de G5. **Respondidas más abajo, en el registro de ejecución.**

---

### Paso 2 — El canario: asistente de comunicaciones

**Por qué este primero, y por qué sí se puede hoy.** Comunicaciones es la única
de las cuatro capacidades cuya entrada **no sale de la base de datos**: el
administrador escribe el propósito, los hechos y el tono. Por eso su conjunto de
evaluación se *construye* en vez de extraerse, y por eso el hecho de que
producción tenga dos comunicaciones en toda su historia no lo bloquea. Además el
error es visible y barato: un borrador malo se borra.

**2.1 Línea base.** Cronometra la redacción de diez a quince comunicaciones
reales, a mano, tal y como se hace hoy. Apunta minutos y cuántas veces se
reescribe. Con pocos datos no hay estadística, pero hay orden de magnitud, y el
orden de magnitud es lo que necesitas para saber si vale la pena.
*Esto lo tienes que hacer tú o un administrador. Yo no puedo cronometrar a nadie.*

**2.2 Conjunto de evaluación: 50 a 100 casos.** Los construimos juntos. Tienen
que incluir lo incómodo, no solo lo bonito: avisos de mantenimiento, cortes de
agua, asambleas, seguridad, convivencia; borradores largos, ambiguos y
agresivos; casos a los que **les falta un dato crítico a propósito** —para
comprobar que el modelo lo pide en vez de inventárselo—; y textos con
instrucciones incrustadas, para comprobar que no las obedece.

**2.3 La operación.** Prompt versionado, esquema de salida con `title`, `body`,
`notificationSummary`, `missingInformation` y `qualityFlags`. Regla dura de la
PRD: `assumptions` debe venir vacío. Si el modelo asumió algo, no se inserta solo.

**2.4 Evaluación offline.** Corremos los 50–100 casos contra dos o tres versiones
de prompt y comparamos. **Aquí es donde de verdad se aprende**, y no cuesta
riesgo ninguno porque no hay usuarios.

**2.5 La interfaz.** Panel de hechos dentro del formulario que ya existe.
Separar visualmente lo que dio el administrador de lo que propuso la IA. Deshacer
siempre. Y lo que la IA no toca jamás: audiencia, torres, unidades, vigencia,
estado y publicación.

**2.6 Piloto.** Un tenant, bandera encendida, tú mirando. Métricas: propuestas
aceptadas, magnitud de la edición, tiempo contra la línea base, hechos inventados
—objetivo cero—, y costo por comunicación.

**2.7 La decisión.** Seguir, corregir o retirar.

> **Puertas que cierras aquí:** G1, G2, G4, G5 y G6 para `FEAT-003`. Y de paso
> validas la plataforma entera con algo real.

---

### Paso 3 — PQRS, y el muro

Aquí está el problema, y conviene verlo venir en vez de chocarse.

`FEAT-002` necesita **150 a 250 tickets reales etiquetados**. Producción tiene
cero: los veinte que se cuentan son de tenants sembrados. Y no se resuelve con
tickets sintéticos: un ticket que escribe un modelo sale demasiado limpio y
demasiado bien redactado, así que un clasificador que acierta con ellos no
acierta con lo que escribe un residente enfadado a las once de la noche.

**Lo que sí se puede hacer desde ya, y hay que hacerlo:** encender **modo sombra
desde el primer día**. En cuanto la plataforma esté en pie, cada ticket que entre
se clasifica en silencio, no se le muestra a nadie, y se guarda junto a lo que
finalmente decidió el administrador. Cuando haya volumen, el conjunto de
evaluación **ya está construido** y lo construyó la operación, gratis.

Es la diferencia entre esperar bloqueado y esperar acumulando. Instrumentar
ahora, evaluar después.

*Precondición honesta para pasar de aquí:* que existan tickets. Eso no lo
desbloquea el programa de IA, lo desbloquea vender y activar conjuntos.

---

### Paso 4 — Onboarding asistido

**Y una parte se puede empezar ya, sin IA ninguna.** La `FEAT-001` está mal
descrita en el plan maestro: no es lectura de documentos heterogéneos, es
importación de CSV y XLSX con el modelo interviniendo **solo** en los encabezados
ambiguos. Su propia Fase 2 es «parser, reglas y preview sin IA», y `papaparse` y
`xlsx` ya están instalados.

Esa mitad no depende de la plataforma de IA, no depende del proveedor y no
depende del volumen histórico —se alimenta de los conjuntos que entran—. Se puede
construir como producto normal en paralelo a todo lo demás, y de paso produce la
línea base de activación que la propia PRD necesita.

Corrección para cuando lleguemos: la PRD dice «siete pasos de activación», que es
el número del recorrido `trial`. Un cliente tiene diez (`src/lib/onboarding/steps.ts:554`).

**Desde hoy:** guarda una copia anonimizada del archivo de cada conjunto nuevo
que entre, con permiso. Necesitarás 15–25 y son los más fáciles de conseguir de
todo el portafolio.

---

### Paso 5 — Comprobantes

El último, y con distancia. Riesgo financiero alto y **el único dataset que no se
puede fabricar**: hacen falta comprobantes bancarios reales de Colombia, México y
Ecuador, con sus formatos, sus fotos torcidas y sus duplicados. Producción tiene
cinco documentos, todos de un tenant sembrado, ninguno en dos meses.

**Desde hoy:** empieza a acumular, con autorización. Cien a doscientos, variados,
incluyendo los malos. Es un trabajo de recolección que tarda meses en dar fruto,
así que empezar temprano no cuesta nada y esperar sí.

Cuando llegue: la IA propone campos y niveles de confianza. **Nunca** aplica un
pago. `approveReceiptAndRegisterPayment` sigue siendo la única puerta y la abre
una persona.

---

## Parte IV — Lo transversal: empezar a acumular hoy

Si de toda esta hoja de ruta solo haces una cosa esta semana, que sea esta.

| Qué guardar | Para qué PRD | Cuánto hace falta |
|---|---|---|
| Comunicaciones escritas a mano, con su tiempo | `FEAT-003` | 10–15 para la línea base |
| Clasificación en sombra de cada ticket | `FEAT-002` | 150–250, se acumulan solos |
| Archivo de importación de cada conjunto nuevo | `FEAT-001` | 15–25 |
| Comprobantes anonimizados, incluidos los malos | `DOC-001` | 100–200 |

Ninguna de estas cuatro cosas requiere que la IA exista. Las cuatro son la
diferencia entre que el paso siguiente tarde una semana o tres meses.

---

## Parte V — Errores típicos de un primer proyecto

- **Empezar por el caso más valioso.** Se empieza por el que enseña más barato.
  Por eso comunicaciones va primero aunque comprobantes valga más.
- **Ajustar el prompt hasta que pasen tus tres ejemplos.** Eso no es mejorar, es
  memorizar. Por eso el conjunto de evaluación se escribe *antes*.
- **Confundir uso con valor.** Que lo usen no significa que sirva. La métrica es
  cuánto lo editan y si vuelven.
- **Dejar que el modelo escriba en la base de datos.** Nunca. La respuesta del
  modelo es una propuesta y punto.
- **Medir un promedio.** Un 90% de acierto global puede esconder un 40% en la
  categoría urgente. Se mide por categoría y por campo.
- **No apagar lo que no funciona.** Una función de IA poco usada sigue costando
  soporte, mantenimiento y superficie de fallo.
- **Prometerlo antes de medirlo.** No pongas IA en el landing hasta que hayas
  pasado G6. Es la más fácil de cometer y la más cara.

## Cuándo hay que parar en seco

Apagado inmediato, sin discusión: sospecha de fuga entre conjuntos; una acción
sensible ejecutada sin confirmación; secretos expuestos; costo disparado; salidas
sistemáticamente falsas en un proceso crítico.

---

---

## Registro de decisiones — Paso 0

**Cerrado el 8 de agosto de 2026.** Ninguna de estas es irreversible: el modelo es
un valor de configuración y el tope es un número. Cambiarlas es barato; no
tenerlas escritas no lo era.

**1 · Responsable.** David, en los tres papeles. Con la obligación explícita de
poder rechazar una puerta propia.

**2 · Proveedor y modelo.** Vertex AI, proveedor único.

- Modelo por defecto: **Gemini 3.1 Flash-Lite** (USD 0,25 entrada / 1,50 salida
  por millón). Se eligió sobre el 2.5 Flash Lite, más barato, porque hay reportes
  de que se retira el 16 de octubre de 2026 — heredar una fecha de caducidad no
  compensa unos centavos. Y sobre el 3.5 Flash-Lite porque cuesta 67% más en
  salida sin aportar nada a una tarea de redacción acotada contra esquema cerrado.
- Escalamiento: **Gemini 3.6 Flash**, controlado, nunca seleccionable por el
  usuario.
- Versión fijada. Evaluación obligatoria antes de cambiarla.
- **Endpoint: global. Cerrado el 10 de agosto de 2026**, y no fue la respuesta
  que esperábamos. Ver el registro de cierre más abajo.

**3 · Presupuesto.** USD 20 al mes, tope duro, alerta al 50%. Es más de diez
veces la necesidad real y la desproporción es intencional: **el tope no controla
el gasto, obliga a que el mecanismo de corte exista y esté probado.**
Configurado el 10 de agosto de 2026 — ver el registro de cierre más abajo.

**4 · Política de datos.** Las cinco reglas aprobadas: solo se envía lo que el
administrador escribe; se registran metadatos y no contenido; las muestras de
evaluación requieren autorización y anonimización; retención de 12 meses para
telemetría y 30 días para borradores descartados; y los datos de Vivaru no se
usan para entrenar modelos del proveedor, lo que hay que confirmar contra los
términos del nivel de pago.

**Cerrado también, aunque no era una de las cuatro:** el costo de la IA no es una
variable de decisión de este programa. Cotejado contra el pricing real de las
cuatro geografías, pesa entre 0,18% y 0,68% del ingreso por unidad contra una
meta de 3%, y eso incluye el peor caso documentado (Ecuador Nivel 2). Los precios
se mantienen o suben. El detalle, en `docs/auditoria-prd-ia-ago2026.md`.

---

## Registro de cierre — los dos pendientes de consola

**10 de agosto de 2026.** Con esto el Paso 0 queda cerrado del todo y el 1.4 deja
de estar a medias por falta de decisiones.

### El endpoint: global, y el porqué no es el que se razonó

Se verificó contra el proyecto real, no contra la documentación. La cuota
`GenerateContentInputTokensPerMinutePerRegionPerBaseModel` solo conoce **tres
modelos en las 38 regiones**, todos de generación anterior:

| Ámbito | Modelos con cuota |
|---|---|
| `us-central1` y otras 37 regiones | `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-experimental` |
| **Endpoint global** | `gemini-3.0-flash`, **`gemini-3.1-flash-lite`**, `gemini-3.5-flash-lite`, **`gemini-3.6-flash`**, `gemini-2.5-*`, y modelos Grok |

**Corrección de un argumento propio.** Al abrir el tema se razonó que, estando
Firestore (`nam5`), App Hosting y las Functions en `us-central1`, la IA debía ir
ahí por coherencia de residencia de datos. El razonamiento era correcto y
**partía de una premisa falsa**: que existiera un `us-central1` capaz de servir
el modelo elegido. No existe. La elección real era *endpoint global con el
modelo decidido* o *`us-central1` con un modelo de dos generaciones atrás*.

Se eligió **global**, con tres cosas escritas para no olvidarlas:

1. **El modelo del Paso 0 se sostiene.** `gemini-3.1-flash-lite` existe, y
   `gemini-3.6-flash` —el de escalamiento— también. No hubo que reabrir nada.
2. **El riesgo de residencia es bajo para el canario, y por diseño.** La entrada
   de `comunicaciones-redactar` son tres campos —propósito, hechos, tono— y el
   esquema del Paso 1.3 deja fuera audiencia, torres y unidades. Lo que viaja es
   texto de cartelera, sin datos de personas.
3. **Deja de serlo en los pasos 3 y 5.** PQRS son textos que escriben residentes
   y los comprobantes llevan nombres y datos bancarios. **La pregunta del
   endpoint hay que volver a hacerla ahí**, y el catálogo ya admite
   configuración por operación, así que será barato hacerlo entonces.

Pendiente de política de privacidad: hay que declarar que el procesamiento con
IA ocurre con Google sin región fija. Es trabajo legal, no de consola, y se suma
al hueco de Ecuador de `docs/brief-legal-ecuador.md`.

### El tope de gasto: existe de verdad, y son cuatro capas

**Corrección de otro dato.** Se dio por sentado que un presupuesto de Google solo
avisa y que la única forma de cortar era desactivar la facturación del proyecto
—inaceptable, porque tumbaría Firestore, Auth y App Hosting—. **Ya no es así:**
la consola ofrece *«Aplicación del límite de inversión»*, que suspende
únicamente los servicios indicados. Vertex AI está entre los soportados.

| | Capa | Qué protege | Estado |
|---|---|---|---|
| 1 | Límite de inversión, 80.000 COP/mes, solo Vertex AI | El techo mensual real | ✅ |
| 2 | Cuota `GlobalGenerateContentInputTokensPerMinutePerBaseModel` = 2.000 | La velocidad a la que un bucle puede quemar | ✅ |
| 3 | Cuota por conjunto y usuario | Corta en el momento, sin esperar a Google | Paso 1.6 |
| 4 | Kill switch | Un clic, sin desplegar | ✅ Paso 1.1 |

Detalles que importan:

- **La moneda de la cuenta es COP**, no USD. El campo del importe muestra `$` a
  secas: poner «20» habría fijado el tope en veinte pesos y la primera llamada
  habría suspendido el servicio. Quedó en **80.000 COP**.
- **La cuota bajó de 25.000.000 a 2.000 tokens de entrada por minuto** para
  `gemini-3.1-flash-lite`. El valor por defecto equivalía a unos 60 USD por
  minuto de exposición; ahora son unos 7 al día.
- **El corte no es instantáneo.** Google avisa de que los costos reales tardan
  horas en consolidarse y que el límite se activa con estimaciones brutas. Puede
  haber sobrepaso — por eso las capas 2 y 3 siguen haciendo falta.
- **Que el corte duro sea seguro no es suerte:** «proveedor caído» es una de las
  cuatro formas de fallo probadas en el Paso 1.4. Si Google suspende el
  servicio, el administrador ve «puedes continuar con el proceso manual» y
  sigue trabajando.
- Los umbrales de aviso los fija Google en **50 / 80 / 100%** y no son
  editables. Van a administradores de facturación y propietarios del proyecto.
- **No se conectó ninguna automatización que desactive la facturación**, y no
  hay que conectarla nunca en `hogaru-1`.

### Datos verificados de paso

- `aiplatform.googleapis.com` **habilitada**. Su nombre comercial ahora es
  «Agent Platform API» — Vertex AI se renombró a Gemini Enterprise Agent
  Platform. El identificador del servicio no cambió.
- El proyecto `vivaru` de la consola **es** `hogaru-1`.
- Cuenta de facturación `01E210-7D2C3B-4EB5BE` («Pago de Firebase»), en COP.
- Consumo de IA a día de hoy: **cero**. Es la línea base de gasto.

### Lo que sigue abierto

- **Presupuesto del proyecto completo**, solo alertas —nunca límite de
  inversión, que tumbaría Vivaru entero—. Sacar el gasto mensual real en pesos
  de Facturación → Informes.
- **App Check**, que sigue como estaba (ver `docs/pendientes.md`).
- **El identificador exacto del modelo** al llamarlo: la dimensión de cuota lo
  nombra `gemini-3.1-flash-lite-qcd`, y el `-qcd` es casi seguro un sufijo de
  clasificación de cuota. Se confirma al escribir el adaptador real.

---

## Registro de ejecución — Paso 1.1

**Cerrado el 9 de agosto de 2026.** Primera línea de código del programa.

**Qué se construyó, y por qué así.**

**1 · Es un mecanismo genérico de plataforma, no una pieza del programa de IA.**
Nada bajo `src/lib/feature-flags/` sabe qué es una operación de IA. Sirve para
cualquier capacidad que tenga que poder apagarse sin desplegar: un módulo nuevo,
un experimento, una integración con un tercero que se cae. El catálogo hoy solo
tiene banderas de IA porque son las que hacen falta ahora; el área es un campo
(`ia` | `producto` | `operacion`), no una suposición del código.

**2 · Precedencia, de arriba abajo.** La primera que aplica gana:

| | Nivel | Qué hace |
|---|---|---|
| 1 | `featureFlags/_global.killSwitch` | Apaga **todo**, sin excepción. |
| 2 | `featureFlags/{clave}.killSwitch` | Apaga esa capacidad en todos los conjuntos. |
| 3 | `featureFlagOverrides/{tenantId}.flags[clave]` | Enciende o apaga solo ahí. |
| 4 | `featureFlags/{clave}.enabled` | Valor global. |
| 5 | Default del catálogo | Capacidad nueva → apagada. |

Los dos kill switches van **arriba** de los overrides y esa es toda su razón de
ser: si `enabled: false` bastara, una capacidad encendida a mano en cinco
conjuntos seguiría encendida en los cinco justo cuando hay que apagarla.

**3 · Dos colecciones, y la separación es de seguridad.** Los overrides por
conjunto viven en `featureFlagOverrides/{tenantId}` y no dentro del documento de
la bandera. Si vivieran dentro, cualquier residente firmado podría enumerar los
conjuntos de la plataforma leyendo el mapa. Las reglas dejan leer los overrides
solo a los miembros de ese conjunto, y escribir solo a superadmin.

**4 · El lector del cliente es en tiempo real.** Cambias el documento en la
consola de Firestore y la aplicación abierta lo acusa sin recargar. Un lector
que solo mira al montar no es un kill switch, es una configuración de arranque.

**5 · El candado real está en el servidor.** `assertFeatureEnabled` en
`functions/src/feature-flags.ts`. El gate del cliente oculta la interfaz; lo que
impide ejecutar la operación es el servidor — misma lección que el gate de
módulos del trial. Sin caché a propósito: un TTL de treinta segundos convierte
«apagado inmediato» en «apagado casi siempre».

**6 · Falla apagado, siempre.** Si no se pueden leer las banderas, todo queda
apagado y el flujo manual sigue. Y solo cuentan booleanos estrictos: un `"true"`
escrito a mano en la consola no enciende nada, y la consola de superadmin
muestra de qué nivel salió el valor para que el error se vea.

**Dónde está.**

| Pieza | Archivo |
|---|---|
| Catálogo y precedencia | `src/lib/feature-flags/catalog.ts`, `resolve.ts` |
| Lector del cliente | `src/lib/feature-flags/provider.tsx`, `src/components/shared/feature-gate.tsx` |
| Lector y candado del servidor | `functions/src/feature-flags.ts` |
| Reglas | `firestore.rules` (`featureFlags`, `featureFlagOverrides`) |
| Consola de operación | `/superadmin/flags` |
| Siembra del catálogo | `functions/scripts/seed-feature-flags.mjs` |
| Pruebas | `tests/feature-flags.test.ts` (17), `tests/firestore.rules.test.ts` (9 nuevas) |

**Lo que falta para que esto sirva de algo:** sembrar el catálogo en cada
proyecto (`node functions/scripts/seed-feature-flags.mjs <projectId>`) y
desplegar reglas. Hasta entonces el lector funciona y devuelve los defaults —
que es exactamente lo que debe hacer.

---

## Registro de ejecución — Paso 1.2

**Cerrado el 9 de agosto de 2026.** La puerta existe; detrás no hay nada todavía,
y eso es lo correcto.

**1 · El conjunto sale de la sesión, y la petición que lo traiga se rechaza.**
No es que no le creamos al cliente: es que no le preguntamos. La puerta rechaza
cualquier llamada que traiga `tenantId` en el cuerpo **aunque coincida** con el
de la sesión — aceptarlo «porque acertó» es la costumbre que abre el agujero el
día que una comprobación se olvide.

El resto del repo hace lo contrario: el cliente manda `tenantId` y el servidor
comprueba la pertenencia. Hoy eso **no tiene fuga** —la comprobación está—, pero
son 41 callables y cada una tiene que acordarse. La puerta de IA invierte la
carga: una sola, en un sitio, y probada.

**2 · Los claims proponen; la membresía dispone.** El conjunto y el rol salen de
los custom claims del token, y acto seguido se contrastan con
`tenantUsers/{tenantId}_{uid}`. Los claims viajan en el token y sobreviven a una
baja o a una degradación hasta que caduca; el documento manda. Un token que dice
`tenant_admin` sobre una membresía que dice `resident` no pasa.

**3 · El superadmin no puede invocar, y no es un olvido.** No tiene conjunto en
su sesión, así que dejarle operar exigiría aceptar un `tenantId` del cliente —
justo lo que este paso existe para impedir. Para operar sobre un conjunto, se
entra al conjunto.

**4 · Orden de las comprobaciones**, porque decide qué error ve la persona:
App Check → sesión → «no mandes el conjunto» → claims → membresía viva →
**bandera** → rol → operación. La bandera va antes que el rol a propósito:
cuando la capacidad está apagada para todos, decirle a alguien que le falta
permiso es mandarlo a pedir un permiso que no existe.

**5 · App Check estaba peor de lo documentado.** La auditoría y la wiki decían
«inicializado en cliente pero sin enforcement en servidor». Comprobado: la
función `setupAppCheck()` existía y **no la llamaba nadie**, no hay clave de
reCAPTCHA en `apphosting.yaml`, y en el servidor no había ni un `enforceAppCheck`.
Dormido de punta a punta. Corregido en la wiki.

La salida elegida fue **cablear ahora y exigir después**: el cliente ya llama a
`setupAppCheck()` —inocuo sin clave— y la puerta decide si rechaza según la
bandera `operacion-app-check-monitor`. Encendida (el default) deja pasar y
registra en los logs; apagada, rechaza. Así, pasar de observar a exigir es
apagar una bandera en `/superadmin/flags`, no desplegar.

**6 · La bandera de App Check está en positivo por el kill switch.** Dice «modo
monitor encendido» y no «exigir App Check». Si dijera lo segundo, bajar el kill
switch maestro —que apaga todas las banderas— **relajaría** una comprobación de
seguridad. Así, apagarlo todo la endurece. Es también la primera bandera del
catálogo que no es de IA y que nace encendida: la prueba de que el mecanismo del
1.1 es genérico de verdad.

**Dónde está.**

| Pieza | Archivo |
|---|---|
| Decisión de autorización (pura) | `functions/src/ai/authorize.ts` |
| El callable | `functions/src/ai/gateway.ts` → `aiInvoke` |
| Orígenes CORS compartidos | `functions/src/http-config.ts` (salió de `index.ts`) |
| App Check en el cliente | `src/app/providers.tsx` |
| Pruebas | `functions/tests/ai-gateway.test.ts` (21) |

**Se montó banco de pruebas en `functions/`**, que no tenía ninguno: vitest con
su propia configuración. El Paso 1.7 pide aislamiento entre conjuntos, cuota
bajo concurrencia y proveedor caído — nada de eso se podía probar sin esto.

**Lo que falta y es de consola:** crear la clave de reCAPTCHA Enterprise,
registrar la app en Firebase App Check, poner la clave en `apphosting.yaml`, y
solo entonces apagar `operacion-app-check-monitor` mirando antes los logs.

---

## Registro de ejecución — Paso 1.3

**Cerrado el 9 de agosto de 2026.** La puerta ya tiene detrás una lista de lo que
se puede pedir. Sigue sin haber una llamada a ningún modelo.

**1 · Una sola operación registrada, no cinco.** `comunicaciones-redactar` v1,
la del canario. Registrar ahora las cinco capacidades del portafolio sería
inventar esquemas para cosas que no se tocan en meses —la misma trampa que
ajustar un prompt hasta que pasen tus tres ejemplos, en otra forma— y un
catálogo sin una sola entrada no se puede probar. **El prompt no entra aquí:**
eso es el Paso 2.3. Lo que se fija es el contrato.

**2 · Lo que la operación NO recibe es tan importante como lo que recibe.**
La entrada son tres campos y todos los escribe el administrador: propósito,
hechos y tono. No están —y no es un olvido— audiencia, torres, unidades,
vigencia, estado ni publicación. Si no entran al esquema de entrada, no hay
forma de que salgan por el de salida. La regla del Paso 2.5 empieza a existir
aquí, no en la interfaz.

**3 · La regla dura de `assumptions` ya está en el esquema.** La salida declara
`assumptions` con longitud máxima cero: si el modelo asumió un dato que nadie le
dio, la respuesta entera se rechaza. Los dos esquemas son `.strict()` — una
clave de más es señal de que el modelo se salió del contrato, y eso no se
ignora. Quien lo hará cumplir en caliente es el validador del Paso 1.4; el
contrato ya está escrito y probado.

**4 · Los permisos se mudaron del código al catálogo.** La puerta tenía «solo
administrador» escrito a mano; ahora cada operación declara sus roles. El
superadmin no está en ninguna, por lo mismo del 1.2.

**5 · Cada operación declara su propia bandera**, además de `ai-gateway`. Se
puede apagar el borrador de comunicaciones sin apagar la plataforma. El orden de
rechazos quedó: plataforma apagada → operación desconocida → capacidad apagada →
rol. Los tres «apagado» van antes que el rol a propósito: decir «no tienes
permiso» cuando no lo tiene nadie manda a la persona a pedir un permiso que no
existe.

**6 · Los límites son números puestos para que existan.** 4.000 caracteres de
entrada, 20 segundos de corte, 1.500 tokens de salida. Son la previsión de costo
por acción antes de tener una sola medición, y se revisan con la evaluación
offline del Paso 2.4, que es cuando habrá con qué corregirlos.

**Dependencia nueva:** `zod` en `functions/`. Ya estaba en la app; es la que el
propio plan nombra en el 1.4. Primera dependencia que añade el programa de IA.

**Dónde está.**

| Pieza | Archivo |
|---|---|
| Catálogo, esquemas y validación de entrada | `functions/src/ai/catalog.ts` |
| Autorización (roles y bandera ya salen del catálogo) | `functions/src/ai/authorize.ts` |
| La puerta | `functions/src/ai/gateway.ts` |
| Pruebas | `functions/tests/ai-catalog.test.ts` (23), `ai-gateway.test.ts` (21) |

---

## Registro de ejecución — Paso 1.4

**Cerrado a medias el 9 de agosto de 2026, y el corte es deliberado.** La mitad
que valida está hecha y es definitiva; la que gasta dinero espera dos decisiones.

**1 · Por qué contra un proveedor simulado, y por qué no es un atajo.** El
criterio del paso —«una respuesta deliberadamente malformada se rechaza»— se
prueba **mejor** con un simulador: al modelo real no se le puede pedir que se
equivoque cuando a uno le conviene. Las cuatro formas de salir mal se provocan a
voluntad y están las cuatro probadas.

Y el repo ya construye así cuando algo externo no está disponible: `SriTransport`
con `stubSriTransport` en `functions/src/sri-ecuador.ts`, esperando el dato del
experto SAP↔SRI para meter el transporte real «sin tocar el resto del flujo». Es
la misma forma y por el mismo motivo.

**2 · Se rechaza entero, nunca a medias.** Media propuesta con la mitad
inventada es peor que ninguna, porque parece revisada. No se salva la parte
buena de una respuesta que incumple.

**3 · Las cuatro formas de fallar, y las cuatro terminan igual.** Proveedor
caído, tiempo agotado, respuesta ilegible y contrato incumplido. Los cuatro
mensajes acaban en «puedes continuar con el proceso manual» — es el fallback
determinista del plan, y hay una prueba que falla si algún mensaje deja de
decirlo. El detalle técnico va a los logs y nunca al usuario.

**4 · La regla dura de `assumptions` ya mata respuestas.** En el 1.3 estaba
escrita en el esquema; ahora hay una prueba que confirma que una respuesta con
un supuesto se descarta entera.

**5 · Una concesión, y dónde está la línea.** Si el modelo envuelve el JSON en
un bloque de código —cosa que hacen todos— se desenvuelve antes de parsear. Eso
es limpieza de transporte, no indulgencia: lo de dentro se valida estricto y una
clave de más se rechaza igual.

**6 · Los metadatos ya viajan.** El adaptador devuelve modelo, versión de prompt
y tokens. Hoy solo se escriben en los logs; el Paso 1.5 los lleva a una
colección. La costura está puesta para no tener que tocar el adaptador después.

**Dónde está.**

| Pieza | Archivo |
|---|---|
| Interfaz del proveedor, simulador y falso para pruebas | `functions/src/ai/provider.ts` |
| Corte por tiempo, parseo y validación de salida | `functions/src/ai/execute.ts` |
| Conexión y mapeo de errores | `functions/src/ai/gateway.ts` |
| Pruebas | `functions/tests/ai-execute.test.ts` (15) |

**Para meter el proveedor real** hace falta: la región elegida, la dependencia
`@google-cloud/vertexai`, el id de modelo fijado (Gemini 3.1 Flash-Lite, ya
decidido en el Paso 0), el tope de gasto configurado, y una implementación de
`AiProvider`. Nada más cambia.

---

## Registro de ejecución — Paso 1.5

**Cerrado el 9 de agosto de 2026.** La colección `aiUsage` y la consola en
`/superadmin/ia` contestan la pregunta del criterio.

**1 · Se registran los fallos, y no por completitud.** Una llamada que falla ya
consumió tokens —el modelo respondió, lo que no pasó fue el validador—, así que
descontarla del gasto sería mentir sobre la factura. Pero la razón de fondo es
otra: **la tasa de fallo es la métrica que dice si esto sirve.** Un registro solo
de éxitos es un tablero precioso que siempre da buenas noticias.

**2 · El costo se calcula al escribir, con la tabla de precios versionada.**
Guardar solo los tokens y multiplicar después por el precio de hoy **falsifica el
pasado**: si el proveedor sube el precio en noviembre, agosto se recalcula caro.
Se guarda el costo ya calculado junto a `priceTableVersion`. Al cambiar precios
se sube la versión; nunca se edita la tabla en sitio.

**3 · Seis decimales, no dos.** Una comunicación cuesta millonésimas de dólar.
Redondear a centavos convierte todo el tablero en ceros y hace parecer que la IA
es gratis — que es cierto hoy y dejará de serlo.

**4 · Metadatos sí, contenido no.** Ni el propósito, ni los hechos, ni el
borrador, ni el prompt. La garantía no es una promesa en un comentario: el tipo
`AiUsageEntry` **no tiene ningún campo de texto libre** donde pudiera colarse.

**5 · Si falla el registro, la operación no se cae.** `recordAiUsage` nunca
lanza. Perder una fila de medición es molesto; perder el trabajo de la persona
por no poder medirlo es absurdo.

**6 · Un modelo sin precio en la tabla registra cero y avisa**, en vez de
inventar un número. Un valor plausible y falso no se cuestiona; un cero raro sí.

**7 · Purga a 12 meses**, que es la retención del Paso 0. No estaba en el
criterio: se añadió porque escribir datos con una retención declarada y sin
mecanismo que la cumpla es la forma habitual de incumplirla. Va en el cron
diario que ya existía para los comprobantes.

**8 · El resumen avisa cuando se corta.** Lee hasta 5.000 filas del período y
marca `truncado` si hay más. Un resumen truncado que no lo dice se lee como el
total.

**Dónde está.**

| Pieza | Archivo |
|---|---|
| Precios versionados, cálculo y escritura | `functions/src/ai/usage.ts` |
| Agregación del período | `functions/src/ai/usage-report.ts` |
| Callable `getAiUsage` (solo superadmin) | `functions/src/index.ts` |
| Purga a 12 meses | `functions/src/data-retention.ts` |
| Reglas e índices | `firestore.rules`, `firestore.indexes.json` |
| Consola | `/superadmin/ia` |
| Pruebas | `functions/tests/ai-usage.test.ts` (16), reglas (3) |

**Falta desplegar los índices** (`firebase deploy --only firestore:indexes`) para
que la consulta por período funcione en un proyecto real.

---

## Registro de ejecución — Paso 1.6

**Cerrado el 10 de agosto de 2026.** Con esto están las cuatro capas de tope.

**1 · La razón de fondo no es el costo, es el aislamiento.** El límite de
inversión de Google es **de la cuenta entera**. Sin cuota por conjunto, el
primero que se desboque —un bucle, un abuso, un administrador insistente— se
come el presupuesto y deja sin capacidad asistida a todos los demás. Es el mismo
principio que sostiene el resto de Vivaru, aplicado al gasto. Y es además la
única capa que corta **en el momento**: la de Google tarda horas en consolidar.

**2 · Tres topes por operación:** 50 al día y 300 al mes por conjunto, 20 al día
por usuario. **Salen del presupuesto, no de la intuición**: en el peor caso una
llamada cuesta USD 0,0025, así que 300 al mes son USD 0,75 por conjunto y en los
80.000 COP caben unos 25 conjuntos. La línea base del Paso 2 son 10–15
comunicaciones en total, de modo que las 50 diarias están para atrapar un bucle,
no para molestar a nadie.

**3 · Atómico, y demostrado.** El plan lo advierte en una línea: «si no es
atómica, se evade repitiendo la llamada rápido». Sin transacción, dos peticiones
casi simultáneas leen «llevas 49 de 50», las dos concluyen que hay sitio y las
dos escriben 50. El consumo va en una transacción de Firestore —no vale
`FieldValue.increment`, que es atómico pero incrementa a ciegas cuando aquí hay
que *decidir* con el valor.

**Y no se dio por bueno porque el código diga `runTransaction`:** hay una prueba
que lanza 20 peticiones a la vez contra un tope de 5 y comprueba que pasan
exactamente 5, otra que verifica que el contador queda cuadrado, y otra con dos
usuarios distintos del mismo conjunto en paralelo.

**4 · Cuándo se devuelve la cuota.** Misma lógica que la telemetría: si el
modelo respondió y su salida incumplió el contrato, **los tokens se gastaron y
la cuota se queda consumida** — devolverla sería mentir sobre el costo. Si el
proveedor no llegó a responder (caído o tiempo agotado), **se devuelve**: un
proveedor caído no puede dejar a un conjunto sin cuota sin haber producido nada.

**5 · El día reinicia en UTC**, o sea a las 19:00 en Colombia. Es deliberado:
estos topes atrapan bucles, no racionan trabajo, y cuadrarlos con la medianoche
local exigiría saber la zona de cada conjunto, que hoy no se guarda.

**6 · La respuesta ya dice cuánto queda.** No hay pantalla que lo pinte porque
no hay consumidor, pero el dato viaja para que la interfaz del Paso 2 solo tenga
que deshabilitar el botón — antes de que alguien choque contra el tope, no
después.

**Dónde está.**

| Pieza | Archivo |
|---|---|
| Decisión pura y consumo transaccional | `functions/src/ai/quota.ts` |
| Topes por operación | `functions/src/ai/catalog.ts` |
| Cobro y devolución | `functions/src/ai/gateway.ts` |
| Reglas | `firestore.rules` (`aiQuotaCounters`) |
| Pruebas puras (13) | `functions/tests/ai-quota.test.ts` |
| Pruebas con emulador (11) | `functions/tests/ai-quota.emulator.test.ts` |

**Banco de pruebas con emulador**, que no existía: `npm --prefix functions run
test:emulator`, con su propia configuración para que la suite normal no falle
cuando no hay emulador levantado. Lo necesita también el Paso 1.7.

---

## Registro de ejecución — Paso 1.7

**Cerrado el 10 de agosto de 2026.**

**1 · Primero hubo que hacer probable lo que importaba.** De los cuatro frentes
del paso, dos ya estaban cubiertos —cuota bajo concurrencia (1.6) y proveedor
que no responde (1.4)—. Los otros dos no, y por un motivo incómodo: **el cobro
de cuota, la llamada al proveedor y la telemetría vivían dentro del callable**,
donde ninguna prueba llega. Cada pieza estaba probada y la costura entre ellas
no — que es exactamente donde sobreviven los fallos cuando todo está en verde.

Así que el paso empezó moviendo esa lógica a `runGateway`, con el proveedor
inyectable. `aiInvoke` quedó como cáscara que traduce el resultado a
`HttpsError` y nada más.

**2 · Las pruebas son de integración, contra Firestore real (emulador).** No
comprueban piezas, comprueban el circuito: 16 casos organizados por las
preguntas de la puerta, no por la estructura del código.

**3 · Lo que se descubrió al escribirlas.** Que nadie había comprobado que el
kill switch **estuviera conectado**. Había pruebas de precedencia de las
banderas (puras) y pruebas de decisión de la puerta (puras), y ninguna que
uniera Firestore con el rechazo. Estaba bien, pero por suerte, no por prueba.

---

### Puerta G3 — Riesgo · APROBADA

> *Cuando falle —va a fallar— ¿qué se rompe y cómo lo apagamos?*

**¿Puede un conjunto ejecutar como otro?** No. Una petición con `tenantId` ajeno
se rechaza antes de tocar nada —ni contador ni telemetría—, y lo que se
contabiliza lleva siempre el conjunto de la sesión. Un usuario cuyos claims
sobrevivieron a una baja no pasa: manda el documento de membresía. Agotar la
cuota de un conjunto no afecta al vecino.

**¿El kill switch cierra de verdad?** Sí, y **en la siguiente llamada**, sin
reiniciar ni desplegar: hay una prueba que apaga, comprueba que cierra,
enciende y comprueba que abre. El kill switch de una bandera gana a un override
que la encendía. Apagar una capacidad no apaga la plataforma, y se puede apagar
para un conjunto dejándosela al vecino. Con la puerta apagada **no se cobra
cuota**.

**¿Qué pasa cuando el proveedor no responde?** El administrador ve un mensaje
que le manda al flujo manual, la cuota **se devuelve** y el fallo **queda
registrado**. Si en cambio el proveedor respondió y su salida incumplió el
contrato, la cuota **no** se devuelve —los tokens se gastaron— y tampoco se
devuelve una salida a medias.

**¿Se filtra contenido?** No. Hay una prueba que serializa la fila de
telemetría y verifica que no aparece nada de lo que escribió el administrador.
La regla del Paso 0 deja de depender de la buena intención del tipo.

**Lo que queda fuera de esta puerta, y hay que decirlo:** todo esto se prueba
contra un proveedor simulado. Cuando entre Vertex habrá que repetir la pregunta
del proveedor caído contra el real, que falla de formas que un simulador no
imita — cortes a mitad de respuesta, límites de tasa, respuestas lentas pero no
lo bastante como para saltar el corte.

### Puerta G5 — Economía · parte técnica APROBADA

> *¿Cuánto cuesta servir esto a un cliente al mes?*

**Mecánicamente se puede responder**: la telemetría registra costo por llamada
con precios versionados, la consola lo agrega por conjunto y por operación, y
hay cuatro capas de tope. **El número real no existe todavía** y no puede
existir: no hay uso. Esa mitad de G5 se cierra con el piloto del Paso 2.6.

---

**Dónde está.**

| Pieza | Archivo |
|---|---|
| Camino completo, probable e inyectable | `functions/src/ai/gateway.ts` → `runGateway` |
| Pruebas G3 de integración (16) | `functions/tests/ai-gateway.emulator.test.ts` |
| Cuota bajo concurrencia (11) | `functions/tests/ai-quota.emulator.test.ts` |

Total del programa: **88 pruebas rápidas** en `functions/`, **27 con emulador**,
y **86 de reglas** en la raíz.

---

## Por dónde seguimos

**El Paso 1 está completo salvo el adaptador real.** La plataforma está en pie:
banderas y kill switch, puerta única, catálogo, validación, telemetría, cuotas
y las pruebas que cierran G3.

**1.4-real: el adaptador de Vertex AI.** Lo único que queda de la plataforma.
Añadir la dependencia, confirmar el identificador exacto del modelo y escribir
una implementación de `AiProvider`. Nada más del código cambia. Y al hacerlo,
repetir la pregunta del proveedor caído contra el real.

**Y después el canario, Paso 2 — pero ojo con el orden.** Su primer incremento,
el **2.1, no es código**: es cronometrar a mano de diez a quince comunicaciones
reales, tal y como se escriben hoy. Eso lo tiene que hacer David o un
administrador. **Sin esa línea base no hay forma de demostrar que la IA mejoró
nada**, y es la clase de medición que ya no se puede tomar una vez la
herramienta está encima.

Conviene empezar a cronometrar **ya**, en paralelo al adaptador.

Y en paralelo también, la tabla de la Parte IV.
