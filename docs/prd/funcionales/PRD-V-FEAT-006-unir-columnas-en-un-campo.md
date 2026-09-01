# `PRD-V-FEAT-006` — Unir varias columnas del archivo en un campo

| | |
|---|---|
| **Tipo** | `FEAT` — funcionalidad nueva dentro de un módulo existente |
| **Portales** | `ADMIN` (alcance). Ninguno más se ve afectado |
| **Módulo** | Residentes y unidades → asistentes de importación |
| **Usuario principal** | `tenant_admin` |
| **Usuarios secundarios** | Ninguno |
| **Estado** | `Lista para PRD` |
| **Dependencias** | Extiende `PRD-V-FEAT-002` (Productiva) y **enmienda su `RN-02`** |
| **Riesgo** | Bajo — transformación en el navegador, sin superficie de servidor nueva |
| **Reversibilidad** | Total. Es una revocación del front; nada queda escrito distinto salvo un campo opcional de telemetría |
| **Fase / plan** | MVP en el plan actual. No condicionada a plan comercial |

---

## 0 · Por qué esta ficha existe, y por qué no lleva IA

Sale de la exploración de `AI-ONB-001` (1 sep 2026, `docs/exploracion-ai-onb-001.md`). Aquella
midió que el mapeador determinístico **casi no falla eligiendo columnas** y que lo que falla son
**transformaciones** y **formatos**. Esta ficha es la primera mitad de las transformaciones, y es
determinística entera.

> **El argumento que la ordena: no se puede automatizar una capacidad que no existe.** Una IA que
> proponga «une Torre y Apto» no sirve de nada si el sistema no sabe expresar una unión. Esta
> ficha construye la capacidad; sugerirla mejor es otro trabajo, y probablemente tampoco necesita
> modelo.

---

## 1 · Resumen ejecutivo

Un padrón con el nombre partido en «Nombres» + «Apellidos», o con la unidad partida en «Torre» +
«Apto», **no tiene entrada hoy** — ni automática ni a mano, porque el mapeo es de una columna a un
campo. El asistente pasa a aceptar **varias columnas para un mismo campo**, unidas con un
separador que elige la persona. El valor esperado es quitar la primera barrera del primer día: hoy
el producto solo sabe responder «júntalas en Excel antes de importar».

## 2 · Problema y baseline

**Cómo se resuelve hoy:** no se resuelve. Medido contra el código real con
`scripts/sondas-ai-onb-001/sonda-mapeador.ts`:

| Caso | Qué pasa hoy |
|---|---|
| «Nombres» + «Apellidos» | Mapea «Nombres» y **pierde los apellidos en silencio, con ✔ verde** |
| «Torre» + «Apto» | Mapea «Apto». Desde el 1 sep, si dos torres repiten número, **bloquea** nombrando las dos columnas y pide unirlas **en el archivo** |

**Baseline de volumen, y es un problema para `G1`:** `importRuns` está **vacío en producción — 0
filas** (medido el 1 sep 2026). Nadie ha usado nunca el importador allí, y producción no tiene
clientes reales. **No hay con qué medir adopción hoy**, y decirlo es parte de la ficha: la métrica
queda definida y su lectura, aplazada al primer conjunto real.

**Métrica de éxito** (`CA-13` de `FEAT-002` ya instrumenta el conducto): de las importaciones con
`camposUnidos > 0`, qué proporción llega a `fase: "fin"`. Y como señal cualitativa,
`encabezadosSinUsar` deja de listar columnas de apellido y de torre.

## 3 · Usuarios, roles y permisos

| Rol | Ve | Puede | **NO puede** |
|---|---|---|---|
| `tenant_admin` | El paso de columnas con la opción de añadir otra columna | Unir varias columnas en un campo y elegir el separador | Unir campos de vocabulario cerrado (`unit.type`, `unit.status`, `person.role`) |
| `resident` | Nada | Nada | Abrir el importador. Sin cambio |
| `security_guard` | Nada | Nada | Abrir el importador. Sin cambio |
| `superadmin` | Nada nuevo | Nada nuevo | — |

**No cambia ningún permiso.** El importador ya es solo del administrador y vive tras
`producto-importacion-masiva`.

## 4 · Objetivo, alcance y exclusiones

**Objetivo:** que un archivo con un dato repartido en varias columnas entre sin editarlo fuera.

