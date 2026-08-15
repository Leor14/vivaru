# Taxonomía de etiquetas del gold set de PQRS

Esquema de etiquetas para `PRD-VAI-FEAT-002 — Asistente de PQRS`, con evidencia
de los dos corpus anonimizados. **Se escribió antes de etiquetar el primer
mensaje**, por el mismo motivo que el conjunto de comunicaciones se escribió
antes que el prompt: unas definiciones redactadas mientras se etiqueta se
acomodan a los casos que van saliendo, y entonces miden al que las escribió.

Creado el 15 de agosto de 2026.

## Qué es esto y qué no es

**Es** el esquema de etiquetas del gold set de evaluación del clasificador de
PQRS, y la taxonomía de temas con frecuencias observadas en dos países.

**No es** el sustituto de los 150–250 tickets reales que pide el Paso 3 de
`docs/hoja-de-ruta-ia.md`. Aquellos son tickets de producción, escritos dentro
del producto, con la decisión final del administrador al lado. Esto son mensajes
de WhatsApp de dos edificios: la voz es real, el canal no.

**Tampoco fija las frecuencias del mercado.** Son dos edificios, uno de Ciudad
de México y uno de Quito. Sirven para descubrir qué categorías existen y si
generalizan; no para afirmar cómo se reparten. **Colombia sigue sin corpus**, y
es el país del que viene el vocabulario PQRS.

## Los cinco ejes, y de dónde sale cada uno

Los tres primeros **no son invención**: son el contrato de salida que declara la
PRD (`suggestedCategory`, `suggestedType`, `suggestedPriority`) y los catálogos
de `Ticket` en `src/types/domain.ts:141`. Un gold set con ejes propios mediría
algo que el producto no va a pedirle nunca al modelo.

| Eje | Valores | Origen |
|---|---|---|
| `category` | `pqrs` · `maintenance` · `billing` | Contrato `Ticket` |
| `type` | `petition` · `complaint` · `claim` · `suggestion` · `other` | Contrato + definiciones canónicas |
| `priority` | `low` · `medium` · `high` | Contrato |
| `tema` | los once de abajo | Este corpus — es el aporte nuevo |
| banderas | `safetyFlags` de la PRD + metadatos de muestreo | PRD + este corpus |

**El eje que casi se queda fuera es `priority`**, y es el que sostiene el
criterio de aceptación más duro de la PRD: *recall de `high` ≥95%*. Un gold set
sin prioridad etiquetada no puede medirlo, y ese es el fallo caro — un ticket
urgente que el asistente entierra.

---

## Eje 1 · `category`

La primera decisión, y la más gruesa. En la variante `buzon_simple` **no
aplica**: la PRD dice que `suggestedCategory` va en `null`. Los casos declaran su
variante (ver más abajo).

| Valor | Qué es |
|---|---|
| `pqrs` | Petición, queja, reclamo o sugerencia sobre el servicio, la convivencia o la administración |
| `maintenance` | Reporte de algo físico que falla o requiere intervención |
| `billing` | Cuotas, pagos, comprobantes, estados de cuenta, cobros |

**Regla de desempate**, y hace falta porque el corpus la exige: cuando un
mensaje reporta una avería **y** discute quién la paga, manda el propósito del
que escribe. «El ascensor lleva tres días parado» es `maintenance`; «no pienso
pagar la extraordinaria del ascensor» es `billing` aunque hable del ascensor.

---

## Eje 2 · `type`, y el error que costó rehacerlo

Las definiciones **no se inventaron aquí**. Salen del marco del que viene la
sigla PQRS, verificado contra una fuente pública y no contra un resumen de
buscador:

| Valor | Definición canónica | La pregunta que la decide |
|---|---|---|
| `petition` | Requerimiento para obtener información, documentos o una actuación | ¿Pide algo? |
| `complaint` (queja) | Insatisfacción **respecto a la conducta o actuar de una persona** | ¿Se queja de alguien? |
| `claim` (reclamo) | Insatisfacción sobre el **incumplimiento o irregularidad de un servicio** | ¿Se queja de algo? |
| `suggestion` | Propuesta para mejorar el servicio | ¿Propone una mejora? |
| `other` | No encaja en ninguna | — |

