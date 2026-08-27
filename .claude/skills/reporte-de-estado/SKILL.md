---
name: reporte-de-estado
description: Construir un reporte ejecutivo de estado de proyecto en lenguaje de negocio — dónde vamos, qué se hizo, qué falta y por qué, y qué cambió respecto de antes. Úsala cuando alguien pida un estado, un avance, un resumen para socios o cliente, un «¿cómo vamos?», un antes/después, o una vista ejecutiva de un frente o del producto entero. Palabras que la disparan: estado, avance, status, reporte, resumen ejecutivo, cómo vamos, qué falta, qué hicimos, antes y después, para el socio, para el cliente. NO es para especificar trabajo nuevo — para eso, `crear-prd-vivaru` o `crear-prd-ia-vivaru`.
---

# Reporte de estado de proyecto

Contestar **dónde vamos** de forma que quien lo lea pueda decidir algo, y sin que haga falta ser del equipo para entenderlo.

## El principio superior

> **El reporte no se escribe leyendo los documentos: se escribe MIDIENDO, y los documentos son una de las cosas que se verifican.**

Un roadmap, una PRD y una bitácora dicen lo que alguien creyó cierto el día que lo escribió. Un reporte que los copia hereda sus huecos **y les añade autoridad**.

El caso que fundó esta regla: el 26 de agosto de 2026 la tabla ejecutiva de `docs/roadmap-producto.md` **no listaba «Propiedad horizontal»**, el frente donde había ido todo el trabajo de los tres días anteriores. Un reporte derivado de ese documento habría tenido un agujero del tamaño del proyecto y habría sonado igual de seguro.

**Corolario:** cuando lo medido y lo documentado discrepan, **la discrepancia es un hallazgo del reporte**, no un detalle a resolver en silencio. Va escrita.

## Paso 0 · La puerta «¿esto merece un reporte?»

No todo la merece, y hacerlo bien cuesta —medir de verdad lleva tiempo—.

**NO merece reporte:** un «¿cómo va X?» en conversación, el estado de una sola tarea, algo que se contesta en tres líneas. Contestar en el chat y ya.

**SÍ merece reporte:** alguien va a **decidir** con eso (invertir, vender, priorizar, parar); alguien de **fuera del equipo** lo va a leer; hay que **compararlo con otro momento**; o va a **circular** y sobrevivir a la conversación.

Si no merece, decirlo y contestar directamente. Decirlo forma parte del trabajo.

## Paso 1 · La entrevista, ANTES de medir

Cuatro preguntas. Van primero **porque determinan qué medir** — medir todo y filtrar después es la forma cara de hacerlo.

| # | Pregunta | Para qué sirve la respuesta |
|---|---|---|
| **1** | **¿Para quién es?** ¿Socio, cliente, equipo, alguien no técnico? | Fija el vocabulario y qué se omite. A un socio no le importa el nombre del módulo; a un cliente no le importa la deuda técnica |
| **2** | **¿Qué pregunta viene a contestar?** | Fija el peso de cada sección. No es lo mismo «¿ya está?» que «¿qué falta y por qué?» |
| **3** | **¿Contra qué momento se compara?** Una fecha, un hito, «antes de empezar» | Sin esto, el «antes y ahora» se inventa |
| **4** | **¿Qué NO debe salir?** Cifras comerciales, nombres de clientes, problemas internos | Es más barato preguntarlo que retirarlo después de enviado |

Si quien pide no sabe contestar la 2, **la pregunta es «¿qué vas a decidir con esto?»**. Casi siempre destraba.

### Los ángulos, y qué pesa en cada uno

| La pregunta que trae | Qué pesa |
|---|---|
| «¿Dónde vamos?» | Las siete secciones, equilibradas |
| «¿Qué hicimos?» | Inventario y antes/ahora |
| «¿Qué falta y por qué?» | Los frenos, **clasificados por tipo** |
| «¿Qué cambió desde X?» | Antes/ahora, contra ese momento exacto |
| «¿Está listo? / ¿podemos venderlo?» | La escalera y el dato que enmarca |

## Paso 2 · Derivar la escalera de «terminado»

