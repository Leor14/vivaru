# El contexto del conjunto: qué cambió de verdad

Tres corridas reales del 14 de agosto de 2026, `v2-estructura`, 68 casos cada
una. **204 llamadas, USD 0,065** — medido, no estimado: la prueba de humo previa
costó 0,000321 por llamada.

| Corrida | Qué recibe el modelo | Archivo |
|---|---|---|
| `omitido` | Nada. Mensaje **idéntico** al de antes del cambio | `2026-08-14-05-07-12-real-ctx-omitido.json` |
| `con` | «El conjunto está dividido en varias agrupaciones» | `2026-08-14-05-08-56-real-ctx-con.json` |
| `sin` | «El conjunto es un edificio único…» | `2026-08-14-05-10-43-real-ctx-sin.json` |

## Lo primero: la referencia se reprodujo exacta

**52 de 60 en `omitido`, el 87%** — el mismo número que la corrida del 14 de
agosto a las 02:47, con los mismos ocho fallos. No es un detalle de higiene: a
temperatura 0,2 el modelo no es determinista y `v2` se movía dos puntos entre
corridas idénticas. Que el suelo salga clavado es lo que permite atribuir
cualquier diferencia al contexto y no al azar.

Y confirma que el mensaje sin contexto es byte a byte el de antes, que era el
requisito para poder comparar.

## La medición que importa no es la tasa, es la conducta

Una tasa global esconde justo lo que hay que ver. Esto es de qué pregunta el
modelo:

| Grupo | Corrida | Preguntas por caso | Casos con pregunta de alcance | Casos que dicen «torre» |
|---|---|---|---|---|
| 43 casos sin anclar | `omitido` | 2,09 | 35/43 | **19/43** |
| | `con` | 2,14 | 38/43 | 33/43 |
| | `sin` | 2,14 | 19/43 | **0/43** |
| 8 de edificio único | `omitido` | 1,50 | 6/8 | **5/8** |
| | `con` | 1,50 | 4/8 | 0/8 |
| | `sin` | 1,50 | 4/8 | **0/8** |

**La palabra «torre» desaparece por completo.** 24 casos la usaban en una
pregunta y quedan **cero**. Es el resultado que se buscaba y es total, no parcial.

**Y el modelo NO aprendió a callarse**, que era el riesgo real: sigue haciendo
las mismas 2,14 preguntas por caso. No dejó de preguntar — dejó de preguntar
*eso*. Es la diferencia entre lo que se construyó y lo que habría hecho una
prohibición.

Con torres, el efecto es el contrario y también es sano: **33 de 43 casos
mencionan la torre**, contra 19 sin decirle nada. Cuando las hay, pregunta mejor.

## La pregunta desplazada era real, y se destapó

Es el hallazgo con más consecuencia, y se ve en un solo caso —
`unico-alicuota-sin-monto`, una alícuota extraordinaria sin importe:

| | Qué preguntó |
|---|---|
| `omitido` | `[alcance]` ¿A qué torres, zonas o unidades afecta este cobro?<br>`[accion]` ¿Deben los residentes realizar algún trámite…? |
| `sin` | **`[otro]` ¿Cuál es el monto exacto de la alícuota extraordinaria aprobada?**<br>`[alcance]` ¿Aplica a todas las unidades del edificio o hay alguna excepción? |

Sin el contexto, el modelo gastó sus dos preguntas en las torres y en un trámite,
y **no preguntó por el dinero**. Con el contexto, lo primero que pregunta es el
monto. El número de preguntas no subió: cambió una por otra.

Esto era una hipótesis el 13 de agosto —«en cuatro de seis, la pregunta de
alcance aparece en lugar de la que se esperaba; no prueba que una desplace a la
otra»—. Ahora hay un caso donde se ve el intercambio.

## Ningún daño a los conjuntos que sí tienen torres

| | 60 casos originales |
|---|---|
| `omitido` | 52/60 · **87%** |
| `con` | 52/60 · **87%** |
| `sin` | 53/60 · 88% |

`con` es la corrida que representa lo que verá un conjunto multitorre en
producción, y da **exactamente el mismo número**. Dos casos se movieron en
direcciones opuestas (`falta-monto` cayó, `hechos-mal-escritos` se arregló) y eso
es ruido conocido: la lectura del 12 de agosto ya midió que `v2` oscila dos
puntos entre corridas idénticas. **No hay regresión.**

**Cero invenciones, cero alteraciones y cero repeticiones** en los 204
borradores, como en las corridas anteriores.

## El resultado en los ocho casos de edificio único

| Corrida | 60 originales | 8 de edificio único |
|---|---|---|
| `omitido` (sin el cambio) | 52/60 · 87% | **3/8 · 38%** |
| `con` | 52/60 · 87% | 7/8 · 88% |
| `sin` (el cambio) | 53/60 · 88% | **8/8 · 100%** |

