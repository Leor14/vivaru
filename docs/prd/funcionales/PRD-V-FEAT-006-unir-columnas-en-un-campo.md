# `PRD-V-FEAT-006` — Unir varias columnas del archivo en un campo de la PERSONA

| | |
|---|---|
| **Tipo** | `FEAT` — funcionalidad nueva dentro de un módulo existente |
| **Portales** | `ADMIN` (alcance). Ninguno más se ve afectado |
| **Módulo** | Residentes y unidades → **asistente de importación de residentes** |
| **Entidad** | **`person` únicamente.** `unit` queda fuera y §4 dice por qué, medido |
| **Usuario principal** | `tenant_admin` |
| **Estado** | **CONSTRUIDA Y VALIDADA EN STAGING CON OJOS** (`24b9741`, `build-2026-09-01-024`, 1 sep 2026): los diecisiete criterios, quince por prueba automática falsada y `CA7`, `CA8`, `CA13`, `CA15`, `CA16`, `CA17` vistos en pantalla con las fixtures `53`, `56`, `50` y `60`. **`registrarImportacion` ya está en producción** (`00015-jeh`, verificada por identidad del fuente) y en staging (`00018-dis`); **falta el push a `master`** · **v1.2**: construirla corrigió `CA9` y la métrica de §2 — ver §0 |
| **Dependencias** | Extiende `PRD-V-FEAT-002` (Productiva) y **enmienda su `RN-02`** |
| **Riesgo** | Bajo — transformación en el navegador, sin superficie de servidor nueva |
| **Reversibilidad** | Total. Es una revocación del front; nada queda escrito distinto salvo un campo opcional de telemetría |

---

## 0 · Por qué esta ficha existe, y qué le pasó a la v1.0

Sale de la exploración de `AI-ONB-001` (`docs/exploracion-ai-onb-001.md`), que midió que el
mapeador determinístico **casi no falla eligiendo columnas** y que lo que falla son
**transformaciones** y **formatos**. Esta es la primera mitad de las transformaciones, y es
determinística entera.

> **El argumento que la ordena: no se puede automatizar una capacidad que no existe.** Una IA que
> proponga «une Torre y Apto» no sirve de nada si el sistema no sabe expresar una unión.

> ### LA v1.0 SE ESCRIBIÓ Y SE LE CONSTRUYERON FIXTURES EL MISMO DÍA. LE ENCONTRARON SIETE HUECOS.
>
> **Cuatro verificados contra el código, no aceptados de un informe.** Se dejan escritos porque el
> valor de esta ficha no es su versión final: es que **escribir los casos antes que el código sacó
> los errores cuando corregirlos costaba una frase**.
>
> 1. **`RN-U4` se defendía con una razón FALSA.** Decía «unir dos valores de un catálogo produce un
>    valor que el catálogo no acepta». Medido en `ROLE_ALIASES`: `propietario residente` y
>    `propietario no residente` **están los dos**. La regla sobrevive; su porqué, no. Corregido en §8.
> 2. **La consecuencia declarada en §4 solo valía para la mitad del importador.** «Se verá "Unidad
>    no encontrada", visible y no silencioso» es cierto en personas y **falso en unidades**:
>    `bulkCreateUnits` crea sin buscar nada. Es una de las tres razones del recorte.
> 3. **`RN-U2` hacía imposible el caso principal de unidades** —«Torre» hace falta en el nombre
>    unido *y* en el campo torre—. **Con el recorte a `person` el conflicto desaparece**, porque
>    una persona no tiene campo de torre.
> 4. **`CA5` no distinguía la implementación buena de la mala:** fijaba solo el borde final, así que
>    un hueco EN MEDIO —el nombre mexicano de tres partes— daba dos espacios y pasaba en verde.
>    Corregido con `CA6`.
>
> Los otros tres —el separador único con tres columnas, el camino asistido que solo cubre la mitad
> que colisiona, y la ausencia de detección en unidades— están resueltos por el recorte o
> declarados como límite en §4.

