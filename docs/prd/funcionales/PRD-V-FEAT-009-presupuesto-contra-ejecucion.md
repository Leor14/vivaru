# PRD-V-FEAT-009 — Presupuesto contra ejecución, para la asamblea

| Campo | Valor |
|---|---|
| **ID** | `PRD-V-FEAT-009` |
| **Tipo** | `FEAT` — capacidad nueva. El estado financiero es su **proveedor**, no su sujeto |
| **Portales** | `ADMIN` (alcance) · consejo **fuera del MVP** (ver `TBD-B`) |
| **Módulo** | Finanzas |
| **Usuario principal** | El administrador que lleva el presupuesto a la asamblea ordinaria |
| **Usuarios secundarios** | La asamblea y el consejo — **sobre papel** en el MVP |
| **Responsable** | David |
| **Estado** | **Discovery — LISTA PARA DESARROLLO** (10 sep 2026) |
| **Dependencias** | `PRD-V-PLAT-003` (el plan de cuentas: **contra qué** se presupuesta) · `PRD-V-FLOW-007` entrega 1 (el núcleo del estado financiero: **de dónde sale** lo ejecutado) |
| **Riesgo** | Bajo — no mueve dinero, no toca el libro ni los permisos que ya existen |
| **Reversibilidad** | Total por bandera. Los presupuestos guardados no alteran ninguna otra cifra |

---

## 1 · Resumen ejecutivo

La asamblea ordinaria revisa cada año si el presupuesto estuvo bien hecho y si hay
déficit. Para eso hacen falta dos columnas, **lo presupuestado y lo ejecutado**, por
cuenta. Vivaru tiene la segunda y no tiene la primera.

**Lo ejecutado ya lo calcula Vivaru**, por cuenta del plan y sobre cualquier rango de
fechas: es el estado financiero de `FLOW-007`, el mismo que ve el consejo en
`/admin/reports`. Lo que falta es **dónde guardar el presupuesto** y **la pantalla que
pone las dos columnas juntas**.

Esta ficha construye las dos cosas, **sin volver a calcular lo ejecutado**. Esa es su
regla central (`RN-01`): si esta pantalla sumara asientos por su cuenta, el día de la
asamblea dos pantallas de Vivaru darían dos cifras distintas para el mismo gasto.

---

## 2 · Problema y baseline

> «La ley de propiedad horizontal de aquí del Ecuador nos permite hacer las **asambleas
> ordinarias**, donde se aprueban los presupuestos del año anterior. **Los tres primeros
> meses de cada año** tendríamos que revisar los presupuestos, los informes, **a ver si
> estaban bien presupuestados, si hay algún déficit**.»
> — Sesión con la administradora, 19 de agosto de 2026, §3.8

**Es una obligación legal con ventana fija (el primer trimestre), no un informe
opcional.** Y ninguno de los dos productos la cubre: en los documentos de Habitanto,
`presupuestado`, `ejecución` y `real vs` aparecen **cero veces**; su `E6` es una
simulación del año y su `E7` son escenarios, y ninguno compara lo presupuestado con lo
ejecutado.

### Lo medido en el repositorio y en producción (10 de septiembre de 2026)

| Medición | Resultado | Qué decide |
|---|---|---|
| `budget\|presupuest` en `src`, `functions/src` y reglas | **Solo en comentarios.** Ninguna entidad, ninguna colección | Baseline 0. No hay nada que migrar |
| Lo ejecutado por cuenta | **Ya existe**: `construirEstadoFinanciero` devuelve `incomeByCategory` y `expenseByCategory` sobre cualquier rango, y `/admin/reports` ya lo pide con rango personalizado | La ficha **consume**, no calcula |
| 🔴 **Los ingresos por cuota NO están en los asientos que suma el núcleo** | `esRecaudoDeCartera` los salta y entran aparte, por el argumento `cuota`, desde `repartirRecaudo` sobre los cargos del período | **Sumar los asientos del año daría un ingreso ejecutado SIN cuotas**, que es la mayor partida de cualquier conjunto. Por eso `RN-01` no es estética |
| La clave de cada fila ejecutada | `cajonDe` usa el código de cuenta **solo si el plan lo nombra**; si no, la categoría | Puede haber filas ejecutadas cuya clave no está en el presupuesto. `RN-02` |
| Plan de cuentas | 21 cuentas por conjunto (11 de ingreso, 10 de egreso), sembrado en los nueve; `ChartAccount.status` es `active` o `inactive` | Contra esto se presupuesta. Las raíces no: son suma |
| Asientos en producción | **95, todos de 2026**, en 5 de los 9 conjuntos (Privada Las Playas, 57) | 🔴 **El año cerrado (2025) sale VACÍO en todos los conjuntos hoy.** Ver abajo |
| El consejo | `canAccessPath` solo le abre `/admin/documents`; el consejero marcado de `PLAT-004` es residente; **ninguno de los dos lee `ledgerEntries`** (reglas: `tenantAdminOrSuper`) | El consejo en la app necesitaría una instantánea. **Fuera del MVP**, `TBD-B` |
| Rangos del informe | `ReportPeriodKey` no tiene «año»; sí `custom` | El rango del año se construye, no se añade al selector del informe |

