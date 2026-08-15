# La hipótesis de valor, puesta a prueba con el corpus

Complemento de `comunicaciones.md`. Medido el **12 de agosto de 2026** sobre los
7.319 mensajes de `datasets/chat-vecinal/chat-anonimizado.txt` (29 meses, un
conjunto).

La línea base dejó claro que **sobre ahorro de tiempo los números no justifican
la funcionalidad** (9–12 minutos por conjunto al mes). Así que la pregunta pasó
a ser cuál es entonces la hipótesis de valor. La candidata era:

> **H2 — el valor está en evitar comunicaciones incompletas.** El costo de un
> aviso malo no son los nueve minutos de escribirlo, son las preguntas que
> llegan después.

Tiene dos mitades y **el corpus contesta distinto a cada una**.

## Lo que se hizo

Se aislaron los **avisos operativos**: mensajes de más de 160 caracteres que
anuncian algo (`les informo`, `se realizará`, `habrá`, `reporte de trabajos`…)
sobre un asunto del conjunto (agua, luz, elevador, obra, cuotas…), descartando
los mensajes conversacionales largos. Quedaron **71**.

De cada uno se miró si trae los cuatro datos —**cuándo, cuánto dura, a quién
afecta, qué debe hacer el residente**— y cuántas preguntas llegaron en las 24
horas siguientes. Las preguntas se contaron dos veces: todas, y solo las que
comparten tema con el aviso.

## Mitad refutada: las preguntas no existen

| Datos que trae el aviso | Avisos | Preguntas del mismo tema en 24 h |
|---|---|---|
| 0 de 4 | 22 | 0,00 |
| 1 de 4 | 20 | 0,15 |
| 2 de 4 | 24 | 0,08 |
| 3 de 4 | 4 | 0,00 |
| 4 de 4 | 1 | 0,00 |

**No hay relación.** Y el nivel general es el que mata la hipótesis: **el 4% de
los avisos incompletos recibe siquiera una pregunta sobre su tema.** Contando
todas las preguntas sin filtrar tema, tras un aviso llegan 1,08 de media — y
tras un mensaje cualquiera, 0,99. El aviso casi no mueve la aguja.

Se probaron tres variantes del análisis (ventana de 24 h, con y sin filtro de
tema, con el detector de avisos flojo y apretado). Ninguna rescata la relación.

**Las quince preguntas de vuelta no están en los datos.** Eso era exactamente lo
que había que comprobar antes de diseñar un producto encima.

## Mitad confirmada, y con fuerza: los avisos sí están incompletos

| Dato | Avisos que lo traen |
|---|---|
| A quién afecta | 37/71 · **52%** |
| Cuándo | 31/71 · **43%** |
| Qué debe hacer el residente | 12/71 · **16%** |
| **Cuánto dura** | **4/71 · 5%** |

**El 58% de los avisos trae uno o ninguno de los cuatro datos. Uno solo de los
71 trae los cuatro.**

Lo de la duración se verificó aparte, porque un 5% parecía error de medición: en
**todo** el corpus de 7.319 mensajes, «de X a Y» aparece 4 veces, «hasta nuevo
aviso» 2 y «todo el día» 2. No es el detector. **Cuando cortan el agua, casi
nunca dicen hasta cuándo.**

## Lo que apareció sin buscarlo: no es problema de una persona

Los avisos los escriben **12 personas distintas**.

| Quién | Avisos | Datos de 4 (media) |
|---|---|---|
| Antonio Ayala | 10 | 2,00 |
| ~ Cristina Parodi | 11 | 1,55 |
| **Rodrigo Administración** | **20** | **1,25** |
| D e l | 8 | 1,12 |
| Dr. Claudio Granados | 7 | 1,00 |
| Adrian auregui | 3 | 0,33 |
| El resto (1–2 avisos c/u) | 9 | 0,44 |

*(Nombres sustituidos en la anonimización; ver `datasets/chat-vecinal/README.md`.)*

**El administrador es quien más escribe y no es el que mejor escribe.** Y los
ocasionales son los peores con diferencia. La calidad del aviso depende de quién
estuvo frente al teclado ese día.

## Qué queda en pie

La cadena «incompleto → preguntas → trabajo» **no se sostiene** en lo visible.
El chat no puede distinguir entre dos explicaciones, y conviene decirlo antes de
que alguien lo asuma:

- **que el dato que falta no le importa a nadie**, o
- **que el costo se paga donde el chat no lo ve** — el residente que baja a la
  caseta, el que llama al administrador, el que se molesta y no dice nada.

No se puede resolver con este corpus. Se resuelve preguntándole al
administrador, y es una pregunta de cinco minutos.

## Se le preguntó, y contestó (12 de agosto de 2026)

> «Sí. Si no digo hasta cuándo durará, **casi siempre me escriben o llaman** para
> preguntar a qué hora regresa el agua. Algunos vecinos también **bajan a
> caseta**, sobre todo quienes no vieron el aviso completo o necesitan organizar
> baños, comida o la salida de casa.
>
> Por eso intento incluir una hora estimada de restablecimiento. Si no la tengo,
> comunico una duración mínima o una ventana aproximada y aclaro que enviaré una
> actualización en cuanto el técnico confirme.»

**Gana la segunda explicación: el costo es real y se paga fuera del grupo.**
Mensaje privado, llamada, y gente bajando a caseta. Nada de eso aparece en un
export de WhatsApp del grupo.

Eso obliga a corregir cómo se lee el análisis de arriba. El resultado no era
«los avisos incompletos no cuestan nada»; era **«el chat del grupo es el único
sitio donde ese costo no se paga»**. Se midió el único canal disponible y salió
vacío justamente porque el tráfico va por otro lado. Conviene recordarlo la
próxima vez que un dato salga plano.

