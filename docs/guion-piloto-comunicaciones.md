# Guion del piloto — borrador asistido de comunicaciones

Paso 2.6 de `docs/hoja-de-ruta-ia.md`. Escrito el 12 de agosto de 2026, para
ejecutar en cuanto haya un administrador dispuesto a una hora.

**Hipótesis que se pone a prueba: H2′ — el valor es que el aviso salga
completo.** Decidido el 12 de agosto: el usuario objetivo es el administrador,
porque es para quien se está comercializando Vivaru. H3 —que cualquiera escriba
como un profesional— queda aparcada con su argumento intacto para cuando haya
una administradora con varios conjuntos.

---

## Por qué es una sesión, y con quién

Producción tiene **26 comunicaciones en cinco meses y cero en los últimos
treinta días**. No es que la funcionalidad no guste: **Vivaru todavía no se
comercializa para uso de administrador, así que no hay administradores usándolo.**
Encender la bandera y esperar tráfico orgánico es esperar a que exista un mercado.

**Por eso el participante NO tiene que ser usuario de Vivaru.** Tiene que ser un
administrador de propiedad horizontal de verdad, que escriba avisos de verdad
para un conjunto de verdad. Se le sienta delante de la herramienta en staging,
con un conjunto creado para él, y escribe los avisos que tenía pendientes de
todas formas.

Existe uno identificado: **el administrador del corpus vecinal**, el que
contestó por escrito sobre los cortes de agua el 12 de agosto de 2026 (ver
`datasets/linea-base/hipotesis-de-valor.md`). Administra un conjunto real y ya
colaboró una vez.

### Lo que esta sesión SÍ puede contestar

**La hipótesis H2′ entera**, porque su métrica es la calidad del aviso
producido, no la adopción: ¿sale más completo con la herramienta que sin ella?
¿se inventa datos? ¿le sirve lo que le propone? Todo eso se mide con una persona
en una hora, sea cliente o no.

### Lo que NO puede contestar, y hay que decirlo antes

**La puerta G6 no se cierra aquí.** «Con gente real usándolo, ¿mejoró algo?»
exige gente que lo use por su cuenta, semana tras semana, sin nadie delante. Eso
necesita clientes, y los clientes necesitan que Vivaru se venda para esto.

Tampoco se contesta si lo adoptarían, si volverían, ni cuánto pagarían. **No
preguntes esas tres cosas en la sesión**: la respuesta de alguien que no es
cliente, con el creador del producto delante, no vale nada y encima contamina lo
que sí vale.

Lo que sale de aquí es **evidencia de calidad, no de mercado.** Con eso se
decide si la funcionalidad merece existir; con eso **no** se decide si merece
anunciarse.

---

## Lo que hay que aprender, y lo que no

**Se busca contestar tres preguntas:**

1. ¿Los avisos salen **más completos** con la herramienta que sin ella?
2. ¿El administrador **usa** lo que le propone, o lo reescribe entero?
3. ¿Se inventa algún dato? **El objetivo es cero y no se negocia.**

**No se busca** saber si le gusta, si le parece bonito, ni si «ahorra tiempo» —
eso último ya se midió y no justifica la funcionalidad: son 9 a 12 minutos por
conjunto al mes. Si sale el tema, se anota, pero no es la métrica.

---

## Antes de la sesión

- [ ] **Un administrador real, una hora, sin prisa.** No hace falta que sea
      usuario de Vivaru — hoy no los hay. Hace falta que administre un conjunto
      de verdad y escriba avisos de verdad.
- [ ] **Pedirle que traiga entre 4 y 6 avisos que tenga que escribir de todas
      formas.** No sirven casos inventados: un aviso de mentira se escribe
      distinto. Es la pieza que hace que la sesión valga.
- [x] **Crearle un conjunto en staging** y una cuenta de administrador. No toca
      producción, y así puede escribir sin miedo a publicarle algo a nadie.
      **Hecho el 14 de agosto de 2026:** `tenant-palmas-cdmx` («Privada Las
      Palmas», 24 unidades), con `admin@privadapalmas.mx`. Se eligió ese porque
      es el único sembrador que da un **edificio único**, que es donde se ve el
      contexto del conjunto. Sus tres avisos sembrados están borrados
      (`functions/scripts/vaciar-avisos-sembrados.mjs`) para que el módulo le
      aparezca vacío: tres avisos bien redactados en pantalla son la explicación
      del formato que esta lista prohíbe darle antes.
