# Exploración de `AI-ONB-001` — qué falla hoy el mapeador determinístico

**1 de septiembre de 2026.** Es el registro de la exploración que pidió David el 31: la pregunta
no era «¿qué haría la IA?» sino **«¿qué falla hoy el mapeador determinístico?»** — sin ese suelo,
cualquier ficha se escribe sobre un supuesto (la lección de `ONB-002`, donde la regla
determinística encontró los trece duplicados y eso solo se pudo afirmar midiendo).

**Este documento es el contexto para ABRIR el frente.** La ficha (`PRD-VAI-FEAT-001`) sigue sin
escribirse **a propósito** —cero archivos de corpus— y esa premisa **aguantó la exploración**.
Lo que cambió es QUÉ ficha será cuando toque.

---

> ## EL FRENTE SE ABRIÓ, Y LOS CUATRO PUNTOS «SIN CORPUS» ESTÁN HECHOS (1 sep 2026)
>
> Lo de abajo es el registro de la exploración y **no se toca**: es lo que se midió. Esto dice
> qué se ejecutó después, para que el documento no siga pidiendo lo que ya está.
>
> 1. **Los arreglos determinísticos — HECHO** (`437f44b`). Alias `apto`/`inmueble`, `bloque` y
>    compañía como agrupación, y `cardinality` en `person.unitLabel`. **Y dos defectos que ese
>    arreglo iba a introducir, medidos antes de embarcarlos:** `cardinality` hace DOS trabajos
>    —sugerir y avisar— y declararla a secas **bloqueaba a una familia** (tres personas de la 101);
>    y el alias `apto` mapea media unidad y **pierde la torre en silencio**, con `T1-101` y `T2-101`
>    entrando las dos como «101». Lo primero se resolvió con `repeticionEsNormal`; lo segundo, con
>    un aviso que **detecta la fusión en vez de sospecharla** —dos filas con la misma etiqueta en
>    agrupaciones distintas, sobre TODAS las filas— y bloquea nombrando las dos columnas.
> 2. **La fila de encabezados — HECHO** (`437f44b`), y **en los DOS caminos**: el título sobrevive
>    a «Guardar como CSV», así que arreglar solo el XLSX dejaba el gemelo roto. La regla se salta
>    lo que tiene menos de dos celdas con texto, y si ninguna llega a dos vuelve la fila 0, que es
>    lo que mantiene vivo un archivo de una sola columna.
> 3. **La decisión de producto — TOMADA** (`7c8bb0a`): **crecen los tipos**. `parqueadero` y
>    `bodega` son tipos de unidad. Al contarlos eran **siete** los sitios donde el vocabulario
>    estaba escrito a mano, sin nada que los atara, **y ya habían derivado**: el mapa de rótulos
>    conocía `parking` y `storage` mientras el esquema los rechazaba. Ahora vive en
>    `src/lib/units/tipos.ts`.
> 4. **La captura de corpus — HECHA, y NO como decía la hoja de ruta** (`d8e4026`). Guardar copia
>    anonimizada del archivo **choca con `PRD-V-FEAT-002` §7**, que es la razón de que el
>    importador viva entero en el navegador. Decisión de David: se guarda **la FORMA** —preámbulo,
>    unidad partida, vocabulario ajeno— en la telemetría que ya existía, con dos puertas para que
>    un mapeo equivocado no la convierta en un almacén de nombres.
>
> **Lo que NO cambió, y es lo que sigue mandando:** sin corpus no hay ficha. Y de las cuatro
> clases de fallo, las que quedan son las caras — **transformaciones** (partir, unir, pivotar) y
> **formatos** (PDF y fotos, que ni cruzan la puerta del lector y de los que la captura de forma
> **no puede capturar nada**).

## Cómo se midió, y cómo repetirlo

Sonda sintética —**NO es corpus, y esa carencia sigue**— corrida contra el código real:
`suggestMapping` de `src/lib/import/field-catalog.ts` y `readTabularFile` de
`src/lib/import/read-tabular.ts`, con las tablas de valores aceptados reales de los dos
asistentes. Ocho formatos plausibles LATAM más el caso del lector.

```bash
npx tsx scripts/sondas-ai-onb-001/sonda-mapeador.ts   # los 8 formatos contra suggestMapping
npx tsx scripts/sondas-ai-onb-001/sonda-lector.ts     # la fila de título contra readTabularFile
```

Los encabezados de la sonda salen del dominio (padrones tipo Habitanto, Excel de administración
CO/MX), no de archivos reales. **Cuando haya corpus, la sonda se rehace con él** y este documento
se corrige contra lo medido de verdad.

## El suelo es más alto de lo esperado

Antes de los fallos, lo que el determinístico **resuelve solo** — y que una ficha de IA no debe
venir a rehacer: «Mail», «Móvil» (por variedad), «Calidad» (por contenido, vocabulario cerrado),
«No. Depto» (por contención), «Clase»/«Situación» (por contenido), «NOMBRE DEL PROPIETARIO»
(por contención). Los dos archivos reales del 14 de agosto están fijados en
`tests/import-field-catalog.test.ts` y pasan 5 de 6 campos.

## Las CUATRO clases de fallo, medidas

### 1 · El LECTOR, antes que el mapeador

Un XLSX con **fila de título encima de los encabezados** —la celda combinada típica de una
administración— convierte el título en encabezado y los encabezados reales en datos. Medido con
`readTabularFile` de verdad:

