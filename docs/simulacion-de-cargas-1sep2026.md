# Qué le pasa al importador cuando le entran archivos raros

**1 de septiembre de 2026.** 36 archivos construidos a propósito y metidos por el camino real del
importador —desde los bytes— con `scripts/simulacion-de-cargas/`. Los inventaron cuatro agentes
con territorios separados: Colombia, México, Ecuador/Perú/Chile, y uno que no hace vocabulario
sino **roturas de formato**.

> **QUÉ ES Y QUÉ NO ES.** Contesta preguntas de **correctitud** —¿revienta?, ¿elige la hoja
> buena?, ¿qué mapea?— y para eso un archivo inventado vale igual que uno real: el código no sabe
> de dónde vino. **No contesta preguntas de frecuencia**, y confundirlo sería el error caro. Que
> 36 archivos pasen no significa que el importador esté listo para el primer cliente: significa
> que 36 formas conocidas de romperlo ya no lo rompen.

## El resultado en una línea

**De los 8 archivos que salieron «entra limpio», 2 estaban mal mapeados de arriba abajo.** Y de
los 6 que bloquearon, 2 bloquean un archivo perfectamente importable por una sola palabra.

## Defecto 1 — la cuarta pasada decide por POSICIÓN, y en silencio

**Es la causa de fondo de la mitad de los hallazgos**, y aparece en archivos de tres países que
inventaron agentes distintos sin hablar entre sí.

`suggestMapping` tiene cuatro pasadas: nombre exacto, contenido, contención y **variedad**. La
cuarta es «el último recurso para el texto libre que nadie resolvió»: a un campo obligatorio sin
resolver le adjudica la primera columna que quede con ≥ 0,9 de valores distintos. **En un padrón,
eso lo cumplen el nombre, el correo, el teléfono, la cédula y el número de casa a la vez** — así
que el desempate real es **el orden de las columnas en el archivo**.

Falsado moviendo una columna: el MISMO archivo, con «C.C.» a la izquierda de «PROPIETARIO»,
bautiza las unidades con la cédula en vez de con el nombre del dueño. **Ninguna de las dos
versiones avisa de nada.**

| Archivo | Qué hace |
|---|---|
| `10` · padrón mixto CO | `unit.displayName ← «PROPIETARIO»`; «APTO» —el apartamento real— al descarte |
| `25` · privada MX sin correo | `fullName ← «Casa»`, `email ← «Propietario»`, `unitLabel ← «Teléfono de casa»`. **«✔ entra limpio»** |
| `37` · padrón CL | `person.email ← «RUT»` **y «Mail» sin usar** |
| `34` · edificio EC | `unit.tower ← «Alícuota»` cuando no hay columna de bloque |
| `26` · privadas MX | `unit.tower ← «Cuota»`, porque una cuota repite valores como los repetiría una agrupación |
| `44` · título en dos celdas | Los cuatro obligatorios mal, y entran dos «personas»: una vacía y otra llamada «Correo» |

**Y `mappingIssues` no puede avisar de ninguno**, porque su comprobación de cardinalidad solo
bloquea cuando la columna repite **un único** valor, y estas no repiten nada.

> **El daño no es igual en los dos asistentes, y la diferencia importa.** Importando PERSONAS el
> disparate no entra: el correo se valida aguas abajo y las filas salen «Email inválido» — falla
> el diagnóstico, no el dato. Importando UNIDADES **no hay red**: `displayName` solo se comprueba
> «no vacío», así que una unidad llamada `Ana Pérez` pasa todas las validaciones y **se crea**.

## Defecto 2 — el guardián de la unidad partida depende de la PALABRA, no del problema

El aviso que se construyó esta misma mañana funciona, y **solo ve seis palabras**: torre, tower,
bloque, etapa, manzana, edificio. Dos agentes lo destaparon por separado con archivos idénticos
salvo el rótulo:

- `13` («Torre» + «Apto») → **bloquea** con el mensaje exacto.
- `12` («Interior» + «Apto», que es la palabra corriente en Bogotá) → **entra**. Medido: 6
  personas caen en 3 unidades, 3 de ellas en el apartamento equivocado.
- `33` («Escalera», la palabra de Guayaquil) → **entra**, y los dos «3-A» se funden.

