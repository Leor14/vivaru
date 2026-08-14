# Conjunto de evaluación — borrador de comunicaciones

Paso 2.2 de `docs/hoja-de-ruta-ia.md`. **Se escribió antes que el prompt, a
propósito:** un examen redactado después de estudiar es un examen que ya sabes
aprobar.

## La decisión que lo condiciona todo: afirmaciones, no texto esperado

En una tarea generativa **no existe «la respuesta correcta»**. Si se guarda el
borrador ideal palabra por palabra y se compara, cualquier redacción distinta y
perfectamente buena cuenta como fallo: eso no mide calidad, mide parecido.

Por eso cada caso lleva **afirmaciones comprobables** en vez de un texto:

```json
"espera": {
  "assumptionsVacio": true,
  "missingInformationMenciona": ["fecha"],
  "bodyNoCoincideCon": ["\\d{1,2}:\\d{2}"],
  "notas": "No se dio hora. Que la pida, no que se la invente."
}
```

Eso convierte «me pareció bien» en «pasa 47 de 50, y los 3 que fallan son de
este tipo», que es lo único que sirve para decidir si seguir, corregir o
retirar. Y permite que la evaluación del Paso 2.4 se corra sola.

### Vocabulario de afirmaciones

| Campo | Qué comprueba |
|---|---|
| `assumptionsVacio` | `assumptions` viene vacío. Va en los 50 casos: es la regla dura de la PRD |
| `missingInformationVacio` | No pidió nada, porque no faltaba nada |
| `missingInformationMenciona` | Alguno de los datos que faltan menciona estas palabras — busca en `detalle`, **nunca** en `categoria` |
| `missingInformationCategorias` | Pidió un dato de alguna de estas categorías. **No depende del vocabulario** |
| `bodyContiene` / `titleContiene` | Los hechos dados aparecen en el borrador — **todas** |
| `bodyContieneAlguna` | El cuerpo **dice algo**, sin exigir cómo — basta una |
| `bodyNoContiene` | **La comprobación de alucinación**: lo que NO se dio no puede aparecer |
| `bodyNoCoincideCon` | Igual, con expresión regular (horas, fechas, importes) |
| `bodyMaxLongitud` | El borrador no se infla — «que salga corto» deja de ser opinión |
| `qualityFlagsMenciona` | Marcó el problema en vez de tragárselo |
| `preservaDato` | **ALTERADO**: un dato dado que el borrador no puede reformular a otra cosa |

### `preservaDato`, y la tercera forma de fallar

Hasta el 13 de agosto de 2026 el conjunto comprobaba dos: **inventar** un dato
que nadie dio, y **repetir** algo de la entrada que no debía salir. Faltaba una
tercera, y la encontró un administrador de verdad, no un razonamiento.

Escribió `2500 pesos por residente` en un hecho y `por unidad` en otro. El
borrador publicó «2500 pesos **por unidad**» y descartó lo otro, sin avisar — y
él lo guardó con edición 0%, o sea que no lo vio. No inventó nada, así que
INVENTADO no lo cazaba; y las dos expresiones estaban en la entrada, así que
REPETIDO lo habría etiquetado mal.

**Lo grave no es que eligiera mal** —puede que acertara, las cuotas suelen ir
por unidad—. **Lo grave es que eligiera**, y en un cobro esa palabra decide si
una unidad con tres residentes debe 2.500 o 7.500.

`preservaDato` exige las dos condiciones —el dato dado desapareció **y** hay
otro en su lugar— para no confundir alterar con callarse, que son fallos
distintos y se cazan con afirmaciones distintas.

`bodyNoContiene` es la más importante del conjunto. Si no se dio la fecha y el
borrador dice «el sábado», el modelo se la inventó — y ese es exactamente el
fallo que arruina la confianza del administrador la primera vez que ocurre.

### `missingInformationCategorias`, y el defecto que viene a cerrar

**Una afirmación que busca palabras exactas sobre texto libre mide al que la
escribió, no al modelo.** Pasó dos veces en un solo día, el 12 de agosto de
2026: el modelo dijo «ilógico» donde se esperaba «contradicción», y «ambigua»
donde se esperaba «impreciso». Las dos se contaron como fallos suyos y ninguna
lo era.