```
Encabezados que ve el asistente: ["PADRÓN GENERAL DE PROPIETARIOS — CONJUNTO LOS ROBLES",
                                  "(sin nombre)", "(sin nombre) (2)", …]
person.fullName ← «(sin nombre)»
person.email    ← «PADRÓN GENERAL DE PROPIETARIOS — CONJUNTO LOS ROBLES»   ← disparate con cara seria
✘ OBLIGATORIOS SIN MAPEAR: Unidad, Rol
```

Y **PDF y fotos ni cruzan la puerta**: `read-tabular.ts` solo acepta CSV/XLSX. Es exactamente el
alcance que David amplió el 30 de agosto («cualquier formato» incluye PDF y fotos, contra lo que
argumentaba `docs/hoja-de-ruta-ia.md` — la contradicción está anotada allí, no borrada).

### 2 · Transformaciones que el contrato columna→campo 1:1 no puede expresar

| Caso (sonda) | Qué pasa | Gravedad |
|---|---|---|
| P1 · «Nombres» + «Apellidos» | Mapea «Nombres» y **pierde los apellidos EN SILENCIO, con ✔ verde** | Dato mutilado sin aviso |
| P2 · «Torre» + «Apto» separados | Dos obligatorios sin mapear; **ni a mano se puede**: la unidad real es la combinación | Archivo sin salida |
| P3 · Padrón mixto estilo Habitanto (Inmueble/Coeficiente/Propietario/Estado de cuenta) | Sugerencia **EQUIVOCADA en silencio**: `Inmueble` ← nombre de la persona (variedad, empate por orden) | Mapeo falso con cara buena |
| P4 · Rol codificado en QUÉ columna está llena («Propietario(a)» / «Arrendatario(a)») | El rol no es un valor: es estructura. Sin salida, y la mitad de las personas se perdería | Archivo sin salida |
| U3 · «Torre 1 - Apto 101» en una celda | Mapea, pero torre y nombre viajan juntos: no existe partirlos | Dato sucio sin aviso |

### 3 · Vocabulario de VALORES — es producto, no IA

- **U1 · `parqueadero` / `bodega`**: el mapeo sale perfecto y el aviso **BLOQUEA el archivo
  entero** — esos tipos no existen en el catálogo de unidad (`apartment/house/office/other`).
  Un conjunto real tiene parqueaderos y bodegas como unidades. **Decisión de producto pendiente:
  ¿crece el catálogo de tipos, o se documenta «usar *otro*»?**
- **U2 · `ocupado` / `arrendado` / `desocupado`**: es OTRO eje semántico que `activo/inactivo`.
  El contenido no encaja, el estado queda sin mapear, y a mano bloquearía igual.

### 4 · Huecos baratos del propio catálogo — una tarde, sin IA

- **`person.unitLabel` no declara `cardinality`** → la pasada de variedad **nunca** puede
  rescatarla (es por lo que P2 y P3 pierden la Unidad).
- **Alias ausentes**: `apto` (unitLabel), `inmueble` (unidad). Ojo con `apto`: hoy es VALOR de
  tipo de unidad; como alias de columna va por entidad, así que no colisiona — pero comprobarlo
  al añadirlo.

## La implicación que reencuadra la ficha

El enganche previsto por escrito —la cabecera de `field-catalog.ts` nombra como tercer consumidor
«el mapeo asistido de `PRD-VAI-FEAT-001`», y la bandera `ai-onboarding-column-mapping` (hoy sin
un solo consumidor)— asiste **la elección de columnas**, que es justo lo que el determinístico
ya casi no falla.

**Una IA que solo elija columnas no toca ninguno de los cuatro fallos gordos.** La ficha, cuando
toque, es de **transformaciones** —partir/unir/pivotar, detectar dónde empiezan los encabezados—
y de **formatos** —PDF/foto → tabla intermedia que alimente el flujo tabular existente—. La
telemetría ya prevista (`encabezadosSinUsar` de `summarizeMapping`) sigue siendo el insumo
correcto, y está en 0 porque `importJobs` está en 0.

## El corpus que pedir cuando llegue un cliente

Con criterio medido, no genérico: **archivos con fila de título** (clase 1), **padrones mixtos
unidad+persona** (P3), **nombres partidos** (P1), **Torre/Apto separados** (P2), y **los PDF y
fotos tal como lleguen**. 15–25 archivos; hoy hay **cero** y no se guarda ninguno — la
recomendación vigente de `hoja-de-ruta-ia.md` es guardar copia anonimizada de cada conjunto
nuevo, con permiso.

## Lo que se puede hacer SIN corpus, si se decide abrir

**Los cuatro están HECHOS el 1 de septiembre de 2026 — ver el recuadro del principio.** Se dejan
escritos porque son el razonamiento que los ordenó, de menor a mayor decisión.

1. ~~Los arreglos determinísticos de la clase 4~~ · `437f44b`
2. ~~Detección determinística de la fila de encabezados~~ · `437f44b`, y en CSV además de XLSX
3. ~~La decisión de producto de los tipos de unidad~~ · `7c8bb0a` — crecen los tipos
4. ~~El mecanismo de captura de corpus~~ · `d8e4026` — **la forma, no el archivo**

Lo que NO se hace sin corpus: la ficha, y cualquier compra de modelo. **Esto no cambió.**

## Y la sonda ya no mide lo mismo que medía

Los números de arriba son los de ANTES. Al correrla hoy: P2 resuelve la unidad, P3 deja de
proponer el inmueble como nombre de la persona, U2 reconoce «Bloque» como torre, U1 entra sin
bloquear, y el caso del lector pasa de cinco encabezados «(sin nombre)» a los seis campos
resueltos. **La sonda lee ahora la tabla de tipos REAL y no una copia** (`06eb184`): mientras fue
copia, siguió enseñando un bloqueo que el producto ya no hacía.