- [ ] **Avisarle de que nada de lo que escriba se le publica a ningún
      residente.** Si cree que sí, va a escribir distinto.
- [x] **Banderas:** `ai-gateway` y `ai-communications-draft` **encendidas
      globalmente en staging** desde el 14 de agosto de 2026, sin overrides por
      conjunto y con el kill switch maestro en `false`.
- [ ] **Encender `ia-proveedor-real`** en `/superadmin/flags` **el día de la
      sesión** — el piloto necesita el modelo real, no el simulador. Se dejó
      apagada a propósito para que nada gaste dinero esperando, así que **este
      es el interruptor que hay que acordarse de dar.**
- [x] **Comprobar el permiso de invocación** de `aiInvoke` en Cloud Run (ver
      `docs/pendientes.md`). **Comprobado el 14 de agosto de 2026** en staging,
      antes y después de desplegar: `allUsers → roles/run.invoker` en `aiInvoke`
      y en `registrarFeedbackIa`.
- [ ] **Cronómetro y esta tabla impresa o en pantalla aparte.**

> **Lo que NO hay que hacer antes: explicarle los cuatro datos.** Si le dices
> que un buen aviso lleva cuándo, cuánto dura, a quién afecta y qué hacer, va a
> incluirlos en los que escriba a mano y la comparación queda inservible.
> Se le explica **al final**, cuando ya no contamina nada.

---

## El guion, por partes

### Parte 1 · Los dos primeros, a mano (15 min)

Que escriba **dos avisos como los escribe hoy**, sin la herramienta y sin
ninguna indicación sobre qué debe contener.

**Esto es la línea base, y es la parte más importante de la sesión.** Sin ella
solo tendrías el corpus de WhatsApp de otro conjunto, que sirve para el orden de
magnitud pero no para decir «subió de X a Y». Con esto, el antes y el después
son la misma persona, el mismo día y el mismo canal.

Cronometrar cada uno. No corregir, no sugerir, no opinar.

### Parte 2 · Los siguientes, con la herramienta (25 min)

Que escriba **tres o cuatro** usando el panel. La primera vez, sin ayuda: se
mira si lo encuentra y si entiende qué hacer. **Que se atasque es dato, no
fracaso** — anotar dónde.

Solo se interviene si lleva más de un minuto bloqueado, y se anota que hubo que
intervenir.

Cronometrar cada uno.

### Parte 3 · Las preguntas (15 min)

En este orden, y sin sugerir la respuesta:

1. «¿Publicarías esto tal cual en tu conjunto?»
2. «¿Qué le sobra y qué le falta a lo que te propuso?»
3. «Cuando te pidió datos que no tenías, ¿te resultó útil o pesado?»
4. «De los cinco avisos, ¿cuál mandarías y cuál no? ¿Por qué?»

Y solo entonces, enseñarle los cuatro datos y preguntarle si le parecen los
correctos para su conjunto.

> **Tres preguntas que NO se hacen:** si lo usaría cada semana, si volvería, y
> cuánto pagaría. Habla con el creador del producto delante y no es cliente: sus
> respuestas serían amables y falsas, y de paso contaminarían las cuatro de
> arriba. Eso se pregunta cuando haya clientes, y no en una sesión de calidad.

---

## Qué se anota a mano

Lo que la instrumentación **ya registra sola** en `aiFeedback` —no hace falta
apuntarlo—: cuántas veces pidió borrador, si lo aplicó, si lo deshizo, si acabó
guardando, qué categorías se le mostraron, cuáles descartó y cuánto editó el
texto. Y en `aiUsage`: tokens, costo, latencia y fallos.

Lo que **ninguna máquina puede capturar** y hay que apuntar:

| Aviso | ¿A mano o con IA? | Minutos | Datos de 4 | ¿Inventó algo? | Observación |
|---|---|---|---|---|---|
| 1 | a mano | | / 4 | — | |
| 2 | a mano | | / 4 | — | |
| 3 | con IA | | / 4 | sí / no | |
| 4 | con IA | | / 4 | sí / no | |
| 5 | con IA | | / 4 | sí / no | |

**Cómo se cuentan los cuatro datos** — uno por cada uno que esté presente en el
texto publicado, no en lo que el administrador dijo de viva voz:

- **Cuándo** — fecha o día identificable, no «mañana» a secas si el aviso puede
  leerse otro día.