> ### Y CONSTRUIRLA (v1.2, 1 sep 2026) ENCONTRÓ UNA COSA FALSA EN LA v1.1
>
> **`CA9` decía que la telemetría de `inicio` lleva `camposUnidos`, y la fixture 51 prometía
> «`camposUnidos = 1` en inicio». Es imposible por construcción:** la fila de `inicio` se escribe
> con el mapeo **sugerido**, antes de que la persona toque nada, y `RN-U3` prohíbe que la sugerencia
> una. En `inicio` el número es **0 siempre**; la medida del estreno vive en **`fin`**. Se corrige
> `CA9` y la métrica de §2: **con dos fases no se puede medir «de las que unieron, cuántas
> terminaron»**, porque unir ocurre entre las dos. Lo que sí se mide es «de las que terminaron,
> cuántas unieron». Medir el abandono tras unir pediría una tercera fase al pulsar «Continuar», y
> **es una decisión de producto, no de esta ficha** — queda en Fase 2.
>
> Lo demás se construyó como estaba escrito. Tres cosas que la ficha no decía y el código sí:
> las guardas de `RN-U2`, `RN-U4`/`RN-U8` y `RN-U7` **bloquean en `mappingIssues`** además de no
> ofrecerse en pantalla, porque una pantalla es solo un botón; la oferta de unir sale en los **dos
> niveles** del aviso (bloqueo y duda), no solo en el que bloquea; y en una unión basta con que
> **una** columna se parezca al campo para no disparar el aviso de «elegida sin evidencia».

---

## 1 · Resumen ejecutivo

Un padrón de residentes con el nombre partido en «Nombres» + «Apellidos», o con la unidad partida
en «Torre» + «Apto», **no tiene entrada hoy** — ni automática ni a mano, porque el mapeo es de una
columna a un campo. El asistente de residentes pasa a aceptar **varias columnas para un mismo
campo**, unidas con un separador que elige la persona. El valor esperado es quitar la primera
barrera del primer día: hoy el producto solo sabe responder «júntalas en Excel antes de importar».

## 2 · Problema y baseline

**Cómo se resuelve hoy: no se resuelve.** Medido con archivos construidos
(`scripts/simulacion-de-cargas/`, casos `50`–`57`):

| Caso | Fixture | Qué pasa hoy |
|---|---|---|
| «Nombres» + «Apellidos» | `50` | Entra con **medio nombre**; el aviso solo dice «1 columna sin usar» |
| Nombre en tres columnas (MX) | `51` | Entra con el nombre de pila; dos columnas al descarte |
| Nombre en cuatro columnas (CO) | `57` | **Se pierden tres de las cuatro**, con el veredicto más inocuo del lote |
| «Apellidos» antes que «Nombres» | `52` | El orden del archivo no puede ser el orden de la unión |
| Torre + Apto **que colisionan** | `53`, `54` | **Bloquea** nombrando las dos columnas y pide unirlas en el archivo |
| Torre + Apto **que no colisionan** | `55` | Entra con la unidad a medias y **sin un solo aviso** |
| Torre sin prefijo (`1` + `101`) | `56` | Bloquea; y unir daría `1-101`, no `T1-101` — ver §4 |

**Baseline de volumen, y es un problema para `G1`:** `importRuns` está **vacío en producción — 0
filas** (medido el 1 sep 2026). Nadie ha usado nunca el importador allí, y producción no tiene
clientes reales. **No hay con qué medir adopción hoy**, y decirlo es parte de la ficha.

**Métrica de éxito** (`CA-13` de `FEAT-002` ya instrumenta el conducto): de las importaciones que
llegan a `fase: "fin"`, qué proporción lleva `camposUnidos > 0` — es decir, **cuántas necesitaron
unir**. *(v1.2: decía «de las que unieron, cuántas terminan», y eso no se puede medir con dos
fases — ver §0.)*

> **Y una señal que NO sirve como prueba de adopción, para no leerla mal:** «`encabezadosSinUsar`
> deja de listar columnas de apellido». Un mapeo equivocado consume columnas, así que esa lista
> **baja también cuando las cosas van peor**. Medido el 1 de septiembre.