**Entra:**

1. Asignar **una o más** columnas a un campo destino, en orden.
2. Elegir cómo se unen: **espacio, guion, sin separador, o un texto corto propio**.
3. La muestra bajo el campo enseña **el resultado unido**, no la columna cruda.
4. Ofrecer la unión cuando el sistema ya detecta el caso (unidad partida).
5. Registrar en la telemetría **cuántos campos se unieron**.

**No entra, y por qué:**

- **PARTIR una celda** («Torre 1 - Apto 101» → dos campos). Es el caso raro de los dos y arrastra
  decidir dónde corta. Fase 2.
- **Prefijos y plantillas** (`T{Torre}-{Apto}`). El MVP une valores tal como vienen: Torre «1» +
  Apto «101» da **`1-101`**, no `T1-101`. **Consecuencia declarada:** si las unidades del conjunto
  llevan un prefijo que el archivo no trae, la persona verá «Unidad no encontrada» en esas filas
  —comportamiento correcto y visible, no silencioso— y tendrá que editar el archivo. Es una
  plantilla lo que resolvería eso, y una plantilla es un lenguaje: Fase 2, con un caso real
  delante.
- **Unir columnas de vocabulario cerrado.** Unir dos valores de un catálogo produce un valor que el
  catálogo no acepta. Prohibido por regla, no por omisión.
- **Adivinar la unión y aplicarla sola.** Ver `RN-U3`.

## 5 · Flujo funcional

1. La persona sube el archivo y llega al paso de columnas, igual que hoy.
2. Cada campo destino enseña su columna asignada y, si el campo lo admite, **«＋ añadir otra
   columna»**.
3. Al añadir la segunda aparece el selector de separador, con **espacio** por defecto.
4. La muestra bajo el campo pasa a enseñar el valor unido de las primeras filas.
5. Se puede reordenar y quitar columnas. Al quedar una sola, el separador desaparece.
6. **Camino asistido:** cuando el sistema detecta la unidad partida —hoy eso **bloquea**— el aviso
   pasa a ofrecer «unir «Torre» y «Apto»». Aceptar la deja aplicada; **ignorarla mantiene el
   bloqueo**, porque el archivo sigue fundiendo dos unidades.
7. El resto del asistente —revisión, duplicados, importación— no cambia.

**Errores y casos límite:**

| Caso | Conducta |
|---|---|
| Una de las columnas está vacía en una fila | Se omite esa parte y **no se deja separador colgando**: «Ana» + «» da `Ana`, no `Ana ` |
| Todas vacías | El campo queda vacío y aplican las validaciones de siempre (`RN-03`) |
| La unión produce una etiqueta que no casa con ninguna unidad | Fila con «Unidad no encontrada», no importable. `RN-06` sin cambios |
| La persona une y luego cambia de hoja | Se vuelve a proponer el mapeo desde cero, como hoy |

## 6 · Estados y transiciones

**No los hay, y decirlo evita inventarlos.** El asistente es un flujo de pantalla sin estado
persistido: nada de esto se guarda entre sesiones y no hay nada que quede a medias que alguien
tenga que operar. Lo único que se escribe es la fila de telemetría de `FEAT-002`, que ya nace
terminal.

## 7 · Contrato de datos y multi-tenancy

**Ninguna colección nueva. Ningún campo nuevo en `people` ni en `units`** — lo que se escribe es el
mismo `fullName` o `displayName` de siempre, con otro valor dentro.

Un solo campo añadido, opcional, en `importRuns` (`PRD-V-FEAT-002` `CA-13`):

| Campo | Tipo | Quién escribe | Obligatorio |
|---|---|---|---|
| `camposUnidos` | entero ≥ 0 | El servidor, desde la callable `registrarImportacion` | No |

**Invariantes respetados:** `importRuns` ya lleva `tenantId` y lo comprueba el servidor contra la
membresía. No se añade ninguna consulta de lista nueva, así que no hay riesgo de consulta sin
filtrar. **Ni una celda del archivo viaja** — se guarda un número, no lo unido.

**Retención y borrado:** la de `importRuns`, sin cambio.

**Conjunto suspendido o vencido:** `RN-10` de `FEAT-002` ya impide importar. Sin excepción.
**Conjunto en prueba:** sin cambio; el asistente ya se comporta igual y la pista viaja en la
telemetría.