- **Cuánto dura** — hora de fin, duración, o una ventana aproximada.
- **A quién afecta** — torres, zonas o «todo el conjunto» dicho explícitamente.
- **Qué debe hacer el residente** — una acción concreta, si aplica. Si el aviso
  genuinamente no pide nada, **cuenta como presente**.

**Cómo se comprueba una invención:** leer el borrador contra los hechos que él
escribió en el panel. Cualquier dato duro que aparezca en el texto y no esté en
los hechos —una hora, una fecha, un monto, un motivo— es una invención. Anotarla
literal.

---

## Las tres decisiones de producto que se contestan mirando

Están abiertas desde el 12 de agosto y esta sesión es donde se resuelven:

1. **¿El borrador debe pedir el motivo?** Hoy no lo pide nunca y tampoco se lo
   inventa nunca. **Qué mirar:** si algún aviso suyo sale sin explicar por qué, y
   si a él le importa.
2. **Las inferencias.** El modelo escribió «por 24 horas» (calculado de 7am a
   7am) y «recomendamos almacenar agua» (deducido de que no hay pipas). **Qué
   preguntar:** si firmaría eso como administración.
3. **El resumen para la notificación.** Hoy se genera y se tira; la notificación
   dice la misma frase genérica para todos los comunicados. **Qué mirar:** si al
   verlo dice «eso es justo lo que debería llegarle al residente».

---

## Cómo se lee el resultado

**Seguir** si se cumplen las tres:

- Los avisos con IA traen **más datos de 4** que los de a mano, del mismo
  administrador y el mismo día.
- **Cero invenciones.** Una sola invención en cinco avisos es motivo de corregir,
  no de seguir.
- Señala como publicables los avisos asistidos —pregunta 4—, y sus reparos son
  de matiz, no de fondo.

**Corregir** si mejora la completitud pero algo estorba: pide de más, el texto no
suena a él, o la pantalla confunde. Todo eso se arregla y se vuelve a medir.

**Retirar** si los avisos no salen más completos, o si los reescribe enteros. Y
conviene decirlo antes de empezar: **retirar es un resultado válido y barato.**
Lo caro es arrastrar algo que no funciona porque ya se invirtió en ello.

---

## Trampas de esta sesión

- **Enseñarle los cuatro datos antes de la Parte 1.** Invalida la comparación.
  Es la más fácil de cometer.
- **Ayudarle cuando se atasca.** El atasco es el dato más valioso de la sesión.
- **Contar los avisos de a mano como «peores» sin contarlos igual.** Mismo
  criterio, misma persona, mismo día.
- **Presentar la mejora contra la línea base del corpus** (1,2 de 4). Es de otro
  conjunto y de otro canal: sirve para el orden de magnitud, no para el titular.
- **Confundir «le gustó» con «sirve».** La métrica es si el aviso salió más
  completo, no si le pareció simpático.
- **Cinco avisos no son una muestra.** Sirven para decidir si seguir, no para
  afirmar un porcentaje. Escribirlo así en las conclusiones.
- **Presentar esto como «el piloto» a secas.** Es una sesión de calidad con un
  administrador que no es cliente. Cierra la pregunta de si la funcionalidad
  sirve; **no** cierra G6 ni dice nada sobre adopción. Llamarlo piloto sin ese
  matiz es prometer más de lo que se midió — y el propio plan avisa de que la
  forma más cara de equivocarse es prometerlo antes de medirlo.

---

## Después

- Apagar `ia-proveedor-real` si el piloto fue en un ambiente sin tope de gasto.
- Leer `aiFeedback` y `aiUsage` del día: cuánto costó de verdad y qué hizo con
  cada propuesta.
- Escribir la lectura junto a las otras, en
  `datasets/evaluacion/resultados/`, con el mismo criterio que las anteriores:
  qué salió, qué falló, y qué se creyó y resultó falso.
- Cerrar las puertas que esta sesión sí cierra: **G1** (valor, con la línea base
  medida en la propia sesión), **G4** (evaluación, con juicio humano sobre la
  salida real) y **G5** (economía, con el costo real por comunicación).
- **Dejar G6 abierta y escrito por qué:** exige gente usándolo por su cuenta,
  semana tras semana. Eso necesita clientes, y los clientes necesitan que Vivaru
  se comercialice para uso de administrador. **Es una precondición de negocio,
  no de ingeniería** — igual que el muro de datos del Paso 3.
