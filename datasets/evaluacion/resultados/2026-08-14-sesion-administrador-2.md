# Segunda sesión con un administrador real — lectura

Paso 2.6 de `docs/hoja-de-ruta-ia.md`, ejecutado según
`docs/guion-piloto-comunicaciones.md`. **14 de agosto de 2026**, en staging, con
el proveedor real encendido y sobre `tenant-palmas-cdmx` —24 unidades, edificio
único—, que es el primer conjunto que corre con el contexto desplegado.

Hoja de levantamiento en Drive: *Hoja de levantamiento v3 — sesión con
administrador (Vivaru)*. **La hoja quedó casi vacía**, así que esta lectura sale
de `aiUsage`, `aiFeedback` y los comunicados guardados. Lo que la instrumentación
registra sola resultó ser casi todo lo que hay.

Perfil, de lo poco que sí se anotó: **cinco años administrando, más de cien
unidades, y hoy escribe sus avisos por WhatsApp.**

---

## Lo que costó

```
4 llamadas · 4 correctas · 0 fallos · USD 0,002620
operationVersion 3 · v2-estructura · latencia mediana 1,7 s (máx 4,7 s)
```

Dos avisos, dos propuestas cada uno. **USD 0,0013 por aviso publicado.** Segunda
medición independiente que dice lo mismo que la del 13: el costo de esta
capacidad no es una pregunta abierta.

## Lo que hizo con lo que se le propuso

| Aviso | Propuestas | ¿Aplicó? | ¿Guardó? | Edición | Le mostró | Contestó | Descartó |
|---|---|---|---|---|---|---|---|
| Portería | 2 | sí | **sí** | **0%** | `accion` | — | `accion` |
| Junta de comité | 2 | sí | **sí** | **0%** | `duracion` | — | `duracion` |

## El agujero: no hay línea base, otra vez

**Los dos avisos escritos a mano no se hicieron.** En la hoja, las filas 1 a 3
están borradas —no vacías: borradas—, y el dato lo confirma: en el conjunto solo
hay **dos** comunicados guardados en toda su historia, y los dos son asistidos
(los dos tienen fila de `aiFeedback` y resumen generado).

**Sin ellos, H2′ no se puede contestar.** El objetivo entero de la sesión era
poder decir «el mismo administrador, el mismo día, el mismo canal», y eso exige
las dos mitades. Con una sola mitad, 2,5 de 4 es un número sin denominador.

Y es **la tercera sesión seguida sin línea base** —13 de agosto, y ahora las dos
mitades del 14—. Esta persona ya no sirve para tomarla: ya vio la herramienta.
**Hace falta un tercer administrador.**

Comparar contra el corpus vecinal es justo lo que el guion prohíbe: otra persona,
otro conjunto, otro canal. Sirve para el orden de magnitud y para nada más.

## Hallazgo — descartó las dos preguntas y no contestó ninguna, con la pantalla ya arreglada

`respondidos: []` en los dos avisos. `descartados: ["accion"]` y
`["duracion"]`. **Dos de dos descartadas, cero contestadas.**

El 13 de agosto pasó exactamente lo mismo y se leyó como un fallo de pantalla:
el administrador no sabía dónde escribir la respuesta y usó «No aplica» para
salir del paso. Se arregló —cada pregunta con su campo debajo, y contestar se
cuenta aparte de descartar— y el arreglo está desplegado desde entonces.

**Con la pantalla arreglada, el siguiente administrador hizo lo mismo.** Eso ya
no se explica con la pantalla. Quedan tres explicaciones y ninguna es cosmética:

1. La pregunta no le interesa —publica sin ese dato y le parece bien—.
2. Descartar es más barato que contestar, y el producto no le da motivo para
   pagar el precio de contestar.
3. El dato no lo tiene en ese momento y no va a ir a buscarlo.