**Lo que dice la fila de los asientos, y cambia el calendario:** David eligió «el año en
curso, y de paso el cerrado». El cerrado es el que pide la ley —la asamblea revisa el año
anterior—, **pero hoy no hay ningún año cerrado con datos**. El primer uso legal real es
**el primer trimestre de 2027, revisando 2026**. Y eso exige que **el presupuesto de 2026
—que la asamblea ya aprobó en papel a principios de este año— se cargue antes**. La
entrega 1 sirve ya para el año en curso; la ventana que importa abre en enero.

### Métrica de éxito

- **Hoy:** 0 presupuestos en Vivaru.
- **Adelantada:** conjuntos con el presupuesto de 2026 cargado **antes del 31 de diciembre
  de 2026**.
- **La que cuenta:** en el primer trimestre de 2027, **al menos un conjunto lleva a su
  asamblea ordinaria** el presupuesto 2026 contra ejecución sacado de Vivaru.

---

## 3 · Usuarios, roles y permisos

| Rol | Presupuestos | Comparación |
|---|---|---|
| `tenant_admin` de su conjunto | Crea, edita en borrador, aprueba | Ve |
| `super_admin` | Lee | Ve |
| Consejo (rol o marca de `PLAT-004`) | **Nada en el MVP** — lo recibe impreso | — |
| Residente, portería | Nada | — |

**No se toca ningún rol.** Una colección nueva, cerrada a todos salvo al administrador de
su conjunto.

---

## 4 · Objetivo, alcance y exclusiones

### Entra

- **El presupuesto anual por cuenta del plan**, de ingresos y de egresos.
- **La comparación por cuenta**: presupuestado, ejecutado, diferencia y porcentaje, con
  totales y resultado del año.
- **Dos años: el en curso y el anterior** (decisión de David, 10 sep).
- **Aprobar** con la fecha del acta, y que lo aprobado **ya no se pueda retocar**.
- **Una vista imprimible** para llevar a la asamblea.

### No entra, y por qué

| Fuera | Por qué |
|---|---|
| **Escenarios** (`E7` de Habitanto) | Decisión de David, 10 sep: fuera del MVP |
| Simulación del año (`E6`) | No es lo que pidió la administradora: ella pregunta si **estuvo bien**, no qué pasaría |
| Presupuesto por mes | `TBD-C`. El de la asamblea es anual; la referencia del año transcurrido cubre el «¿vamos bien?» |
| Presupuesto reformado | `TBD-A`. Pasa, pero no el primer año |
| El consejo en la app | `TBD-B`. El consejo no lee el libro, así que no es una pantalla más: es una instantánea |
| Una línea en el informe mensual | `TBD-D`. La bandera del informe está apagada en los nueve |
| Copiar el presupuesto del año anterior | Fase 2. Con 21 cuentas, teclearlo una vez al año no es el cuello de botella |
| Devengado | Lo ejecutado es **lo que dice el libro**, igual que el informe. La deuda a proveedores se muestra aparte (`RN-09`) |

### Por qué no va DENTRO del informe mensual

`pendientes.md` decía que §3.8 «encaja dentro del informe mensual» y que hacerlo suelto
obligaba a rehacer parte. **Medido, lo que no hay que rehacer es el cálculo, no la
pantalla**, y hay tres razones para que la pantalla vaya aparte:

1. **El informe es mensual y el presupuesto es anual.** La asamblea compara el año entero.
2. **El informe es una instantánea congelada**, y su bandera está apagada en los nueve
   conjuntos. Colgar §3.8 de ahí lo dejaría apagado por una decisión que no es suya.
