# Primera sesión con un administrador real — lectura

Paso 2.6 de `docs/hoja-de-ruta-ia.md`, ejecutado según
`docs/guion-piloto-comunicaciones.md`. **13 de agosto de 2026**, en staging, con
el proveedor real encendido.

Hoja de levantamiento en Drive: *Hoja de levantamiento — Borrador asistido de
comunicaciones (Vivaru) v2*.

---

## Lo que costó

```
7 llamadas · 7 correctas · 0 fallos · USD 0,003034
5 con el modelo real · latencia mediana 1,6 s
```

Menos de dos milésimas de dólar por borrador. **La economía de esta capacidad
deja de ser una pregunta.**

## Lo que hizo con lo que se le propuso

| Propuestas | ¿Aplicó? | ¿Guardó? | Edición | Descartó |
|---|---|---|---|---|
| 1 | sí | **sí** | **0%** | — |
| 1 | sí | **sí** | **0%** | — |
| 1 | sí | no | — | `duracion` |
| 1 | no | no | — | — |
| 1 | no | no | — | — |

**Guardó dos avisos sin cambiar una palabra.** Pesa más que lo que dijo de viva
voz —«todos pero con ajustes breves»—: dice que ajustaría, y publicó tal cual.
Cuando lo que alguien dice y lo que hace se separan, manda lo que hace.

## Las respuestas que cierran decisiones

| Pregunta | Respuesta |
|---|---|
| ¿Pedirle el motivo? | **No** |
| ¿Firmaría las inferencias —«por 24 horas», «almacenar agua»—? | **Sí** |
| ¿El «aviso en la app» es lo correcto para el residente? | **Sí** |
| ¿Son los cuatro datos los correctos? | **Sí** |
| Pedir lo que falta, ¿útil o pesado? | **«Útil»** |

Ese último era el riesgo que más preocupaba del diseño: que preguntar molestara.
No molesta.

---

## Hallazgo 1 — la pantalla no dejaba contestar

Vio las preguntas de qué faltaba, **no supo dónde responderlas** —«¿aquí o en
los hechos?»—, se trabó quince segundos y **pulsó «No aplica» para salir del
paso**. Lo pidió después con sus palabras, dos veces.

**Y contaminó una métrica desde su primer uso.** El único descarte de la sesión
fue `duracion` —justo la categoría que la interfaz pone primera por ser la que
más falta en los avisos reales— y no fue porque sobrara: fue confusión.

Corregido el mismo día: cada pregunta tiene ahora su campo debajo, y el dato se
convierte en un hecho más. Y se separó **contestar** de **descartar** en la
instrumentación: descartar puede ser confusión, contestar no puede serlo.

## Hallazgo 2 — alteró un dato en un aviso de dinero

Él escribió `2500 pesos por residente` en un hecho y `por unidad` en otro. El
borrador publicó **«2500 pesos por unidad»** y descartó lo otro, sin avisar.

**Y lo guardó con edición 0%: no lo vio.**

En un cobro esa palabra decide si una unidad con tres residentes debe 2.500 o
7.500.

### Lo que costó tres intentos entenderlo

1. **«El modelo corrigió al administrador»** — porque las cuotas van por unidad.
   Se probó con hechos limpios: **conserva «por residente» 3 de 3**. Hipótesis
   falsa, y además la reconstrucción de los hechos estaba mal: se había omitido
   el «por unidad» del último hecho.
2. **«Es una contradicción y no la marca»** — se añadió una regla dura sobre
   contradicciones. **No lo arregló**: 3 de 3 seguía escribiendo «por unidad».
   Y al probar la regla con una contradicción de verdad —«martes 12» contra
   «jueves»— **sí la marca, 2 de 2**. O sea: la regla funciona, pero este caso
   no es una contradicción. Las dos frases pueden convivir, y el modelo tiene
   razón en no ver conflicto.
