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

## Lo que NO salió como se esperaba, y es mi error, no del modelo

Los 8 casos de edificio único pasan de **3/8 a 5/8**. Los tres que siguen
fallando lo hacen **por la misma afirmación**, y la afirmación la escribí yo mal.

`missingInformationSinCategorias: ["alcance"]` prohíbe **cualquier** pregunta de
alcance. Pero la decisión que tomamos antes de construir decía lo contrario, y
está escrita en tres sitios —en la frase que recibe el modelo («Sí tiene pisos y
zonas comunes»), en el comentario del módulo y en una prueba llamada *«NO le
prohíbe preguntar por el alcance»*—. Mis tres casos contradicen la decisión que
implementan.

Esto es lo que preguntan en realidad los tres que fallan:

| Caso | La pregunta que le cuesta el fallo |
|---|---|
| `unico-agua-sin-duracion` | ¿La suspensión afecta a todo el edificio o a pisos específicos? |
| `unico-alicuota-sin-monto` | ¿Aplica a todas las unidades del edificio o hay alguna excepción? |
| `unico-tanquero-datos-vagos` | ¿El reparto de agua es para todo el edificio o hay alguna restricción por pisos o zonas? |

Ninguna dice «torre». Las tres preguntan por pisos o unidades, que es lo que un
edificio único **sí** tiene y lo que el corpus de Quito menciona 109 veces. El
modelo hizo lo que se le pidió; la afirmación mide otra cosa.

**Y el contrapeso aguantó.** `unico-zonas-comunes-sin-alcance` sigue preguntando
«¿Qué áreas comunes específicas serán intervenidas?» en las dos corridas. Ese era
el caso cuya caída habría significado retirar el cambio: no cayó.

### Por qué esto no se arregla solo, y qué NO hay que hacer

Relajar una afirmación después de ver el resultado es la forma más común de
mentirse en un proyecto de IA — «ajustar el prompt hasta que pasen tus tres
ejemplos», en otra forma. La distinción que salva este caso concreto es que **el
criterio se escribió antes de la corrida y la afirmación nunca lo reflejó**: no
se está moviendo el listón para aprobar, se está corrigiendo una afirmación que
nunca midió lo que decía medir.

Aun así **no se toca sin decisión**, porque debajo hay una pregunta de producto
que no es técnica: en un edificio único, ¿«¿afecta a todo el edificio o a pisos
específicos?» es una pregunta útil o es ruido que el administrador va a descartar?

Queda abierta. Las dos salidas, con su consecuencia:

- **Medir la palabra, no la categoría.** La afirmación pasa a prohibir que la
  pregunta diga «torre», que es literalmente lo que el conjunto no tiene. Mide lo
  que la decisión dice. Los tres casos pasarían.
- **Dejarla estricta.** Se acepta 5/8 y se trata la pregunta por pisos como el
  siguiente hueco a cerrar. Es más exigente y deja el número feo a la vista, que
  no es lo peor que le puede pasar a un conjunto de evaluación.

## Qué se puede afirmar hoy

1. El contexto **elimina la pregunta por las torres en edificios que no las
   tienen**: 24 casos → 0.
2. **No enseña a callarse**: el número de preguntas no baja.
3. **No hace daño donde sí hay torres**: 87% antes, 87% después.
4. **Destapa la pregunta desplazada** al menos en el caso del dinero, que era la
   sospecha del 13 de agosto.
5. Sigue **sin haber nada en producción**. Esto vive donde vive el canario.