3. **El consejo, que es quien lee el informe, no puede leer el libro.** Meterlo en el
   informe no le da la comparación a nadie que hoy no la tenga.

Lo que sí se comparte es el número: la pantalla lee lo ejecutado **del mismo hook que
`/admin/reports`** (`RN-01`), así que las dos dicen lo mismo por construcción.

---

## 5 · Flujo funcional

### Camino feliz

1. El administrador entra en **Finanzas → Presupuesto**. Se abre el **año en curso**.
2. Si no hay presupuesto, ve lo ejecutado por cuenta y **«Cargar presupuesto»**.
3. El formulario lista las **cuentas activas con cuenta madre**, agrupadas en Ingresos y
   Egresos, con un importe por cuenta. Guarda como **borrador**.
4. La tabla se completa: presupuestado, ejecutado, diferencia, porcentaje. Arriba, el
   **porcentaje del año transcurrido** como referencia.
5. Cuando la asamblea lo aprobó, **«Marcar como aprobado»** con la fecha del acta. La
   pantalla pasa a solo lectura y dice «Aprobado por la asamblea el …».
6. Para la asamblea: **«Imprimir»**.

### Validaciones y errores

- Importe: número mayor o igual que cero, con los decimales de la moneda del conjunto.
- **Vacío no es cero** (`RN-03`): una cuenta sin importe es «Sin presupuestar»; un `0`
  tecleado es «Presupuestado en cero». Es la misma distinción que el saldo inicial de
  `FLOW-007` (`CA4` / `RN-09` de aquella ficha), y por la misma razón.
- Sin plan de cuentas sembrado: estado vacío que lo explica, sin formulario.

### Casos límite

| Caso | Comportamiento |
|---|---|
| Un año **sin ningún movimiento** (2025, hoy, en los nueve) | **Aviso en vez de comparación** (`RN-07`). Un 0 % ejecutado se leería como «nos sobró todo» |
| Gasto en una cuenta **sin presupuesto** | Aparece como «Sin presupuestar» y **cuenta en el total** (`RN-02`) |
| Cuenta desactivada después de presupuestarla | Se mantiene: lo aprobado se respeta |
| Cuenta creada después de aprobar | Su ejecutado aparece como «Sin presupuestar» |
| Un importe inválido en el documento (escrito saltándose el formulario) | La línea se marca inválida; **los totales no dan `NaN`** (`CA21`) |

---

## 6 · Estados y transiciones

```
(no existe) ──crear──▶ borrador ──aprobar──▶ aprobado
                         │  ▲
                       editar
```

- **`borrador`**: el administrador edita y puede borrar.
- **`aprobado`**: **inmutable para el administrador**, en las reglas (`RN-04`). No hay
  vuelta a borrador desde la app.
- Corregir un aprobado mal copiado del acta es **soporte** (`super_admin`, SDK de admin),
  y queda en `updatedAt`. El reformado de verdad es `TBD-A`.

---

## 7 · Contrato de datos y multi-tenancy

### `budgets` — un documento por conjunto y año

**Id: `${tenantId}_${year}`, y las reglas lo comprueban** (`RN-10`): un id de documento es
global a la colección, y el `tenantId` aísla la lectura, no el id.

| Campo | Tipo | Quién lo pone |
|---|---|---|
| `tenantId` | `string` | Cliente, validado por reglas |
| `year` | `int` | Cliente, validado contra el id |
| `lines` | `Array<{ accountCode: string; amount: number }>` | Cliente. Máximo 200 |
| `status` | `"borrador" \| "aprobado"` | Cliente; nace `borrador` |
| `approvedAt` | `string` `YYYY-MM-DD` | La fecha **del acta**, que la teclea el administrador |
| `approvedBy` | `string` | `request.auth.uid`, exigido por reglas |
| `approvedRecordedAt` | `timestamp` | `request.time`, exigido por reglas |
| `createdAt` · `createdBy` · `updatedAt` · `updatedBy` | | Los de siempre |

> ⚠️ **Las líneas van en un ARRAY y no en un mapa por código, a propósito.** Los códigos
> llevan punto (`2.3`), y en `updateDoc` un punto en la clave es **una ruta de campo**:
> `lines.2.3` escribiría `lines → 2 → 3`. El documento se escribe siempre entero con
> `setDoc`.