## Defecto 3 — dos cosas que rompió lo que se desplegó HOY

1. **La telemetría de preámbulo no puede ver su propio punto ciego.** `filasDePreambulo` existe
   para saber en cuántos archivos reales hace falta la detección. En `44` —título repartido en dos
   celdas— el preámbulo real son 2 filas y **reporta 0**: dice «no hizo falta» exactamente en los
   archivos donde falló. Cualquier conteo construido sobre él saldrá tranquilizador.
2. **El mensaje de rechazo es falso.** Una plantilla devuelta sin diligenciar —encabezados y cero
   filas— se rechaza con «El archivo no tiene una fila de encabezados». Sí la tiene. `armarHoja`
   devuelve `null` por dos motivos y `leerCsv` solo sabe contar uno; el camino XLSX dice otra cosa
   («El libro no tiene ninguna hoja con datos»), que sí es cierta. **Manda a arreglar lo único que
   está bien.**

## Defecto 4 — filas de adorno que entran como personas

`42` sale **«✔ entra limpio»** con **3 de 7 filas** que son subtotal, una fila que parece vacía y
un TOTAL. Invisibles porque la muestra salta las celdas vacías, así que «Tipo» y «Estado» siguen
encajando al 100%. Lo mismo en `15` (CO) con 6 filas donde hay 4 personas.

## Defecto 5 — el vocabulario tumba archivos impecables

- **`departamento` no es un tipo de unidad**, y es como se dice en México, Ecuador, Perú y Chile
  sin excepción. `21` es un inventario impecable y **bloquea entero** por esa palabra.
- **`estacionamiento` tampoco** (sí están `parqueadero` y `garaje`), y con 2 de 6 filas válidas se
  queda en «duda»: entra con cuatro unidades mal tipadas.
- **`ocupado`/`arrendado`/`desocupado`** bloquea el archivo entero (`17`) **y no tiene salida en
  esa pantalla**: mapear la columna bloquea, y no mapearla deja un obligatorio pendiente.
- Sin reconocer, medido: `Mail`, `Cel.`, `Identificación`, `RFC`, `CURP`, `Privada`, `Sección`,
  `Interior`, `Escalera`, y los roles `Condómino`, `Poseedor`, `Usufructuario`, `Tenedor`.

## Y una trampa del propio instrumento, que invierte la señal

**Un mapeo equivocado deja MENOS columnas sin usar que uno correcto**, porque la cuarta pasada se
come las sobrantes. `23` —que mapea todo bien— sale con «3 columnas sin usar»; `25` —que lo mapea
casi todo mal— sale «entra limpio».

**Esto no es solo del banco: `encabezadosSinUsar` es la telemetría con la que `AI-ONB-001` iba a
saber qué trae la gente.** Sub-reporta justo cuando las cosas van peor.

## Lo que este banco todavía no puede expresar

No es un olvido, es el alcance de hoy — y lo tercero de la lista es probablemente la rotura más
común del mundo real:

1. **Celdas no textuales**: todo se escribe como texto, así que no se puede probar un documento
   guardado como **número** (Excel se come los ceros antes de que el archivo llegue) ni una fecha
   como serial. `raw: false` existe justo para eso y hoy es inverificable desde aquí.
2. **Celdas combinadas** (`!merges`): el título real de una administración es un `A1:E1`.
3. **Codificación**: siempre UTF-8. No se puede construir un CSV Windows-1252, que es lo que
   convierte «Pérez» en «PÃ©rez».

## Lo que aguantó, y conviene anotarlo

BOM + CRLF + punto y coma juntos; la hoja buena elegida de un libro de cuatro con «Saldos»
delante; ceros a la izquierda intactos por la ruta CSV; saltos de línea y comillas dentro de
celda; el archivo de una sola columna; y **ninguna excepción técnica en pantalla en 36 archivos**
— los defectos son todos de silencio, no de ruido.

> **El BOM sobrevivió por accidente, y por partida doble:** `File.text()` se lo come por la norma
> de decodificación, y `trim()` lo borraría igual porque U+FEFF cuenta como espacio. **Ninguna de
> las dos defensas se escribió para el BOM**, así que nada lo protege si la ruta de lectura cambia.
