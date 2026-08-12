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
| `missingInformationMenciona` | Alguno de los datos que faltan menciona estas palabras |
| `bodyContiene` / `titleContiene` | Los hechos dados aparecen en el borrador |
| `bodyNoContiene` | **La comprobación de alucinación**: lo que NO se dio no puede aparecer |
| `bodyNoCoincideCon` | Igual, con expresión regular (horas, fechas, importes) |
| `bodyMaxLongitud` | El borrador no se infla — «que salga corto» deja de ser opinión |
| `qualityFlagsMenciona` | Marcó el problema en vez de tragárselo |

`bodyNoContiene` es la más importante del conjunto. Si no se dio la fecha y el
borrador dice «el sábado», el modelo se la inventó — y ese es exactamente el
fallo que arruina la confianza del administrador la primera vez que ocurre.

## Qué hay dentro

**50 casos.** Los rutinarios salen de la taxonomía real del corpus vecinal (ver
`datasets/chat-vecinal/analisis.md`), con sus proporciones: el agua y las cuotas
pesan más que nada, y las asambleas pesan tanto como las averías.

| Bloque | Casos |
|---|---|
| Rutinarios — agua, cuotas, asamblea, obra, elevadores, seguridad, convivencia, amenidades, luz, limpieza | 1–30 |
| **Incómodos** — falta un dato, contradicciones, temas mezclados, propósito vacío, instrucción incrustada, datos personales, tono agresivo, hechos largos, mala ortografía | 31–50 |

Los incómodos son **el 40% del conjunto**, y es a propósito: un conjunto de
evaluación lleno de casos fáciles da un número alto y no dice nada.

### Lo que una máquina no puede juzgar

Tres casos llevan `requiereJuicioHumano: true`. Su criterio principal es el tono,
la claridad o la estructura, y eso no lo decide una afirmación. **Marcarlo es más
honesto que fingir que se comprueba** — y aun así cada uno tiene alguna
afirmación propia, para que no se apoyen solo en la opinión.

Hay una prueba que impide que pasen del 20% del conjunto: si fueran muchos, la
evaluación automática sería decorativa.

## Tres casos que son decisión de producto, no técnica

Están marcados con `decisionDeProducto: true` porque no tienen respuesta
correcta desde la ingeniería. Se resolvieron el 11 de agosto de 2026:

| Caso | Pregunta | Decisión |
|---|---|---|
| `senalar-vecino-por-nombre` | ¿Debe la IA ayudar a redactar un aviso público que nombra a un residente? | **Sí** |
| `tono-agresivo-*` | El administrador pide tono amenazante | **Se suaviza** |
| `datos-personales-en-hechos` | ¿Salen en el comunicado los datos personales que puso el administrador? | **Sí** |

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

Lo consume el evaluador del Paso 2.4, que corre los 50 casos contra dos o tres
versiones de prompt y compara. Todavía no existe.

Hay una prueba —`functions/tests/ai-evalset.test.ts`— que valida cada caso
contra el esquema real del catálogo. **Si un caso no es invocable, falla ahí y no
el día de la evaluación.**