---

## 8 · Reglas de negocio

| # | Regla |
|---|---|
| `RN-01` | **Lo ejecutado no se calcula aquí.** Sale de `useCommitteeReport` con el rango del año, el mismo hook que `/admin/reports`. Así incluye las cuotas —que no están en los asientos que suma el núcleo— y **coincide con el informe por construcción** |
| `RN-02` | **Nada ejecutado se esconde.** Toda fila ejecutada aparece, tenga presupuesto o no, y los totales ejecutados son **los del estado**, no la suma de las filas presupuestadas. Un gasto fuera del presupuesto es exactamente el déficit que la asamblea busca |
| `RN-03` | Vacío no es cero |
| `RN-04` | Aprobado es inmutable para el administrador, **en reglas** |
| `RN-05` | Solo se presupuestan cuentas con cuenta madre. Las raíces son la suma |
| `RN-06` | La desviación se lee **con palabras y no solo con color**: en egresos, ejecutar de más es «sobre-ejecución»; en ingresos, recaudar de menos es «faltante» |
| `RN-07` | Un año sin ningún movimiento muestra un aviso, no una comparación |
| `RN-08` | En el año en curso, el porcentaje del año transcurrido es **una referencia, no un veredicto**: hay gastos estacionales |
| `RN-09` | La deuda a proveedores (`supplierDebt`, del mismo hook) se muestra como «comprometido y aún no pagado». Lo ejecutado es lo que dice el libro, y sin esta nota una factura sin pagar parecería ahorro |
| `RN-10` | El id es `${tenantId}_${year}` y lo comprueban las reglas |
| `RN-11` | El selector ofrece dos años: el en curso y el anterior |
| `RN-12` | Resultado del año: ingresos menos egresos, presupuestado contra ejecutado, con «superávit» o «déficit» escrito |

---

## 9 · Notificaciones y correo

**Ninguna.** Es una consulta que el administrador abre cuando la necesita, una o dos veces
al año. Un aviso de «sobre-ejecución» mensual sería otra ficha, y nadie lo ha pedido.

---

## 10 · Criterios de aceptación

### Deben pasar

| # | Criterio |
|---|---|
| `CA1` | El administrador carga el presupuesto del año en curso con las **cuentas activas con madre**, agrupadas en ingresos y egresos; guarda en borrador y al recargar sigue ahí |
| `CA2` | Por cuenta se ven presupuestado, ejecutado, diferencia y porcentaje, y **el ejecutado de cada cuenta es idéntico al de `/admin/reports`** con el mismo rango — comprobado en pantalla sobre Las Playas 2026 |
| `CA3` | **El ingreso por cuotas aparece ejecutado, y no en cero**, en un caso con cargos pagados en el año (`RN-01`) |
| `CA4` | Un egreso en una cuenta sin presupuesto aparece como «Sin presupuestar» **y suma en el total** (`RN-02`) |
| `CA5` | Totales de ingresos y egresos y resultado del año, con «superávit» o «déficit» escrito (`RN-12`) |
| `CA6` | El selector ofrece el año en curso y el anterior; **el anterior, sin movimientos, muestra el aviso de `RN-07`** y no una tabla de ceros |
| `CA7` | Aprobado con fecha de acta, la pantalla pasa a solo lectura y dice la fecha |
| `CA8` | La vista impresa lleva conjunto, año, estado, fecha de corte, tabla, totales y la nota de proveedores, **sin menú ni botones** — mirada en la vista previa de impresión, no deducida del código |
| `CA9` | Todas las cifras en la moneda del conjunto |
| `CA10` | Con la bandera apagada no hay entrada en el menú y la ruta dice que no está disponible |
| `CA11` | Una cuenta con `0` tecleado y gasto dice «Presupuestado en cero», **distinto** de «Sin presupuestar» (`RN-03`) |

### **Deben fallar**