**La primera versión de este documento las tenía cruzadas**, y conviene dejarlo
escrito. Se habían definido en el eje de la severidad —`complaint` como
inconformidad genérica, `claim` como exigencia formal—. El eje real es otro:
**de quién o de qué se queja.** Una persona, o un servicio.

> «Buen día! Oigan el señor vigilante lleva dos? Tres días? En la entrada. […]
> No deben de pasar estar cosas.» — `MX#658`

Es `complaint`: el objeto es la conducta del vigilante.

> «no se si en el 4 piso esta alguna persona para ocupar el ascensor, o esta
> DAÑADO, pq solo esta pitando.» — `EC#1789`

Es `claim`: el objeto es el ascensor, que es un servicio que no funciona.

Con las definiciones cruzadas, los dos habrían caído en el mismo cajón — y el
doble etiquetado habría medido la consistencia del que etiqueta, no la
corrección. Es el mismo defecto que el conjunto de comunicaciones ya documentó
para las afirmaciones por palabra exacta.

**Su límite, dicho aquí para que nadie lo descubra tarde:** ese marco regula el
derecho de petición **ante entidades públicas**. Una copropiedad es privada, así
que la distinción se adopta porque es de donde viene el vocabulario del producto
—`type` en `Ticket` tiene exactamente esos cinco valores— no porque una norma la
imponga sobre una administración. Ver el hallazgo del SLA en `docs/pendientes.md`.

### Tres casos límite, resueltos de antemano

- **Pregunta pura de información** → `petition`. «Es posible que envíen el acta
  de la asamblea anterior?» (`EC#3911`) pide un documento; pedir es una
  petición aunque no haya inconformidad.
- **Queja envuelta en pregunta** → manda el contenido, no el signo de
  interrogación. «por lo que veo el administrador no atiende» (`MX#6287`) es
  `complaint` aunque venga con un «ya te envié mensaje».
- **Propuesta con reproche** → si lo que se pide es un cambio a futuro, es
  `suggestion`. «Sugiero evitar el uso del ascensor si se requiere ahorrar
  energía» (`EC#2401`) es `suggestion` limpia.

---

## Eje 3 · `priority`

El eje que habilita el criterio ≥95% de recall en `high`. Se etiqueta por
**consecuencia de esperar**, no por el tono del mensaje: un vecino furioso por
un ruido no es `high`, y un aviso sereno de una fuga que está mojando el
departamento de abajo sí lo es.

| Valor | Criterio |
|---|---|
| `high` | Riesgo a personas, seguridad comprometida, daño material en curso, o servicio esencial caído (agua, luz, único ascensor) |
| `medium` | Afecta el uso normal pero no empeora solo con el tiempo |
| `low` | Informativo, consulta, o mejora deseable |

**Es el eje que más va a discrepar entre anotadores**, y por eso el criterio de
validación se mide por eje y no en conjunto. La PRD lo previó: la salida lleva
`priorityReason` y `needsHumanReview` precisamente porque la prioridad «puede
depender de señales dispersas en el mensaje».

---

## Eje 4 · `tema`, y lo que dicen dos países

Etiqueta principal obligatoria; secundarias opcionales, porque el corpus mezcla
—119 mensajes mexicanos tocan tres temas o más.

Frecuencias medidas con `scripts/analizar-temas-pqrs.mjs`, el mismo tamiz para
los dos corpus, sobre mensajes de residentes con texto (4.117 MX / 2.580 EC):

| Tema | México | Ecuador |
|---|---|---|
| `asamblea_administracion` | 9,9% | 6,5% |
| `cuotas_pagos` | 9,8% | **1,3%** |
| `agua` | 7,2% | 3,7% |
| `obra_mantenimiento` | 6,7% | 2,3% |
| `elevadores` | 5,4% | 3,8% |
| `seguridad_porteria` | 5,4% | 3,6% |
| `luz_electricidad` | 2,8% | **5,6%** |
| `amenidades` | 2,3% | 0,6% |
| `accesos_estacionamiento` | 2,1% | 1,7% |
| `convivencia_ruido` | 2,0% | 2,0% |
| `limpieza_basura` | 1,7% | 0,9% |