## 3 · Usuarios, roles y permisos

| Rol | Ve | Puede | **NO puede** |
|---|---|---|---|
| `tenant_admin` | El paso de columnas del asistente de **residentes** con la opción de añadir otra columna | Unir varias columnas en un campo y elegir el separador | Unir campos de vocabulario cerrado (`person.role`). Unir nada en el asistente de **unidades** |
| `resident` · `security_guard` | Nada | Nada | Abrir el importador. Sin cambio |
| `superadmin` | Nada nuevo | Nada nuevo | — |

**No cambia ningún permiso.** El importador ya es solo del administrador y vive tras
`producto-importacion-masiva`.

## 4 · Objetivo, alcance y exclusiones

**Objetivo:** que un padrón de residentes con un dato repartido en varias columnas entre sin
editarlo fuera.

**Entra:**

1. Asignar **una o más** columnas a un campo de `person`, en el orden en que la persona las añade.
2. Elegir cómo se unen: **espacio, guion, sin separador, o un texto corto propio**.
3. La muestra bajo el campo enseña **el resultado unido**, no la columna cruda.
4. Ofrecer la unión donde el sistema **ya avisa** de que la unidad viene partida.
5. Registrar en la telemetría **cuántos campos se unieron**.

### Por qué la entidad `unit` queda FUERA, y son tres razones medidas

No es un aplazamiento por tamaño: **es otro problema**. En una persona el valor unido es una
**referencia** —se compara contra las unidades que ya existen—; en una unidad **es la identidad**.

1. **Un empalme equivocado no se ve.** `bulkCreateUnits` (`src/features/admin/services.ts:522`)
   **crea sin buscar nada**, y deriva `unitId` del `displayName`. Un archivo con el prefijo
   equivocado **siembra un padrón paralelo en silencio** — y `units` es una colección raíz cuyos
   ids son globales (`PRD-V-FIX-002`). En personas, la misma equivocación sale como «Unidad no
   encontrada» y se ve.
2. **`RN-U2` choca de frente.** Para nombrar `T1-101` hay que unir «Torre» + «Número», y «Torre»
   hace falta **a la vez** en el campo «Torre o agrupación». Una persona no tiene campo de torre,
   así que ahí no hay conflicto.
3. **No existe detección de unidad partida en el lado de unidades.** El guardián de `field-catalog`
   cuelga de `person.unitLabel` a propósito. Hoy esos archivos salen «✘ FALTAN: Nombre de la
   unidad» **sin decir por qué**, delante de un archivo que lo trae en dos columnas.

Las fixtures del caso de unidades **están escritas y se conservan** (`60`–`62`, `65`, `67`): son la
línea base del día que se aborde.

**Tampoco entra, y por qué:**

- **PARTIR una celda** («Torre 1 - Apto 101» → dos campos). El caso raro de los dos, y arrastra
  decidir dónde corta. Fase 2.
- **Prefijos y plantillas** (`T{Torre}-{Apto}`). El MVP une valores tal como vienen: Torre «1» +
  Apto «101» da **`1-101`**, no `T1-101` (fixture `56`). **Consecuencia declarada:** si las
  unidades del conjunto llevan un prefijo que el archivo no trae, esas filas saldrán «Unidad no
  encontrada» —correcto y visible— y habrá que editar el archivo. Resolverlo pide un lenguaje de
  plantillas: Fase 2, con un caso real delante.
- **Un separador distinto por par.** Con dos columnas no se nota; con tres, `A` + `1` + `01` solo
  puede dar `A-1-01` o `A101`, nunca `A-101`. **Es un límite conocido**, y en los nombres —que son
  el caso frecuente de `person`— el separador único es exactamente lo que hace falta.
- **Detectar la unidad partida cuando NO colisiona** (fixture `55`). Hoy no hay aviso ahí, así que
  tampoco hay dónde colgar la oferta. La fila entra con la etiqueta corta y, si no casa con
  ninguna unidad, se ve. Ampliar la detección es Fase 2.