| # | Criterio que tiene que ser rechazado |
|---|---|
| `CA12` | Un residente lee un presupuesto → denegado |
| `CA13` | El administrador de **otro conjunto** lee o escribe → denegado |
| `CA14` | Se modifica un presupuesto **aprobado** —sus líneas, o su vuelta a borrador— → denegado (`RN-04`) |
| `CA15` | Se crea directamente en `aprobado` → denegado |
| `CA16` | Se crea con el id de otro conjunto o de otro año → denegado (`RN-10`) |
| `CA17` | Se aprueba con un `approvedBy` ajeno o un `approvedRecordedAt` inventado → denegado |
| `CA18` | Escribe un conjunto **suspendido** → denegado por `tenantOperable` |
| `CA19` | **Mutación:** filtrar las filas ejecutadas por las cuentas presupuestadas → **enrojece `CA4`** |
| `CA20` | **Mutación:** calcular lo ejecutado sumando los asientos del año → **enrojece `CA3`** |
| `CA21` | Un importe no numérico o negativo en el documento → la línea sale inválida y **los totales no dan `NaN`** |

> **Falsación obligatoria.** Borrar el bloque de reglas de `budgets` entero y comprobar
> que enrojecen `CA12`–`CA17`: una prueba de denegación pasa igual sin ninguna regla, la
> satisface el deny por defecto. Cada denegación va con su **pareja positiva** —el mismo
> documento, leído o escrito por quien sí debe—. `CA19` y `CA20` **son** falsaciones: si
> la mutación no enrojece nada, el hueco es de cobertura y se escribe la prueba.

---

## 11 · Arquitectura y dependencias

### La decisión obligatoria: **escritura directa**

| Pieza | Vía | Por qué |
|---|---|---|
| El presupuesto | **Escritura directa** | No mueve dinero, no escribe en dos colecciones, y **todos sus invariantes viven en el propio documento**: conjunto, id, bloqueo y quién aprueba. Las reglas los sostienen enteros |
| La comparación | **Cálculo en el cliente**, función pura | Lee lo que el administrador ya puede leer. No hay nada que falsificar que él no pueda ver igual |

**El contraejemplo que se miró:** en `FEAT-008`, la lectura empezó como escritura directa
y pasó a callable porque `previous` **decidía dinero**. Aquí no hay ningún campo que lo
decida. Lo único que las reglas no pueden comprobar —que cada importe del array sea un
número válido, porque no iteran— **no decide dinero**, y lo sostiene la función pura
(`CA21`).

**La bandera solo gobierna lo que se ve**, y se escribe así para que nadie crea otra
cosa: con ella apagada, un administrador podría escribir un presupuesto con el SDK. Es
inocuo: no altera ninguna otra cifra.

### Piezas y el gemelo que ya lo hace bien

| Pieza | Cambio |
|---|---|
| `src/lib/finanzas/presupuesto.ts` | **Nuevo, puro**: `compararPresupuesto({ lineas, ejecutado })` → filas, totales y resultado; `porcentajeDelAnio(fecha, anio)`. **Recibe lo ejecutado; no lo calcula** |
| `src/features/finanzas/use-presupuesto.ts` | Lectura y escritura, **siempre `setDoc` del documento entero** (§7) |
| `/admin/finanzas/presupuesto` | Nueva. Lo ejecutado de `useCommitteeReport(tenantId, { start: \`${y}-01-01\`, end: \`${y}-12-31\` })`. Gemelos: `/admin/finanzas/medidores` para la forma, `/admin/reports` para la impresión |
| `src/types/domain.ts` | `Budget` |
| `firestore.rules` | `budgets` + su banco, en **las dos listas** de configuración (hay guardián) |
| Barra lateral | «Presupuesto», en Finanzas |
| Bandera | `producto-presupuesto-anual`, en **los CINCO sitios**, apagada por defecto |
| Guardián | La página **no llama** a `buildFinancialStatement` ni a `construirEstadoFinanciero`, y sí a `useCommitteeReport`. Mide el código **sin comentarios** |

**No se toca `functions`**: no hay pieza de servidor, así que no hay espejo que mantener.

**El coste de reutilizar el hook:** `useCommitteeReport` carga también tickets, paquetes,
visitas y reservas del rango. Son lecturas de más, pequeñas con los volúmenes medidos. Si
algún día pesan, se extrae el cálculo del período a una función — **y la pantalla llama a
la función COMPLETA, no a su pieza interna**, que es el error que ya costó un defecto en
producción con la deuda a proveedores.

### `TBD`