**Las tres tienen la misma consecuencia:** «la lista de lo que falta va antes del
borrador y es el producto» —escrito el 12 de agosto como el corazón de la
pantalla— lleva dos administradores seguidos sin usarse. Es material del
Paso 2.7, no un ajuste.

## Hallazgo — edición 0% otra vez, pero pidió dos propuestas por aviso

`distanciaEdicion: 0` en los dos, aplicados y guardados, ninguno deshecho.
**Publicó literal lo que salió del modelo**, igual que el del 13.

Con una diferencia que conviene no perder: **pidió el borrador dos veces en cada
aviso.** No editó, pero sí volvió a generar. No es «me sirve tal cual»; es
«vuelve a intentarlo, y ahora sí». La palanca que usa esta gente es **regenerar,
no corregir** — y el producto hoy está construido para que corrijan.

## Lo que sí quedó comprobado: el contexto del conjunto

Las cuatro llamadas salieron en `operationVersion 3`, y **en los dos textos
publicados no aparece «torre», «bloque» ni «manzana»**. Es la primera
comprobación del cambio del 14 de agosto fuera del banco de pruebas.

**Con su limitación, dicha entera:** el contenido de los borradores no se guarda
—decisión de diseño de la telemetría, para que la fila de uso no lleve nada de
lo que escribió la persona—, así que esto se comprueba sobre los **dos textos
publicados**, no sobre los cuatro borradores. Es evidencia buena, no evidencia
completa.

## Los dos avisos, y la lectura de los cuatro datos

**Cambio de proveedor de portería** — «…se realizará un cambio de proveedor de
portería. Este proceso se llevará a cabo durante la primera semana del próximo
mes. Se les notificará oportunamente el nombre del nuevo proveedor…»

**Cambio de fecha: junta de comité vecinal** — «…la junta de comité vecinal se
adelanta una semana. La reunión se llevará a cabo el domingo 23 a las 17 hrs en
el espacio de usos múltiples. Les pedimos a todos puntualidad…»

| Aviso | Cuándo | Dura | Quién | Acción | Total |
|---|---|---|---|---|---|
| Portería | ✅ «primera semana del próximo mes» | ❌ | ❌ | ✅ no pide nada, cuenta | **2/4** |
| Junta | ✅ «domingo 23, 17 hrs» | ❌ | ✅ «a todos» | ✅ puntualidad | **3/4** |

**Media 2,5 de 4.** Y el detalle que ata los dos hallazgos: **en los dos casos el
dato que falta es exactamente el que el modelo le señaló y él descartó.** El
modelo acertó las dos veces; la pantalla se lo dijo; se publicó sin ello.

**Cero invenciones.** Nada en los textos contradice ni excede lo que se ve del
aviso. Las dos reglas duras del 13 de agosto siguen sosteniéndose.

## Lo que esta sesión NO midió

- **H2′**, por falta de línea base. Es lo que venía a medir.
- **Los minutos.** Sin cronómetro no hay comparación de tiempo, y el argumento de
  ahorro de tiempo sigue sin sostenerse con datos propios.
- **Los atascos.** La hoja dice «no», y la instrumentación no puede contradecirlo
  ni confirmarlo: no mide dónde dudó una persona.
- **G6**, como siempre: exige gente usándolo por su cuenta, semana tras semana.

## Qué hacer a continuación

1. **Un tercer administrador, solo para la línea base.** Dos avisos a mano,
   cronómetro, y nada más. Si la hora completa es difícil de conseguir, veinte
   minutos de línea base valen más que otra sesión asistida.
2. **Llevar al 2.7 la pregunta que abrieron los dos hallazgos:** si dos
   administradores de dos conjuntos distintos descartan el 100% de las preguntas
   y editan el 0% del texto, ¿la lista de lo que falta es el producto, o lo es el
   borrador que sale a la primera? La respuesta cambia qué se construye después.
3. **No tocar el contrato ni el prompt con esta evidencia.** Dos sesiones no son
   una muestra, y el cambio del 14 de agosto acaba de entrar.