**«Hecho / no hecho» casi nunca es la forma real**, y forzarlo es lo que hace inútiles la mayoría de los reportes de estado.

En un producto con despliegue y banderas, algo puede estar **escrito**, **construido**, **desplegado**, **encendido** y aun así **no servirle a nadie** porque la tabla que alimenta está vacía. Son cinco estados, y la distancia entre ellos es información.

**La escalera se DERIVA del proyecto, no se trae puesta.** Preguntar: ¿cuáles son los estados por los que pasa una cosa aquí, y en cuál deja de ser trabajo del equipo? Un proyecto sin banderas tendrá tres escalones; uno con proceso de aprobación, otros.

**Y hay que contar cuántas cosas hay en cada escalón.** Ese conteo es la respuesta corta del reporte.

## Paso 3 · Medir

Orden de fuentes, y el orden importa:

1. **El sistema en vivo** — la base de datos, los servicios desplegados, la pantalla.
2. **El código** — lo que hace, no lo que dice el comentario.
3. **Los documentos** — roadmap, PRD, bitácora. **Se leen para CONTRASTAR, no para copiar.**
4. **Lo que dice una persona** — se etiqueta como tal.

**Cada cifra del reporte tiene que tener procedencia.** Si no se sabe de dónde salió un número, no entra. Y si se cita una medición vieja, se dice la fecha.

> **Contar cuántos casos se miraron, no solo el resultado.** Una consulta que devuelve cero puede significar «no hay» o «pregunté mal». En este repositorio pasó las dos veces el mismo día: `gcloud functions list` devolvió cero por una región mal puesta, y una colección salió «vacía» porque el nombre era otro. **Un cero siempre se comprueba dos veces.**

## Paso 4 · Contrastar contra lo documentado

Ya con las cifras en la mano, leer el roadmap, las PRD y la bitácora, y anotar **dónde no coinciden**.

Las discrepancias se clasifican y **todas van al reporte**:

- **El documento se quedó viejo** → se dice, y se arregla el documento en la misma pasada.
- **El documento afirma algo del sistema que es falso** → es el hallazgo más valioso del reporte.
- **Lo medido no cuadra y no se sabe por qué** → se dice que no se sabe. **Nunca se elige la cifra que suena mejor.**

## Paso 5 · Clasificar los frenos por TIPO

De cada cosa que no esté terminada, decir qué la detiene **y de qué tipo es**, porque el tipo dice **quién puede quitarlo**:

| Tipo | Qué significa | Quién lo quita |
|---|---|---|
| **Código** | Falta construirlo | El equipo |
| **Dato** | Está construido y la tabla que alimenta está vacía | El cliente, o quien capture |
| **Decisión** | Está listo y nadie ha dicho que sí | El dueño del producto |
| **Externo** | Depende de un tercero, una credencial, un proveedor | Fuera del equipo |

**Esta clasificación suele ser la conclusión del reporte.** En Vivaru convirtió «doce pendientes» en «tres cosas construidas y pagadas que espera un cliente real»: una decisión de negocio, no una lista de tickets.

Si un tipo domina, **decirlo en la respuesta corta**.

## Paso 6 · Escribir — el formato estándar

Siete secciones, en este orden. Se pueden pesar distinto según el ángulo, pero **ninguna se omite salvo la 5 cuando no hay con qué comparar**.

### 1 · La respuesta corta

Las **cifras que no coinciden**, y por qué la distancia entre ellas es la respuesta. Si solo hay un número, casi siempre falta mirar.

Debajo, dos o tres frases que digan qué significa. Nunca solo los números.

### 2 · Qué significa «terminado» aquí

La escalera del Paso 2, con el conteo en cada escalón. **Explicar por qué hay escalones**, con un ejemplo del propio proyecto — sin eso, el lector cree que se le está justificando un retraso.

### 3 · El inventario, una por una

Cada cosa, **agrupada por escalón** y descrita **desde el lado del usuario**: qué problema resuelve para una persona, no qué hace el sistema.

- Nombrar por resultado, nunca por código interno. `FLOW-003` no significa nada; «que el cobro llegue y se sepa si llegó» sí.
- Un término del dominio se explica **la primera vez y con un ejemplo concreto**, no con una definición.
- Si algo no está funcionando, su freno va **en su ficha**, no en una lista aparte.