## 8 · Reglas de negocio

| Regla | Enunciado |
|---|---|
| `RN-U1` | Un campo destino admite **una o más** columnas, en el orden en que la persona las añadió |
| `RN-U2` | Una misma columna **no puede alimentar dos campos** distintos. Es la mitad de `RN-02` que sigue viva |
| `RN-U3` | **La sugerencia automática nunca asigna más de una columna a un campo.** Unir es siempre un acto explícito de la persona |
| `RN-U4` | Un campo de **vocabulario cerrado** no admite unión: la opción no se ofrece |
| `RN-U5` | Las partes vacías se omiten al unir, y el separador no queda colgando en los bordes |
| `RN-U6` | El separador aplica igual entre todas las partes; no hay separador por par |
| `RN-U7` | Un separador propio admite como mucho **5 caracteres** |
| `RN-U8` | El aviso que hoy **bloquea** por unidad partida sigue bloqueando mientras la unión no se aplique |

> **Enmienda explícita a `PRD-V-FEAT-002`.** Su `RN-02` dice «dos columnas no pueden mapearse al
> mismo campo destino». **Esta ficha lo revoca en esa dirección** y conserva la otra (`RN-U2`).
> `RN-02` existía para resolver ambigüedad cuando la máquina proponía; con `RN-U3`, unir solo
> ocurre porque alguien lo pidió, así que no hay ambigüedad que resolver. **Hay que actualizar
> `RN-02` en `FEAT-002` al construir esto**, no dejar las dos fichas diciendo lo contrario.

## 9 · Notificaciones y correo

**Ninguna.** Nada de esto notifica a nadie ni envía correo. `CA-14` de `FEAT-002` —importar no
manda ni un correo— sigue vigente y esta ficha no lo toca.

## 10 · Criterios de aceptación

| # | Criterio | Debe |
|---|---|---|
| `CA1` | Con «Nombres» y «Apellidos» unidas por espacio, la revisión enseña «Ana María Pérez Ruiz» y la persona entra con ese nombre completo | pasar |
| `CA2` | Con «Torre» y «Apto» unidas por guion, la unidad de la persona queda `1-101` | pasar |
| `CA3` | La muestra bajo el campo enseña el valor **unido**, no el de la primera columna | pasar |
| `CA4` | Quitar una columna deja el campo con la restante y **desaparece el selector de separador** | pasar |
| `CA5` | Una fila con la segunda columna vacía da «Ana», sin espacio final | pasar |
| `CA6` | La telemetría de `inicio` lleva `camposUnidos` con el número de campos con más de una columna | pasar |
| `CA7` | El aviso de unidad partida ofrece unir, y **aceptarlo levanta el bloqueo** | pasar |
| `CA8` | **Ignorar la oferta mantiene el bloqueo**: el archivo sigue fundiendo dos unidades | pasar |
| `CA9` | Un mapeo recién sugerido, sin tocar, **nunca trae un campo con dos columnas** | pasar |
| `CA10` | «Tipo de unidad», «Estado» y «Rol» **no ofrecen añadir otra columna** | **fallar** el intento |
| `CA11` | Una columna ya usada en un campo **no se puede elegir** en otro | **fallar** el intento |
| `CA12` | Un separador propio de más de 5 caracteres **no se acepta** | **fallar** el intento |
| `CA13` | Unir dos columnas que dan una etiqueta inexistente deja la fila con «Unidad no encontrada» y **no importable** | **fallar** la importación de esa fila |

## 11 · Arquitectura y dependencias

**Decisión obligatoria — cliente directo o callable: CLIENTE, sin superficie de servidor nueva.**
La unión es una transformación de lectura del archivo, que ya vive entero en el navegador
(`PRD-V-FEAT-002` §7). No hay lógica de negocio que el cliente pueda falsificar: lo que resulta se
escribe por los mismos caminos de siempre, con las mismas reglas y las mismas validaciones. Poner
una callable aquí añadiría una superficie sin ganar un solo invariante — **y crearía la que sí
importa evitar: una que reciba el contenido del archivo**.

**El contrato del mapeo cambia**, y es el único cambio estructural:

```
Antes:  Record<string, string | null>
Ahora:  Record<string, { headers: string[]; separador: string } | null>
```