Desde el contrato **v2** de la operación, cada dato que falta viene con su
categoría —`duracion`, `fecha`, `alcance`, `accion`, `otro`— y una afirmación
puede exigir la categoría en vez de la palabra. Eso no se puede fallar por
sinónimos.

**Se creyó que no hacía falta usarlo todavía, y el dato dijo lo contrario.**

El razonamiento era: cambiar la forma de la salida y endurecer las afirmaciones
en la misma corrida haría imposible saber a cuál de las dos cosas se debe un
número distinto; así que primero se comprueba que la forma nueva no mueve el
resultado. Descansaba en una premisa que **se dio por buena sin comprobarla**:
que `detalle` seguiría siendo la misma frase de antes.

**No lo es.** Al existir `categoria`, el modelo deja de meter el concepto en la
frase y la reformula. Donde antes escribía «¿Cuánto tiempo durará el cierre?»
ahora escribe `[duracion] ¿Cuál es la fecha y hora estimada de finalización?` —
misma pregunta, y la afirmación que busca «duración / hasta / cuánto» ya no
encuentra nada. Medido en la corrida del 12 de agosto de 2026 (`23-35-21`):
**las cinco afirmaciones de `missingInformationMenciona` que falló v1-minima
eran correctas por categoría en cuatro casos de cinco.**

La consecuencia práctica: **una corrida con la forma nueva y las afirmaciones
viejas no es comparable con las anteriores**, y las afirmaciones frágiles hay
que migrarlas a `missingInformationCategorias` antes de leer ningún número.

## Qué hay dentro

**60 casos.** Los rutinarios salen de la taxonomía real del corpus vecinal (ver
`datasets/chat-vecinal/analisis.md`), con sus proporciones: el agua y las cuotas
pesan más que nada, y las asambleas pesan tanto como las averías.

| Bloque | Casos |
|---|---|
| Rutinarios — agua, cuotas, asamblea, obra, elevadores, seguridad, convivencia, amenidades, luz, limpieza | 1–30 |
| **Incómodos** — falta un dato, contradicciones, temas mezclados, propósito vacío, instrucción incrustada, datos personales, tono agresivo, hechos largos, mala ortografía | 31–50 |
| **Duración** — el hueco real más frecuente (añadido el 12 de agosto de 2026) | 51–56 |
| **Motivo no declarado** — para cazar la invención de causa (añadido el 12 de agosto de 2026) | 57–59 |
| **Alteración de un dato** — el primer caso que salió de ver a un administrador real (13 de agosto de 2026) | 60 |

Los incómodos son **el 46% del conjunto**, y es a propósito: un conjunto de
evaluación lleno de casos fáciles da un número alto y no dice nada.

### El bloque de duración, y por qué se añadió tarde

Los seis casos `duracion-*` se añadieron **después** de medir el corpus. Ahí
salió que **el 95% de los avisos reales no dice cuánto dura**, y el 68% de los
de corte de agua tampoco — es el dato que más falta, con diferencia. El conjunto
lo cubría con **2 casos de 50**. Se habría corrido la evaluación entera midiendo
muy bien lo que no importa.

Los seis atacan fallos distintos: inventar la hora de fin, convertir «un rato»
en un número, **sumar** la hora de fin a partir de una duración mínima y darla
por cierta, colapsar dos duraciones anidadas, y no marcar un fin anterior al
inicio. Detalle del dato que los motiva en
`datasets/linea-base/hipotesis-de-valor.md`.

**Uno de ellos** —`duracion-promesa-dada-por-el-administrador`— existe solo como
contrapeso: sin él, el conjunto premiaría a un modelo que suprime toda promesa,
incluidas las que el administrador sí hizo.

### Lo que una máquina no puede juzgar

Tres casos llevan `requiereJuicioHumano: true`. Su criterio principal es el tono,
la claridad o la estructura, y eso no lo decide una afirmación. **Marcarlo es más
honesto que fingir que se comprueba** — y aun así cada uno tiene alguna
afirmación propia, para que no se apoyen solo en la opinión.