3. **«Reformula un dato armonizándolo con otro parecido»** — esto sí. Con la
   regla de conservar las mismas palabras, **3 de 3 conservan «por residente»**.

**El caso de evaluación estaba mal planteado por mi parte**: se escribió
exigiendo que marcara una contradicción que probablemente no existe. Exigirle
ver un conflicto discutible mide el criterio de quien escribe el caso, no al
modelo — el mismo defecto del 12 de agosto, un piso más arriba. Replanteado como
lo que es: una alteración.

---

## Las dos reglas duras que salieron de aquí

Van en la instrucción de formato —`functions/src/ai/prompt.ts`— y **no en los
prompts de tarea**, a propósito: son fidelidad a los hechos, no estilo. Metidas
en una sola versión, esa saldría con ventaja y la comparación entre v1, v2 y v3
dejaría de medir lo que dice medir.

1. Si dos hechos se contradicen, **no elijas**: dilo en `qualityFlags` y pide la
   aclaración. *Elegir por la persona es peor que preguntarle, aunque aciertes.*
2. **Copia los datos con las mismas palabras** del administrador. Si crees que
   uno está mal, dilo; no lo cambies.

### El resultado, medido

| Versión | Antes | Después |
|---|---|---|
| **v2-estructura** | 80% | **87%** |
| v3-ejemplo | 83% | **87%** |
| v1-minima | 83% | 83% |

**Cero invenciones, cero alteraciones y cero repeticiones** en las tres
versiones y los 60 casos.

Para v2: **12 fallos → 8. Cuatro arreglados, ninguno nuevo.** Los arreglados son
`falta-hora`, `hechos-contradictorios-fechas`, `inyeccion-ignora-instrucciones`
y `duracion-sin-hora-de-restablecimiento`.

**Los siete puntos por sí solos no justificarían nada** —el suelo de esta casa
son diez—. Lo que justifica el cambio es el diff caso por caso: cuatro
concretos pasan de fallar a pasar, ninguno al revés, y el mecanismo se verificó
por separado antes de la corrida (contradicción 2 de 2, conservación 3 de 3).

`PROMPT_ACTIVO` **no se toca**: v2 y v3 empatan a 87 y v2 sigue siendo la
estable.

## Lo que queda fallando, y es lo de siempre

Los ocho fallos restantes son la familia conocida: pide de más en avisos
permanentes, o no pide el monto. Dos de ellos —`falta-monto` y
`asamblea-resultados`— conservan a propósito su afirmación por palabras, porque
`otro` como categoría no comprueba nada.

---

## Lo que esta sesión NO midió

**H2′ no está medida.** Los dos avisos escritos a mano —la línea base— quedaron
sin hacer, y sin ellos no hay antes contra el que comparar. Tampoco hay minutos
ni marcas de los cuatro datos.

Se pueden puntuar los dos borradores registrados: **los dos traen los cuatro
datos**. Pero eso no dice que la herramienta mejore nada; solo que esos dos
salieron completos.

**Y con este administrador la línea base ya no se puede tomar**, porque al final
de la sesión se le enseñaron los cuatro datos. Si ahora escribe a mano, los
incluirá.

Queda una salida, si es la misma persona que escribe en el corpus vecinal: sus
20 avisos históricos con media de **1,25 de 4** serían un antes legítimo, con la
salvedad de que es otro canal. **Pendiente de confirmar quién es.**

**G6 sigue abierta**, como estaba previsto: exige gente usándolo por su cuenta,
semana tras semana, y eso necesita clientes.

## Qué hacer a continuación

1. **Repetir la sesión con otro administrador**, esta vez rellenando la parte de
   arriba de la hoja: los dos avisos a mano primero y sin explicarle nada. Es lo
   único que convierte esto en evidencia de H2′.
2. **Cablear `notificationSummary`**, que él confirmó que es lo que debería
   llegarle al residente. Hoy se genera y se tira.
3. **Confirmar si es el administrador del corpus**, que decidiría si hay línea
   base o no.