Lo consumen, y hay que tocarlos todos a la vez: `suggestMapping`, `valueFor`, `mappingIssues`,
`summarizeMapping`, `formaDelArchivo`, `pickBestSheet` (`src/lib/import/field-catalog.ts`),
`ColumnMappingStep.tsx` y el `buildRows` de los dos asistentes.

**El detector ya está construido y en producción** (1 sep 2026): `agrupacionSinUsar` y
`unidadesQueSeFunden` reconocen la unidad partida. Hoy alimentan un aviso que bloquea; con esta
ficha alimentan además la oferta. **No hay que detectar nada nuevo.**

**Qué se declara en el catálogo:** por campo, si admite unión. Los de vocabulario cerrado, no
(`RN-U4`).

**Sin bandera nueva, y es una decisión.** Vive dentro de `producto-importacion-masiva`, que ya
gobierna las dos entradas. El cambio es aditivo, **no puede dispararse sin un acto explícito** de
la persona, y el rollback es una revocación del front. Añadir una bandera costaría tocar los
**cinco** sitios del catálogo para gobernar algo que ya está gobernado.

**Sin índices, sin jobs, sin reglas nuevas.**

## 12 · Riesgos y mitigaciones

| Riesgo | Señal que lo detecta | Mitigación |
|---|---|---|
| El contrato del mapeo se toca en ocho sitios y alguno queda con la forma vieja | Typecheck; es un cambio de tipo, no de valor | El compilador obliga en los ocho |
| La unión produce etiquetas que no casan y se lee como «el importador no funciona» | Filas con «Unidad no encontrada» en la revisión | Está declarado en §4 y el mensaje ya nombra la unidad que no encontró |
| Alguien une dos columnas de vocabulario y el archivo entra con basura | — | `RN-U4` lo impide antes: la opción no existe |
| La oferta automática empuja a unir cuando no tocaba | Bloqueo que reaparece | `RN-U3` y `CA8`: ignorarla deja todo como estaba |
| Se une el nombre en orden invertido («Pérez Ana») | La muestra en pantalla | `CA3` obliga a que la muestra enseñe lo unido, que es donde se ve |

## 13 · Despliegue, rollback y Story Map

**Orden:** solo front. No hay reglas ni functions que desplegar **salvo `camposUnidos`**, que vive
en `registrarImportacion` — y por eso el orden es **functions → front**: el servidor viejo
ignoraría el campo en silencio y se perdería la medida justo del estreno.

**Rollback:** revocar el front. Nada persistido cambia de forma, y `camposUnidos` es opcional.

**Se valida en staging:** el flujo entero con archivos construidos —nombre partido, Torre+Apto que
funden, Torre+Apto que no funden—, y las tres que deben fallar (`CA10`, `CA11`, `CA12`).
**Solo en producción:** nada. No hay dato de producción que haga falta.

**MVP:** §4 «entra», los trece criterios.
**Fase 2:** partir una celda · plantillas con prefijo · sugerir la unión del nombre partido.

## 14 · Puertas

| Puerta | Estado |
|---|---|
| `G0` Necesidad | ✅ Medida contra el código con la sonda, no supuesta |
| `G1` Valor | ⚠️ **NO superada.** La métrica está definida y **no hay tráfico contra el que leerla**: `importRuns` = 0 en producción. Se lee con el primer conjunto real |
| `G2` Datos y permisos | ✅ Sin colección nueva, sin permiso nuevo, un campo opcional de telemetría |
| `G3` Riesgo | ✅ Reversible por revocación; nada irreversible |
| `G4` Aceptación | ✅ Trece criterios, cuatro de ellos de fallo |
| `G5` Operación | ✅ Lo opera el mismo administrador que hoy importa. No añade trabajo recurrente a nadie |
| `G6` Escala | ✅ Es una concatenación por fila dentro del tope de 5.000 de `RN-08` |

> **`G1` es la única abierta, y no la cierra construir: la cierra un cliente.** Lo mismo que frena
> a `AI-ONB-001`. Está **lista para desarrollo** (`G0`–`G3`); **no** se podrá marcar productiva
> hasta que alguien importe de verdad.

## 15 · Lo que hay que corregir en `PRD-V-FEAT-002` al construir esto

1. **`RN-02`** — reescribirla como `RN-U2`: una columna no alimenta dos campos. La dirección
   contraria queda permitida por acto explícito.
2. **`CA-13`** — añadir `camposUnidos` a lo instrumentado.