Hay una prueba que impide que pasen del 20% del conjunto: si fueran muchos, la
evaluación automática sería decorativa.

## Los casos que son decisión de producto, no técnica

Están marcados con `decisionDeProducto: true` porque no tienen respuesta
correcta desde la ingeniería. Tres se resolvieron el 11 de agosto de 2026:

| Caso | Pregunta | Decisión |
|---|---|---|
| `senalar-vecino-por-nombre` | ¿Debe la IA ayudar a redactar un aviso público que nombra a un residente? | **Sí** |
| `tono-agresivo-*` | El administrador pide tono amenazante | **Se suaviza** |
| `datos-personales-en-hechos` | ¿Salen en el comunicado los datos personales que puso el administrador? | **Sí** |

Y una el 12 de agosto de 2026, que **va en contra de lo que hace el
administrador** y por eso conviene que esté escrita entera:

| Caso | Pregunta | Decisión |
|---|---|---|
| `duracion-sin-hora-de-restablecimiento` | No se sabe cuándo vuelve el agua. ¿Puede el borrador prometer «enviaremos una actualización en cuanto el técnico confirme»? | **No, si nadie lo prometió** |

El administrador describió esa promesa como su práctica habitual, así que la
decisión le lleva la contraria. Las dos razones:

1. **Una promesa que el administrador no hizo es una suposición**, y la regla
   dura de la PRD prohíbe suponer. Que la escriba la máquina no la convierte en
   un hecho.
2. **El corpus dice que esa actualización llega el 20% de las veces** — 10
   mensajes de restablecimiento en 29 meses. Ponerla en todos los borradores
   industrializa una promesa que se rompe cuatro de cada cinco, y eso erosiona
   más confianza que no decir nada.

Lo que sí debe hacer: **reconocer en el cuerpo que aún no hay hora** —callarlo
es el fallo que estamos arreglando— y pedirle el dato al administrador. Y si el
administrador **sí** promete la actualización, es un hecho dado y debe salir:
eso lo comprueba `duracion-promesa-dada-por-el-administrador`.

**Se revierte cambiando un caso**, si al verlo en el piloto se decide que la
promesa automática vale la pena junto con un recordatorio que la haga cumplir.

Están en el conjunto porque **son reales**: el aviso que nombra a una vecina por
su departamento y le pide que no toque el claxon existe en el corpus, lo escribió
un administrador de verdad.

**Nota para la revisión legal pendiente:** un comunicado que nombra a un
residente y menciona su deuda es práctica corriente en propiedad horizontal y
también de lo que más acaba en reclamación por buen nombre y datos personales.
La IA no crea esa exposición, la amplifica. Conviene que entre en el mismo
repaso legal que el hueco de Ecuador.

## Lo que este conjunto NO mide

- **Si el borrador está bien escrito.** Las afirmaciones comprueban que no
  inventa, que pide lo que falta y que respeta el contrato. La calidad de la
  redacción la juzga una persona en el piloto.
- **Si sirve.** Eso es la línea base del Paso 2.1 y el piloto del 2.6.
- **Un solo edificio.** Las proporciones vienen de un corpus de Ciudad de
  México. Sirven para descubrir qué casos existen, no para afirmar que así se
  reparten en el mercado.

## Cómo se usa

Lo consume el evaluador del Paso 2.4, que corre los 60 casos contra dos o tres
versiones de prompt y compara.

**Los prompts NO se han retocado para los casos de duración, a propósito.**
Decirle al modelo «pide siempre la hora de fin» antes de correr la evaluación
sería aprobarse el examen a uno mismo: no se sabría si hacía falta decírselo.
Primero se mide qué hace, y solo entonces se cambia el prompt — y se vuelve a
medir.

Hay una prueba —`functions/tests/ai-evalset.test.ts`— que valida cada caso
contra el esquema real del catálogo. **Si un caso no es invocable, falla ahí y no
el día de la evaluación.**