### Y aparece una grieta más útil que todo lo anterior

El administrador **describe la buena práctica con precisión**: hora estimada; si
no la tiene, ventana mínima más promesa de actualizar. Es una política correcta,
dicha en dos frases, sin ayuda de nadie.

Se fue a mirar si eso es lo que sale. Sobre los **25 avisos de corte de agua**
del corpus —el asunto exacto que él nombró:

| | Avisos |
|---|---|
| Dicen hasta qué hora / cuánto dura | 8/25 · **32%** |
| Dan una ventana aproximada | 4/25 · 16% |
| Prometen actualizar después | 2/25 · **8%** |
| **Alguna de las tres** | **10/25 · 40%** |
| Llega después el «ya volvió el agua» | 5/25 · **20%** |

*(La detección de restablecido se amplió a propósito a formas coloquiales —«ya
hay agua», «ya regresó»—. En los 29 meses del corpus hay **10** mensajes de
restablecido en total.)*

En agua lo hace mejor que en general —32% contra 5%—, así que la práctica
existe. Pero **tres de cada cinco avisos de corte de agua no le dan al residente
nada con qué planear**, que es exactamente cuando él dice que suena el teléfono.
Y la actualización que promete llega una de cada cinco veces.

Por autor, otra vez:

| Quién | Avisos de agua | Con duración, ventana o promesa |
|---|---|---|
| Antonio Ayala | 8 | **6** |
| Rodrigo Administración | 6 | 3 |
| D e l | 3 | 1 |
| Jazz Carrillo | 3 | 0 |

**Esto es lo que decide la hipótesis.** El problema no es que no sepan qué poner
—el administrador lo recita perfectamente—; es que **no sale así cuando escriben
con prisa**. Ese hueco no lo cierra una capacitación ni una plantilla en un
documento: se cierra en el momento de escribir. Que es literalmente lo que hace
una lista de lo que falta.

Con eso, la hipótesis que sí aguanta el dato:

> **H2′ — el valor es que el aviso salga completo, medido directamente y no por
> sus consecuencias.** Hoy los avisos traen 1,2 de 4 datos. La métrica del
> piloto es esa misma, antes y después.

Es más modesta que H2 y es honesta: mide lo que se produce, no un beneficio río
abajo que los datos no respaldan. Y tiene una virtud práctica — **la línea base
ya está medida** (1,2 de 4; 6% con tres o más), así que la mejora se ve en una
tabla sin instrumentar nada nuevo.

Y una segunda, que el dato de los 12 autores abre y que **cambia a quién se le
entrega el piloto**:

> **H3 — el valor es que cualquiera pueda escribir un aviso de calidad
> profesional.** El cuello de botella no es el tiempo del administrador; es que
> la comunicación del conjunto dependa de quién escribe.

Para una administradora con varios conjuntos eso es consistencia de cartera, que
es algo que un comprador sí valora. Y el piloto se diseña distinto: no se
cronometra al administrador, se le da la herramienta al comité y se mira si sus
avisos salen como los de un profesional.

## Consecuencia para el diseño (Paso 2.5)

Sobrevive intacta, aunque el razonamiento que llevó a ella era el equivocado:

**`missingInformation` es la parte principal del producto, no un accesorio.** La
pantalla útil no es un botón de «escríbemelo», es una lista de lo que falta —
con «cuánto dura» arriba del todo, porque es el dato que se olvida el 95% de las
veces.

Y tres cosas concretas que salen de la respuesta del administrador:

1. **Cuando no se sabe la hora de fin, la salida correcta no es callar.** Es la
   fórmula que él mismo describió: duración mínima o ventana aproximada, más el
   compromiso de actualizar. Eso debe estar en el prompt y debe haber un caso de
   evaluación que lo compruebe. **Hoy no lo hay.**
2. **El conjunto de evaluación subpondera el hueco real.** De 50 casos, solo
   **2** tienen la duración como dato faltante (`falta-duracion`,
   `obra-herrero-sotano`) — un 4%, cuando en la realidad falta en el 68% de los
   avisos de agua y en el 95% del total. Hay que reequilibrarlo antes de correr
   el 2.4 de verdad, o la evaluación medirá bien lo que no importa.
3. **El aviso de restablecimiento casi no existe, y arreglarlo no necesita IA.**
   10 mensajes en 29 meses. Si al publicar un aviso con hora de fin el sistema
   recordara publicar el cierre, se cubriría un hueco mayor que el del borrador
   —y sale más barato—. Conviene decirlo aunque juegue en contra de la
   funcionalidad que se está construyendo.

## Cómo reproducirlo

Los tres cortes están en el historial de la sesión del 12 de agosto de 2026. Son
tres pasadas de expresiones regulares sobre el corpus anonimizado; se pueden
rehacer en minutos. **Sus límites, dichos aquí para que nadie los descubra
tarde:**

- **Un conjunto, un chat de WhatsApp.** No hay hilos, así que atribuir una
  pregunta a un aviso es ruidoso por construcción. Por eso se contó también con
  filtro de tema, que es más estricto y da lo mismo.
- **La detección de los cuatro datos es por expresión regular.** Subestima
  formas de decir las cosas que no están en la lista. La de duración se
  verificó a mano justo por eso.
- **El detector de avisos deja pasar algún mensaje conversacional largo.** En
  una muestra de cinco, uno era falso positivo. No cambia el orden de magnitud.
- **Un chat no es el único canal.** Puede haber avisos en cartelera, en correo o
  en la app que no aparecen aquí.