| # | Pregunta | Bloquea |
|---|---|---|
| `TBD-A` | **Presupuesto reformado**: la asamblea extraordinaria lo modifica a mitad de año. ¿Versión nueva o edición con rastro? | Fase 2 |
| `TBD-B` | **El consejo en la app.** Depende de `PLAT-004` entrega 2 **y** de una instantánea, porque el consejo no lee el libro | Fase 2 |
| `TBD-C` | ¿Presupuesto por mes? El de la asamblea es anual. Se reabre si la administradora lo pide | No |
| `TBD-D` | ¿Una línea «ejecución del presupuesto a la fecha» en el informe mensual? | Fase 2, cuando la bandera del informe esté encendida en algún conjunto |

---

## 12 · Riesgos

| Riesgo | Señal que lo detecta | Mitigación |
|---|---|---|
| **«Gastamos cero» en un año sin datos** | Un año con 0 % ejecutado en todas las cuentas | `RN-07`: aviso en vez de tabla. Hoy es el caso de 2025 en los nueve |
| **Lo ejecutado diverge del informe** | La misma cuenta con dos cifras en dos pantallas | `RN-01` + guardián + `CA2` en pantalla |
| **Un gasto sin presupuesto desaparece y esconde el déficit** | Totales ejecutados menores que en el informe | `RN-02` + `CA19` |
| **Se retoca el presupuesto aprobado para esconder un déficit** | — (no se ve: por eso va en reglas) | `RN-04` + `CA14` |
| **Tabla vacía, otra vez**: nadie carga 2026 antes de enero | 0 documentos en `budgets` en diciembre | La pantalla **sirve sin presupuesto** —lo ejecutado del año por cuenta ya es útil—, y cargarlo son 21 cifras una vez al año. Avisar a la administradora en diciembre |
| El punto de los códigos como clave de mapa | Líneas anidadas `2 → 3` | Array + `setDoc` (§7) |

---

## 13 · Despliegue, rollback y Story Map

### Orden

**Reglas → front.** No hay functions. **No se invierte**: las reglas solo abren una
colección que no existe, no restringen nada vigente.

### Rollback

- **Reversible por bandera**, entero.
- Los presupuestos guardados quedan inertes: **no alteran ninguna otra cifra**.

### Story Map

| Entrega | Qué | Por qué en este orden |
|---|---|---|
| **1** | Cargar el presupuesto en borrador + la comparación, los dos años, con el aviso del año vacío | Responde hoy a «¿vamos bien este año?», y es lo que hay que tener para cargar 2026 antes de enero |
| **2** | Aprobar y bloquear + la vista imprimible | Es lo que pide la asamblea del primer trimestre. Va después porque bloquear un presupuesto que aún no se ha visto contra lo ejecutado es bloquear a ciegas |
| Fase 2 | `TBD-A`, `TBD-B`, `TBD-D`, copiar del año anterior | — |

### Qué se valida dónde

- **En staging:** los veintiún criterios; los de reglas contra el emulador (**sí hay
  Java**, en `~/.local/jdk`).
- **Solo en producción, y con ojos:** `CA2` sobre Privada Las Playas 2026 —57 asientos,
  el conjunto con más datos—, comparando cuenta a cuenta con `/admin/reports` en el mismo
  rango. Y `CA8` en la vista previa de impresión.

---

## Puertas

| Puerta | Estado |
|---|---|
| **`G0` Necesidad** | ✅ **Citada textualmente**, y es una **obligación legal con ventana fija**, no una petición de lista |
| **`G1` Valor** | ✅ Baseline 0 en Vivaru y en Habitanto. Ninguno de los dos compara |
| **`G2` Datos y permisos** | ✅ Una colección nueva, cerrada al administrador de su conjunto. **Sin tocar roles, libro ni functions** |
| **`G3` Riesgo** | ✅ Bajo, y reversible entero por bandera |
| **`G4` Aceptación** | ✅ Veintiún criterios, **diez de ellos que deben fallar**, dos de ellos mutaciones |
| **`G5` Operación** | ✅ **El dueño ya existe y ya tiene el dato**: el administrador lleva el presupuesto a la asamblea, y el de 2026 **ya está aprobado en papel**. Cargarlo son 21 cifras al año |
| **`G6` Escala** | ✅ 21 cuentas × 2 años por conjunto. Sin problema de volumen ni de coste |

> **`G0`–`G6` superadas: LISTA PARA DESARROLLO.** Ningún `TBD` bloquea el MVP. Lo único
> que hay que decir en voz alta antes de construir es el calendario: **el año cerrado no
> tendrá datos hasta enero de 2027**, así que la entrega 1 se valida sobre el año en curso.