> **Estas cifras se corrigieron el mismo 15 de agosto de 2026, y el fallo vale
> más que la corrección.** La primera versión daba `seguridad_porteria` en 7,2%
> (México) y 5,0% (Ecuador), tercer tema de los dos corpus. Era ruido:
> **«Cambió tu código de seguridad con X» es un mensaje que escribe WhatsApp**,
> no una persona, y lleva la palabra «seguridad». Son **89 en México y 141 en
> Ecuador**, y el tema entero en Ecuador tenía 132 mensajes — o sea que el ruido
> era mayor que la señal. Con el filtro puesto, `seguridad_porteria` baja al
> sexto puesto en México; los demás temas se mueven ±0,2%, lo que confirma que
> el ruido era específico de esa palabra.
>
> **No se vio contando, se vio muestreando para etiquetar.** El contador se
> creía sus cifras porque el ruido pasaba su propio tamiz — la misma lección que
> dejaron escrita los dos scripts de anonimización, cumplida por tercera vez.

**Lo que generaliza:** «asamblea y administración» es el tema número uno en los
dos países, y sobrevive a la corrección del ruido. La observación del análisis
mexicano —que un producto que solo clasifica averías se pierde un tercio de lo
que la gente plantea— no era una peculiaridad de un edificio.

**Lo que no:** las cuotas se desploman en Ecuador. Se comprobó que **no es un
hueco del detector** —una búsqueda independiente da 67 líneas con
pago/pagar/transferencia/depósito en todo el corpus ecuatoriano contra 423 en el
mexicano, que es menos del doble de grande—. La hipótesis razonable es que en ese
edificio los pagos se tratan en privado con la administradora. **Es una
hipótesis, no un hallazgo**: un edificio no dice nada del mercado.

**Los once temas se quedan todos**, incluido `amenidades` con su 0,6%. Dos
edificios bastan para descubrir una categoría; no para eliminarla.

---

## Eje 5 · Banderas, y por qué van en dos grupos

Se separan a propósito, porque son cosas distintas y mezclarlas contamina la
métrica.

**`safetyFlags` — salida del modelo, se evalúan.** Son las cuatro de la PRD:
`amenaza`, `dato_sensible`, `lenguaje_ofensivo`, `posible_urgencia`.

**Metadatos de muestreo — no son salida del modelo, sirven para estratificar y
para leer los fallos por tipo.** `sin_contexto`, `multi_tema`, `dato_faltante`,
`prompt_injection`.

Confundirlos fue el error de la primera versión: se propusieron cuatro banderas
inventadas como si fueran del contrato. Ninguna lo era.

### El bloque que el corpus no puede dar

La PRD pide explícitamente **intentos de prompt injection dentro del mensaje**.
Eso no existe en un chat vecinal de 2019: hay que **fabricarlo**, y va marcado
como sintético. Es el único bloque del gold set que no sale de material real, y
la razón es que el ataque tampoco es espontáneo.

---

## Las preguntas cortas, que son el caso dominante

En México, **245 de las 498 preguntas** bajan de 80 caracteres; en Ecuador, 126
de 217. Solas son inclasificables:

> «La fuga es de área común?» — `MX#4450`

**Decisión: entran, con su contexto previo.** Cada caso lleva `contextoPrevio`
con los mensajes anteriores del hilo, y la bandera `sin_contexto`. El
muestreador lo extrae:

```bash
node scripts/muestrear-corpus-pqrs.mjs datasets/chat-vecinal/chat-anonimizado.txt --id "MX#4450"
```

Con los tres anteriores a la vista, la respuesta aparece: el administrador acaba
de avisar de una fuga en el piso 6, y el vecino pregunta si el daño es de área
común —lo que decide quién paga—. Es `petition` de información, tema `agua`,
prioridad `medium`.

**Y trae un hallazgo que conviene medir, no suponer:** las preguntas cortas son
casi siempre clasificables en `type` y `tema` aun sin contexto; lo que se vuelve
imposible sin él es la **prioridad**. Si eso se confirma al etiquetar, dice algo
del producto: un ticket que llega solo, sin hilo, es exactamente el caso en que
el asistente debe marcar `needsHumanReview` en vez de arriesgar una prioridad.

---

## Las variantes del módulo

Cada caso declara en cuál ocurre, igual que el conjunto de comunicaciones declara
si el conjunto tiene torres:

```json
"variante": "con_sla"
```

En `buzon_simple`, `category` y `type` van en `null` por contrato, y el gold set
debe **comprobar que el modelo no los rellena igualmente**. `con_sla` es el valor
por defecto (`src/lib/config/module-variants.ts:37`), así que es la mayoría de
los casos, pero no puede ser el único: una variante sin cobertura es una variante
sin medir.

---

## Qué hay dentro, a 15 de agosto de 2026

**152 casos**, no los 200 previstos. Se dice el número real porque un conjunto
inflado con casos flojos da un número alto y no mide nada.

| | Casos |
|---|---|
| México (`chat-vecinal`) | 84 |
| Ecuador (`chat-vecinal-ecuador`) | 60 |
| Sintéticos (solo inyección) | 8 |

| Eje | Reparto |
|---|---|
| `category` | `pqrs` 93 · `maintenance` 44 · `billing` 15 |
| `type` | `claim` 55 · `petition` 40 · `complaint` 23 · `suggestion` 22 · `other` 12 |
| `priority` | `low` 66 · `medium` 65 · `high` 21 |
| Banderas | `sin_contexto` 18 · `enfado` 11 · `prompt_injection` 8 · `dato_faltante` 5 · `multi_tema` 4 |

Los once temas tienen entre 9 y 24 casos. Los difíciles son el **30%** del
conjunto, por debajo del 40% que se buscaba.

**Tres huecos, dichos antes de que los encuentre alguien:**

- **`billing` tiene 15 casos**, que es poco para medir exactitud de `category`.
  No es descuido del muestreo: en Ecuador `cuotas_pagos` es el 1,3% del corpus,
  y ahí no hay más material. Se cierra con tickets reales, no con este corpus.
- **`high` tiene 21 casos.** Bastan para que el recall no salte veinte puntos
  por un fallo, pero es el mínimo. La prueba exige ≥15 para que no baje de ahí.
- **Solo hay variante `con_sla`.** `buzon_simple` no tiene ni un caso, y es una
  variante sin medir. Falta declarar unos cuantos casos en la otra variante y
  comprobar que el modelo devuelve `category` y `type` en `null`.

### Los archivos, y cuál se edita

| Archivo | Qué es |
|---|---|
| `etiquetas.tsv` | **Lo que se edita.** Una fila por caso, revisable sin leer JSON |
| `sinteticos.json` | Los ocho de inyección, con su texto — no salen de ningún corpus |
| `gold-set.json` | **Generado. No se edita a mano** |

```bash
node scripts/construir-gold-set-pqrs.mjs --revisar   # comprueba sin escribir
node scripts/construir-gold-set-pqrs.mjs             # regenera el JSON
```

**El texto de cada caso lo pone el corpus, no el que etiqueta.** Tecleándolo se
cuela una corrección ortográfica sin querer — y la mala ortografía es justo lo
que hace útil el material. El generador falla si un identificador no existe, si
está repetido, si una etiqueta se sale del catálogo, o **si el mensaje lo
escribió la administración**.

## Cómo se valida el etiquetado

**Doble etiquetado de una muestra de 30–40 casos**, a ciegas, y acuerdo medido
**por eje**.

**Se mide con kappa de Cohen, no con porcentaje bruto.** El acuerdo bruto
sobreestima porque incluye el que ocurre por azar, y estos ejes van a salir muy
desbalanceados: si `petition` se lleva la mitad de los casos, dos anotadores que
respondieran «petition» siempre coincidirían el 50% de las veces sin haber leído
nada.

| Eje | Umbral |
|---|---|
| `category`, `type`, `tema` | kappa ≥ 0,70 |
| `priority` | kappa ≥ 0,60 — es el más subjetivo, y fingir lo contrario no lo mejora |

**Un eje por debajo de su umbral no significa «hay que etiquetar mejor»:
significa que su definición está mal escrita.** Se reescribe la definición, se
vuelve a etiquetar la muestra, y se anota qué cambió. Ese registro vale tanto
como el número.

### El flujo, ya montado

```bash
node scripts/acuerdo-pqrs.mjs --generar 36   # muestra en blanco
node scripts/acuerdo-pqrs.mjs --medir        # kappa por eje y discrepancias
```