- **Unir columnas de vocabulario cerrado.** Prohibido por regla, no por omisión — ver `RN-U4`.
- **Adivinar la unión y aplicarla sola.** Ver `RN-U3`.

## 5 · Flujo funcional

1. La persona sube el archivo y llega al paso de columnas, igual que hoy.
2. Cada campo de `person` que lo admita enseña su columna asignada y **«＋ añadir otra columna»**.
3. Al añadir la segunda aparece el selector de separador, con **espacio** por defecto.
4. La muestra bajo el campo pasa a enseñar el valor unido de las primeras filas.
5. Se puede reordenar y quitar columnas. Al quedar una sola, el separador desaparece.
6. **Camino asistido:** cuando el mapeo ya avisa de que la unidad viene partida —hoy en dos
   niveles, *bloquea* si el nombre de la columna lo dice y *duda* si solo lo dice la forma de los
   datos— el aviso pasa a ofrecer «unir «Torre» y «Apto»». Aceptar la deja aplicada; **ignorarla
   mantiene el aviso tal cual estaba**, porque el archivo no ha cambiado.
7. El resto del asistente —revisión, duplicados, importación— no cambia.

**Errores y casos límite:**

| Caso | Conducta |
|---|---|
| Una de las columnas está vacía en una fila | **La parte se omite entera**, esté al principio, en medio o al final: «Camilo» + «» + «Bustamante» da `Camilo Bustamante`, con **un** espacio |
| Todas vacías | El campo queda vacío y aplican las validaciones de siempre (`RN-03` de `FEAT-002`) |
| La unión produce una etiqueta que no casa con ninguna unidad | Fila con «Unidad no encontrada», no importable. `RN-06` sin cambios |
| La persona une y luego cambia de hoja | Se vuelve a proponer el mapeo desde cero, como hoy |

## 6 · Estados y transiciones

**No los hay, y decirlo evita inventarlos.** El asistente es un flujo de pantalla sin estado
persistido: nada se guarda entre sesiones y no hay nada a medias que alguien tenga que operar. Lo
único que se escribe es la fila de telemetría de `FEAT-002`, que ya nace terminal.

## 7 · Contrato de datos y multi-tenancy

**Ninguna colección nueva. Ningún campo nuevo en `people`** — se escribe el mismo `fullName` de
siempre, con otro valor dentro.

Un solo campo añadido, opcional, en `importRuns`:

| Campo | Tipo | Quién escribe | Obligatorio |
|---|---|---|---|
| `camposUnidos` | entero ≥ 0 | El servidor, desde `registrarImportacion` | No |

**Invariantes respetados:** `importRuns` ya lleva `tenantId` y lo comprueba el servidor contra la
membresía. No se añade ninguna consulta de lista nueva. **Ni una celda del archivo viaja** — se
guarda un número, no lo unido.

**Conjunto suspendido o vencido:** `RN-10` de `FEAT-002` ya impide importar, sin excepción.
**Conjunto en prueba:** sin cambio.

## 8 · Reglas de negocio

| Regla | Enunciado |
|---|---|
| `RN-U1` | Un campo de `person` admite **una o más** columnas, en el orden en que la persona las añadió |
| `RN-U2` | Una misma columna **no puede alimentar dos campos** distintos. Es la mitad de `RN-02` que sigue viva |
| `RN-U3` | **La sugerencia automática nunca asigna más de una columna a un campo.** Unir es siempre un acto explícito |
| `RN-U4` | Un campo de **vocabulario cerrado** (`person.role`) no admite unión: la opción no se ofrece |
| `RN-U5` | **Una parte vacía se omite entera**, en cualquier posición, y el separador no aparece por ella |
| `RN-U6` | El separador aplica igual entre todas las partes; no hay separador por par |
| `RN-U7` | Un separador propio admite como mucho **5 caracteres** |
| `RN-U8` | El asistente de **unidades** no ofrece unir. §4 dice por qué |