Los cinco que fallan en `omitido` lo hacen todos por lo mismo, y se lee en las
frases: *«¿A qué torres o zonas del conjunto afecta la suspensión?»*, *«¿A qué
torre o zona afecta este mantenimiento?»*, *«¿A qué torres, zonas o unidades
afecta este cobro?»*. Cinco veces la misma pregunta imposible.

**Ojo con el 8/8: es una muestra, no una garantía.** Los ocho casos van anclados
a «edificio único», así que reciben el mismo contexto en las corridas `con` y
`sin`; que una diera 7 y la otra 8 es el ruido de siempre. Lo honesto es decir
**siete u ocho de ocho, contra tres sin el cambio**.

### Cómo se llegó a esos números, porque importa el método

**Las tres corridas se calificaron dos veces, y la segunda no costó nada.** La
primera lectura daba 3/8 → 5/8, y los tres casos que seguían fallando lo hacían
por una afirmación que escribí mal.

`missingInformationSinCategorias: ["alcance"]` prohibía **cualquier** pregunta de
alcance. Pero la decisión que implementa dice lo contrario, y está escrita en
tres sitios desde antes de correr —en la frase que recibe el modelo («Sí tiene
pisos y zonas comunes»), en el comentario del módulo y en una prueba llamada
*«NO le prohíbe preguntar por el alcance»*—. Mis casos contradecían la decisión
que implementaban.

Estas eran las tres preguntas que les costaban el fallo:

| Caso | La pregunta |
|---|---|
| `unico-agua-sin-duracion` | ¿La suspensión afecta a todo el edificio o a pisos específicos? |
| `unico-alicuota-sin-monto` | ¿Aplica a todas las unidades del edificio o hay alguna excepción? |
| `unico-tanquero-datos-vagos` | ¿El reparto es para todo el edificio o hay restricción por pisos o zonas? |

Ninguna dice «torre». **David decidió el 14 de agosto que esa pregunta es útil**
—un edificio de once pisos sí tiene zonas de las que hablar, y el corpus de Quito
menciona «piso» 109 veces—, así que la afirmación pasó a prohibir **la palabra**
(`torre`, `bloque`, `manzana`) en vez de la categoría.

**Y no se volvió a pagar por saberlo.** El corredor guarda el borrador entero de
cada caso justamente para esto: `functions/scripts/recalificar.mjs` vuelve a
calificar las mismas salidas con el conjunto corregido. Repetir las llamadas
habría devuelto salidas distintas —temperatura 0,2— y habría mezclado el efecto
de la afirmación con el del azar.

**La prueba de que la afirmación corregida no es un sello de goma: la corrida
`omitido` no movió un solo caso.** Ahí el modelo dice «torre» literalmente y
sigue fallando los cinco. La afirmación discrimina exactamente sobre lo que el
cambio ataca, que es lo que tenía que pasar.

### Lo que se mantuvo estricto, y por qué

`unico-fuga-en-un-piso` conserva la prohibición de la categoría entera: ahí el
alcance **ya se dio** —el piso 7—, así que preguntar por él sobra, hable de
torres o de pisos.

**Y el contrapeso, además de aguantar, se endureció.**
`unico-zonas-comunes-sin-alcance` siguió preguntando «¿Qué áreas comunes
específicas serán intervenidas?» en las dos corridas —su caída habría
significado retirar el cambio— y ahora **exige** esa pregunta **y** prohíbe que
nombre torres. Preguntar sí; preguntar por lo que no existe, no.

### La regla que queda escrita

Relajar una afirmación después de ver el resultado es la forma más común de
mentirse en un proyecto de IA — «ajustar el prompt hasta que pasen tus tres
ejemplos», en otra forma. **Lo que salva a esta corrección de serlo es que el
criterio existía antes de correr y la afirmación nunca lo reflejó.** No se movió
el listón para aprobar: se corrigió una pregunta del examen que medía otra cosa.

Si algún día hay que relajar una afirmación **sin** un criterio previo que la
contradiga, no se relaja: se acepta el número feo o se cambia el producto.

## Qué se puede afirmar hoy

1. El contexto **elimina la pregunta por las torres en edificios que no las
   tienen**: 24 casos → 0.
2. **No enseña a callarse**: el número de preguntas no baja.
3. **No hace daño donde sí hay torres**: 87% antes, 87% después.
4. **Destapa la pregunta desplazada** al menos en el caso del dinero, que era la
   sospecha del 13 de agosto.
5. En los casos escritos para un edificio único, pasa de **3 de 8 a 7 u 8 de 8**.
6. Sigue **sin haber nada desplegado**, ni en producción ni en staging. El código
   está en `develop` con las pruebas en verde.