La muestra vive en `datasets/pqrs/doble-etiquetado/muestra.tsv` con las cuatro
columnas vacías y el texto al lado — los casos `sin_contexto` traen su hilo
delante, porque sin él no son etiquetables.

**Es ciega por disciplina, no por candado:** `gold-set.json` está en el mismo
repositorio y tiene las respuestas. Mirarlo antes de rellenar invalida la
medición, y no hay forma técnica de impedirlo.

**Por qué el bruto no basta, medido y no argumentado:** con el medidor probado
sobre un desacuerdo simulado del 25%, el acuerdo bruto daba **75%** —que suena
aceptable— y el kappa **0,67 en `type` y 0,59 en `priority`**, los dos por
debajo de su umbral. Esa distancia entre las dos cifras es todo el motivo de
usar kappa.

**La prueba ya existe:** `functions/tests/pqrs-goldset.test.ts`, once
comprobaciones —catálogos, identificadores únicos, cobertura por tema, los dos
países, los `high` suficientes para medir su recall, y que los sintéticos sean
solo los de inyección—. Está en `functions/tests/` a propósito y no en `tests/`
de la raíz: esa suite corre **cero** tests por el glob roto que documenta
`docs/pendientes.md`, así que un test allí no protegería nada.

**Mutada para comprobar que atrapa**, que es la única forma de saber que una
prueba sirve: con una etiqueta fuera de catálogo falla «toda etiqueta pertenece
a su catálogo»; quitándole el hilo a un caso `sin_contexto` falla la suya. Las
dos vuelven a verde al regenerar desde el TSV.

---

## Ruido conocido

- **Mensajes que escribe WhatsApp.** «Cambió tu código de seguridad», «X añadió
  a Y», «se unió usando el enlace». Los filtra `SISTEMA` en
  `scripts/lib/temas-pqrs.mjs` desde que se descubrió que inflaban
  `seguridad_porteria` — ver el aviso de la tabla de temas.
- **Líneas de sistema pegadas.** En el corpus ecuatoriano, algunas no llevan
  `autor:` y el parser las adjunta al mensaje anterior como continuación
  (visible en `EC#8`), así que sobreviven al filtro. Afecta a pocos mensajes y se
  descarta al revisar a mano, pero **no elegir un caso a ciegas por su
  identificador**.
- **Transcripción de un bot.** El análisis mexicano detectó al menos un mensaje
  pegado desde un bot de atención telefónica. Si entra, se estaría evaluando
  contra la salida de otra máquina.
- **Avisos del comité disfrazados de mensaje de vecino.** Ya los filtra el
  muestreador —27 de 83 avisos mexicanos los escriben residentes—, pero el
  filtro es por verbos de anuncio y no es perfecto.

---

## Cómo se reproduce

```bash
node scripts/analizar-temas-pqrs.mjs datasets/chat-vecinal/chat-anonimizado.txt datasets/chat-vecinal-ecuador/chat-anonimizado.txt
```

```bash
node scripts/muestrear-corpus-pqrs.mjs datasets/chat-vecinal/chat-anonimizado.txt --tema agua --n 20
```

Los dos comparten `scripts/lib/temas-pqrs.mjs`, y eso es deliberado: si el
muestreador usara una copia de los patrones, esta taxonomía podría citar como
evidencia un mensaje que sus propias cifras no contaron.

**Material disponible**, tras descartar adjuntos, mensajes de sistema, mensajes
de la administración y avisos: **1.295 candidatos en México y 566 en Ecuador**.
Para los ~200 casos previstos (120 MX / 80 EC) sobra, y eso permite elegir por
calidad en vez de por cuota.

## Lo que este gold set NO va a medir

- **Si el resumen y el borrador son buenos.** Esto mide clasificación. El resto
  de la salida de la PRD —`summary`, `requests`, `nextSteps`, `draftResponse`—
  necesita afirmaciones comprobables, como el conjunto de comunicaciones, y es
  su propio incremento.
- **Si el asistente ahorra tiempo.** Eso es el baseline de G1, que la PRD marca
  como TBD y que ninguna medición sobre un corpus puede dar.
- **Cómo escribe un residente colombiano.** No hay corpus, y es el país del que
  viene la sigla.