> **El porqué de `RN-U4`, corregido — y la v1.0 lo tenía mal.** Decía que unir dos valores produce
> un valor fuera del catálogo. **Es falso donde más se nota:** `ROLE_ALIASES` contiene
> `propietario residente` y `propietario no residente` como alias de dos palabras, puestos para
> esa forma exacta. Unir «Propietario» + «Residente» daría un valor **válido**.
>
> **La razón verdadera es otra, y es más fuerte:** el rol se resuelve por **contenido**, no por el
> nombre de la columna —la pasada 2 de `suggestMapping`—, así que si el vocabulario ya reconoce la
> forma unida, **no hace falta unir nada**: basta con mapear la columna que lo contenga. Y si no la
> reconoce (`arrendatario residente` no es alias), unir fabrica un valor que el catálogo rechaza
> **y el aviso de contenido lo dirá tarde**. En los dos casos, unir no aporta y puede dañar.

> **Enmienda explícita a `PRD-V-FEAT-002`.** Su `RN-02` dice «dos columnas no pueden mapearse al
> mismo campo destino». **Esta ficha lo revoca en esa dirección para `person`** y conserva la otra
> (`RN-U2`). `RN-02` existía para resolver ambigüedad cuando la máquina proponía; con `RN-U3`,
> unir solo ocurre porque alguien lo pidió. **Hay que actualizar `RN-02` en `FEAT-002` al construir
> esto**, no dejar las dos fichas diciendo lo contrario.

## 9 · Notificaciones y correo

**Ninguna.** Nada de esto notifica ni envía correo. `CA-14` de `FEAT-002` —importar no manda ni un
correo— sigue vigente.

## 10 · Criterios de aceptación

Cada uno nombra su fixture cuando la tiene: el archivo ya existe y hoy mide la línea base.

| # | Criterio | Fixture | Debe |
|---|---|---|---|
| `CA1` | «Nombres» + «Apellidos» unidas por espacio dan «Ana María Pérez Ruiz» | `50` | pasar |
| `CA2` | «Torre» + «Apto» unidas por guion dan `T1-101`, y el bloqueo se levanta | `53` | pasar |
| `CA3` | Tres columnas de nombre (MX) se unen en el orden en que se añadieron | `51` | pasar |
| `CA4` | «Apellidos» añadida DESPUÉS de «Nombres» produce «Ana Pérez», no «Pérez Ana» | `52` | pasar |
| `CA5` | Una fila con la última columna vacía da «Ana», sin espacio final | `57` | pasar |
| `CA6` | **Una fila con la columna de EN MEDIO vacía da «Camilo Bustamante», con UN espacio** | `57` | pasar |
| `CA7` | La muestra bajo el campo enseña el valor **unido**, no el de la primera columna | `50` | pasar |
| `CA8` | Quitar una columna deja el campo con la restante y desaparece el selector de separador | — | pasar |
| `CA9` | La telemetría lleva `camposUnidos` con el número de campos con más de una columna: **0 en `inicio` por construcción**, el real en `fin` | `51` | pasar |
| `CA10` | El aviso de unidad partida ofrece unir, y aceptarlo levanta el bloqueo | `53`, `54` | pasar |
| `CA11` | Ignorar la oferta deja el aviso como estaba | `53` | pasar |
| `CA12` | Un mapeo recién sugerido, sin tocar, **nunca trae un campo con dos columnas** | `66` | pasar |
| `CA13` | «Rol» **no ofrece** añadir otra columna | `64` | **fallar** el intento |
| `CA14` | Una columna ya usada en un campo **no se puede elegir** en otro | `65` | **fallar** el intento |
| `CA15` | Un separador propio de más de 5 caracteres **no se acepta** | — | **fallar** el intento |
| `CA16` | Unir dos columnas que dan una etiqueta inexistente deja la fila «Unidad no encontrada» y **no importable** | `56` | **fallar** esa fila |
| `CA17` | **El asistente de UNIDADES no ofrece unir en ningún campo** | `60` | **fallar** el intento |

## 11 · Arquitectura y dependencias

