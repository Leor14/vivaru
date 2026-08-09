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
o rechazarlo, y quitarlo de la lista de pendientes.** Antes de fijarlo hay que
verificar el catálogo y los precios vigentes de Vertex: el documento cita
«Gemini 3.5 Flash-Lite» a precios que son de la línea Flash, así que uno de los
dos datos está viejo.

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

**1.1 Banderas de verdad, y kill switch.**
Hoy existe la colección `featureFlags` en `firestore.rules:636` **y no la lee
nadie**. Son diez líneas de reglas sin consumidor. Esto es lo primero porque es
la red de seguridad de todo lo que viene después, y porque las otras cuatro PRD
lo dan por hecho cuando no lo está.
*Terminado cuando:* puedes encender y apagar una capacidad para un tenant
concreto desde Firestore, sin desplegar, y se nota en la aplicación.

**1.2 El punto de entrada único.**
Un callable de servidor que autentica, resuelve el tenant **desde la sesión y
nunca desde lo que mande el cliente**, comprueba el rol y exige App Check. Sin
llamar todavía a ningún modelo.
*Terminado cuando:* una prueba que intenta pasar un `tenantId` ajeno falla.

**1.3 Catálogo de operaciones.**
Cada cosa que la IA puede hacer es una `operationKey` con versión, esquema de
entrada, esquema de salida, permisos y límites. Nada se invoca si no está en el
catálogo. Esto es lo que impide que dentro de seis meses haya once llamadas
distintas que nadie sabe de dónde salen.

**1.4 Adaptador del proveedor y validación de salida.**
La llamada real, y un validador con Zod que **rechaza** lo que no cumpla el
esquema. Si el modelo devuelve algo raro, el usuario ve un error limpio, no un
objeto a medias.
*Terminado cuando:* una respuesta deliberadamente malformada se rechaza y no
llega al módulo.

**1.5 Telemetría de uso y costo.**
Por cada llamada: tenant, usuario, operación, versión de prompt y modelo, tokens,
costo estimado, latencia, resultado. Sin contenido sensible.
*Terminado cuando:* puedes responder «cuánto gastó este conjunto este mes»
mirando datos, no estimando.

**1.6 Cuotas.**
Por tenant, usuario y operación. Con actualización atómica: si no es atómica, se
evade repitiendo la llamada rápido.
*Terminado cuando:* al agotarse la cuota la acción asistida se deshabilita y el
flujo manual sigue funcionando.

**1.7 Las pruebas que importan.**
Aislamiento entre tenants, cuota bajo concurrencia, kill switch, y qué pasa
cuando el proveedor no responde.

> **Puertas que cierras aquí:** G3 (riesgo) para toda la plataforma, y la parte
> técnica de G5.

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

## Por dónde empezamos

Paso 0 es una conversación de una sesión y no requiere nada previo. Paso 1.1
—las banderas y el kill switch— es la primera línea de código y es útil aunque
el programa de IA se retrase, porque hoy no existe forma de apagar nada.

Y en paralelo, desde ya, la tabla de la Parte IV.