### 4 · Qué detiene cada cosa

La tabla del Paso 5. Y **el tipo que domina, señalado**.

### 5 · Antes y ahora

Dos columnas, contra el momento que fijó la pregunta 3 de la entrevista.

**La columna «antes» tiene que ser conducta REAL, verificable**, no una abstracción. «El excedente desaparecía: no quedaba saldo a favor y se contaba como ingreso» sirve; «la gestión de pagos era limitada» no dice nada y además no se puede comprobar.

### 6 · Lo que enmarca todo

El dato que **cambia cómo se lee lo anterior** — y va aunque incomode. En Vivaru: «no hay ni un cliente real». Sin esa frase, «92% construido» se lee como «casi vendible».

**Si no se sabe cuál es el dato que enmarca, el reporte no está terminado.**

### 7 · Procedencia

Qué se midió, **cuándo**, y contra qué. Una nota al pie basta.

Es lo que separa un reporte de una impresión, y lo que permite que alguien lo discuta con datos en vez de con opiniones.

### Y, si aparecieron: lo que los documentos decían y no era

Los hallazgos del Paso 4. Van en el reporte, no en un mensaje aparte.

## Lo que este reporte NUNCA hace

- **Una cifra sin procedencia.** Si no se midió y no se sabe de dónde sale, no entra.
- **Decir «terminado» de algo construido que no le sirve a nadie.** Para eso existe la escalera.
- **Usar el código interno sin traducirlo.**
- **Omitir el dato que enmarca porque no favorece.** Un reporte que solo se puede leer en una dirección no es un reporte.
- **Resolver una discrepancia eligiendo la cifra que suena mejor.** Si no cuadra, se dice que no cuadra.
- **Prometer fechas.** El estado dice dónde se está y qué falta; cuándo estará es otra conversación y la decide quien prioriza.

## Dónde entregarlo

Si va a circular, sobrevivir a la conversación o compararse con la próxima versión, **se publica como artefacto** y se entrega el enlace. Un reporte ejecutivo dentro del scrollback de una terminal no está entregado.

Si es para contestar algo puntual dentro de la conversación, va en la conversación.

---

## Anclas de Vivaru

*Esta sección es lo único específico del proyecto. Otro proyecto cambia esta tabla y conserva todo lo de arriba.*

**La escalera de Vivaru**, derivada y estable desde agosto de 2026:

`escrita` → `construida` → `desplegada` → `encendida` (bandera) → `con datos`

| Qué medir | Cómo |
|---|---|
| Especificaciones y su estado | `docs/prd/README.md` — es el índice, **se contrasta contra los ficheros de `docs/prd/funcionales/`** |
| Lo desplegado en functions | API REST de Cloud Functions con la ADC, **contando cuántas se listaron** |
| Reglas vivas | API de Firebase Rules, diferenciando el ruleset contra el fichero del repo |
| El front vivo | **Procedencia del build** de App Hosting, no `git log`. La lista de rollouts está **paginada y sin ordenar** |
| Banderas | Colección `featureFlags` **y** `featureFlagOverrides` — el override manda sobre la global |
| «Encendida pero sin datos» | Contar filas de la tabla que alimenta. Es el escalón que nadie ve venir |
| Clientes reales | `tenants` con `isExample != true` |

**Documentos que se contrastan, nunca se copian:** `docs/pendientes.md` (el más vivo), `docs/roadmap-producto.md`, `docs/prd/README.md`, la bitácora de Notion y su inventario de iniciativas.

**Tres trampas del entorno**, que si no se saben cuestan la medición entera:

1. **El repositorio no es el directorio de trabajo:** es `/Users/david/Vivaru_Rep/vivaru`.
2. **Tres credenciales caducan por separado** — `firebase login --reauth`, `gcloud auth login` y la ADC. **La ADC sirve para medirlo casi todo por API REST** y saltarse las otras.
3. **`master` no es el registro de lo desplegado salvo para el front.** Reglas y functions salen del árbol de trabajo, no de una rama.
