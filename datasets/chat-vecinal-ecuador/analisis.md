# Ecuador contra México: ¿generalizan los cuatro datos?

Medido el **13 de agosto de 2026** sobre los dos corpus anonimizados, con
`scripts/analizar-corpus-vecinal.mjs`.

## Por qué había que hacerlo

Todo el canario se apoya en una medición de **un edificio de un país**: los
cuatro datos, sus frecuencias, la taxonomía de los 60 casos de evaluación, el
orden de la lista en pantalla y la línea base de 1,2 de 4. Los tres documentos
lo dicen como limitación, no como certeza.

Un segundo corpus de otro país es la forma más barata que existe de saber si
construimos un producto o construimos para un edificio.

## La decisión de método que hace válida la comparación

**El análisis mexicano del 12 de agosto se hizo con expresiones regulares que no
se guardaron** — su documento dice que «están en el historial de la sesión». Eso
significaba que analizar Ecuador con reglas escritas de nuevo habría producido
diferencias imposibles de atribuir: ¿el país, o el tamiz?

Por eso se escribió **un script y se corrió sobre los dos**. Los números de aquí
son comparables entre sí, y esa es toda su utilidad.

> **AVISO, y hay que leerlo antes de citar cualquier cifra de este documento.**
> Estos porcentajes **no son** los del análisis del 12 de agosto. Aquel, sobre
> 71 avisos, daba alcance 52%, cuándo 43%, acción 16% y duración 5%. Este, con
> detectores distintos, encuentra 91 avisos en el mismo corpus y da otros
> desgloses. **La media coincide casi exacta —1,22 contra 1,2— y eso es lo
> tranquilizador**, pero los desgloses no son intercambiables. No mezclar las
> dos series en una misma tabla.

## El resultado

| | México | Ecuador |
|---|---|---|
| Mensajes | 7.352 | 4.358 |
| Periodo | 2 años y 5 meses | **6 años y 9 meses** |
| Avisos operativos | 91 | 40 |
| **Media de datos de 4** | **1,22** | **1,07** |
| A quién afecta | 34% | **13%** |
| Cuándo | 45% | **63%** |
| Qué debe hacer | 29% | 23% |
| **Cuánto dura** | **14%** | **10%** |
| Autores de avisos | 16 | 12 |

## Lo que se confirma

**La hipótesis aguanta.** Los avisos de un edificio de Quito traen **1,07 de 4
datos**; los de uno de Ciudad de México, 1,22. Dos países, dos edificios,
prácticamente el mismo número. El problema que el canario intenta resolver no
era una peculiaridad de un conjunto.

**Y es peor de lo que parecía:** en Ecuador, **31 de 40 avisos traen uno o
ninguno de los cuatro datos** —el 78%, contra el 64% de México—. **Ninguno llega
a los cuatro.** En México llegaba uno de 91.

**«Cuánto dura» es el peor dato en los dos países.** 14% en México, 10% en
Ecuador. Es la confirmación que más importa, porque es la decisión de producto
más visible de toda la pantalla: la lista de lo que falta pone la duración
arriba del todo. **Esa decisión se sostiene en dos países, no en uno.**

**Doce personas escriben los avisos**, igual que en México. La calidad del aviso
sigue dependiendo de quién estuvo frente al teclado, y la administradora —que
escribe casi la mitad— no es la que mejor puntúa.

## Lo que cambia, y es un hallazgo de producto

**«A quién afecta» se desploma en Ecuador: del 34% al 13%.** No es que los
ecuatorianos informen peor. Es estructural:

| Término | México | Ecuador |
|---|---|---|
| **torre** | **274** | **0** |
| bloque | 6 | 8 |
| piso | 125 | 109 |

**El conjunto mexicano tiene torres. El ecuatoriano es un edificio único.** Si
todo afecta a todos, nadie lo dice — y no debería decirlo.

### La consecuencia, que conecta con la evaluación

En la última corrida, **la mitad de los fallos que le quedan a `v2-estructura`
son pedir el alcance donde no aplica**: `seguridad-cambio-de-empresa`,
`luz-corte-programado-cfe`, `cuota-extraordinaria` y `falta-monto`. El modelo
pregunta «¿a qué torres afecta?» en avisos que afectan a todo el mundo.

Se venía leyendo como un defecto del modelo. **Este corpus dice que es un
defecto del diseño**: el cuarto dato no es igual de relevante en todos los
conjuntos, y nosotros lo tratamos como si lo fuera.

**La salida no es enseñarle a preguntar menos** —eso destruiría el valor del
producto, y está escrito desde el 12 de agosto—. La salida es que Vivaru **ya
sabe** si un conjunto tiene torres: está en `units.tower`. Pasar ese dato a la
operación permitiría no preguntar por el alcance en un edificio único, sin
tocar nada de lo demás.

Es un cambio del contrato de entrada, así que necesita su propia decisión y su
propia corrida. **No se hace ahora**, pero por primera vez hay evidencia de dos
países para justificarlo.

## Los límites, dichos aquí para que nadie los descubra tarde

- **Dos edificios, no dos mercados.** Un conjunto de Quito y uno de Ciudad de
  México. Sirve para saber si algo generaliza; no para afirmar proporciones de
  mercado.
- **40 avisos en Ecuador.** Es poco. Los porcentajes se mueven mucho con dos o
  tres casos.
- **La detección es por expresiones regulares** y subestima formas de decir las
  cosas que no están en la lista. Se incluyó vocabulario de los tres mercados
  —«pipa» y «tanquero», «cuota» y «alícuota»— precisamente para que el detector
  no hiciera parecer que en Ecuador no se habla de agua.
- **Colombia sigue sin corpus**, y está en `PAISES` igual que los otros dos.
- **El corte de 160 caracteres y los verbos de anuncio** son los del análisis
  mexicano, heredados sin volver a discutirlos.