**Decisión obligatoria — cliente directo o callable: CLIENTE, sin superficie de servidor nueva.**
La unión es una transformación de lectura del archivo, que ya vive entero en el navegador
(`PRD-V-FEAT-002` §7). No hay lógica que el cliente pueda falsificar: lo que resulta se escribe por
los mismos caminos, con las mismas reglas y validaciones. Una callable aquí añadiría superficie sin
ganar un invariante — **y crearía la que sí importa evitar: una que reciba el contenido del archivo**.

**El contrato del mapeo cambia**, y es el único cambio estructural:

```
Antes:  Record<string, string | null>
Ahora:  Record<string, { headers: string[]; separador: string } | null>
```

**El contrato es compartido por los dos asistentes, así que los dos se tocan; la CAPACIDAD se
ofrece solo en el de residentes.** En el de unidades el mapeo pasa a la forma nueva con exactamente
una columna por campo, y no aparece «añadir otra» (`RN-U8`, `CA17`).

Lo consumen, y hay que tocarlos todos a la vez: `suggestMapping`, `valueFor`, `mappingIssues`,
`summarizeMapping`, `formaDelArchivo`, `pickBestSheet` (`src/lib/import/field-catalog.ts`),
`ColumnMappingStep.tsx` y el `buildRows` de los dos asistentes.

**El detector ya está construido y en producción** (1 sep 2026): `candidataDeAgrupacion` y
`unidadesQueSeFunden` reconocen la unidad partida en dos niveles. Hoy alimentan los avisos; con
esta ficha alimentan además la oferta. **No hay que detectar nada nuevo.**

**Qué se declara en el catálogo:** por campo, si admite unión. `person.role`, no (`RN-U4`).

**Sin bandera nueva, y es una decisión.** Vive dentro de `producto-importacion-masiva`, que ya
gobierna las dos entradas. El cambio es aditivo, **no puede dispararse sin un acto explícito**, y
el rollback es una revocación del front. Una bandera costaría tocar los **cinco** sitios del
catálogo para gobernar algo ya gobernado.

**Sin índices, sin jobs, sin reglas nuevas.**

## 12 · Riesgos y mitigaciones

| Riesgo | Señal que lo detecta | Mitigación |
|---|---|---|
| El contrato del mapeo se toca en ocho sitios y alguno queda con la forma vieja | Typecheck: es un cambio de tipo | El compilador obliga en los ocho |
| La unión produce etiquetas que no casan y se lee como «el importador no funciona» | Filas «Unidad no encontrada» en la revisión | Declarado en §4; el mensaje nombra la unidad |
| **Alguien pide unir en el asistente de unidades y sembramos un padrón paralelo** | Ninguna: `bulkCreateUnits` no busca nada | **`RN-U8`: no se ofrece.** Es la razón principal del recorte |
| Se une el nombre en orden invertido («Pérez Ana») | La muestra en pantalla | `CA4` y `CA7`: la muestra enseña lo unido |
| Un hueco en medio deja dos espacios y nadie lo ve | — | `CA6`, que existe porque `CA5` no podía distinguirlo |

## 13 · Despliegue, rollback y Story Map

**Orden: functions → front.** Solo `camposUnidos` vive en `registrarImportacion`; el servidor viejo
ignoraría el campo en silencio y se perdería la medida del estreno.

**Rollback:** revocar el front. Nada persistido cambia de forma y `camposUnidos` es opcional.

**Se valida en staging:** los diecisiete criterios contra sus fixtures, que ya existen y se
construyen con `npx tsx scripts/simulacion-de-cargas/construir.ts`. **Solo en producción:** nada.

**Cómo quedó repartida la verificación (v1.2):** quince criterios tienen prueba automática en
`tests/import-unir-columnas.test.ts`, sobre las fixtures construidas en memoria y leídas por el
camino real; **falsadas con siete mutaciones** del catálogo, cada una cazada por el criterio que
debía. Los que viven en React se miran en pantalla: `CA7` (la muestra unida), `CA8` (quitar una
columna esconde el separador) y la mitad de `CA16` («Unidad no encontrada» en la revisión). El
banco de cargas (`correr.ts`) aplica además la unión declarada en `50`–`57`: los ocho pasan de
bloquear o perder columnas a **«entra limpio · camposUnidos=1»**.

**Visto en staging el 1 de septiembre**, con la sesión de administrador de David sobre el conjunto
de ejemplo que tiene `T1-101`…`T2-201`: la fixture `53` bloquea, el botón «Unir «Torre» y «Apto»»
deja las dos columnas con guion, la muestra pasa a `T1-101, T1-102, T1-201`, el bloqueo desaparece
y la revisión da **6 válidas** con las seis unidades encontradas. Quitar «Apto» esconde el
separador y deja «Torre» sola; «↑» invierte el orden y la muestra enseña `101-T1`; «Otro…» con seis
caracteres deja cinco. La fixture `56` une a `1-101` y la revisión dice **«Unidad no encontrada:
"1-101"»** en las seis, ninguna seleccionable. La `50` une «Nombres» + «Apellidos» por espacio y la
muestra dice «Ana María Pérez Ruiz». La `60` en el asistente de unidades no enseña ni «añadir
otra columna», ni «Unir con», ni botón alguno de unir. **Rol** nunca ofrece añadir.

**Un borde que se vio y no está en los criterios:** si la persona quita la columna equivocada
—deja «Torre» sola como unidad—, el detector por forma toma «Apto» por la agrupación y ofrece
«Unir «Apto» y «Torre»», que daría `101-T1`. Es una duda, no un bloqueo, y la muestra unida lo
delata al aceptarla; no se cambió nada porque el estado nace de un error de la persona y la
mitigación de §12 ya lo cubre. Queda anotado por si un día se convierte en queja.

**MVP:** §4 «entra», los diecisiete criterios.
**Fase 2:** la entidad `unit` (con sus fixtures ya escritas) · partir una celda · plantillas con
prefijo · separador por par · detectar la unidad partida sin colisión.

## 14 · Puertas

| Puerta | Estado |
|---|---|
| `G0` Necesidad | ✅ Medida con archivos construidos, no supuesta |
| `G1` Valor | ⚠️ **NO superada.** La métrica está definida y **no hay tráfico contra el que leerla**: `importRuns` = 0 en producción |
| `G2` Datos y permisos | ✅ Sin colección nueva, sin permiso nuevo, un campo opcional de telemetría |
| `G3` Riesgo | ✅ Reversible por revocación; nada irreversible |
| `G4` Aceptación | ✅ Diecisiete criterios, cinco de fallo, doce con fixture que ya existe |
| `G5` Operación | ✅ Lo opera el mismo administrador que hoy importa |
| `G6` Escala | ✅ Una concatenación por fila dentro del tope de 5.000 de `RN-08` |

> **`G1` es la única abierta, y no la cierra construir: la cierra un cliente.** Está **lista para
> desarrollo** (`G0`–`G3`); **no** podrá marcarse productiva hasta que alguien importe de verdad.

## 15 · Lo que hay que corregir en `PRD-V-FEAT-002` al construir esto

1. **`RN-02`** — reescribirla como `RN-U2`: una columna no alimenta dos campos. La dirección
   contraria queda permitida por acto explícito, y solo en `person`.
2. **`CA-13`** — añadir `camposUnidos` a lo instrumentado.

## 16 · Las fixtures

Viven en `scripts/simulacion-de-cargas/casos/` y **cada una lleva dos expectativas**: `queDeberiaPasar`
(lo medido HOY, que es la línea base) y `conFeat006` (lo que debería pasar cuando esto exista). El
mismo fichero sirve de antes y de criterio de después.

```bash
npx tsx scripts/simulacion-de-cargas/construir.ts   # especificación → archivo real
npx tsx scripts/simulacion-de-cargas/correr.ts      # archivo → qué ve el asistente
```

`50`–`57` son de `person` y sostienen el MVP. `60`–`67` son de `unit` y de los casos que deben
fallar: **se conservan aunque `unit` esté fuera de alcance**, porque son la línea base del día que
se aborde y ya costaron encontrarse.
