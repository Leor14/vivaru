# PRD-V-FEAT-010 — Tesorería: saldo por cuenta, traspasos y caja chica

| Campo | Valor |
|---|---|
| **ID** | `PRD-V-FEAT-010` |
| **Tipo** | `FEAT` — capacidad nueva. El estado financiero **no es su sujeto y no debe cambiar** |
| **Portales** | `ADMIN` |
| **Módulo** | Finanzas |
| **Usuario principal** | El administrador que mueve dinero entre las cuentas del conjunto y maneja la caja chica |
| **Usuarios secundarios** | Ninguno. El residente **no ve nada de esto**, y es una regla (`RN-08`) |
| **Responsable** | David |
| **Estado** | **Entrega 1 construida y falseada** (10 sep 2026) · pendiente de verse en staging |
| **Dependencias** | `PRD-V-FLOW-002` (el pago registra a qué cuenta entró) · `PRD-V-FLOW-004` (la conciliación por cuenta) · `PRD-V-FLOW-007` entrega 1 (el saldo inicial por cuenta) |
| **Riesgo** | Medio — no mueve dinero de nadie, pero **toca cómo se lee el dinero** del conjunto |
| **Reversibilidad** | Por bandera en lo que se ve. Los traspasos no se borran: se anulan (`RN-06`) |

---

## 1 · Resumen ejecutivo

Vivaru sabe cuánto dinero tiene el conjunto, **pero no dónde está**. El saldo de fondos es
uno solo; ninguna pantalla —ni ningún código— dice cuánto hay en cada cuenta. Habitanto lo
enseña en cada egreso, en cada apertura de caja y en cada traspaso: «saldo de la caja o banco
a la vista».

Esta ficha construye tres cosas, **en este orden porque cada una se apoya en la anterior**:

1. **El saldo por cuenta**, que hoy no existe. Sin él, un traspaso o una caja chica no mueven
   ningún número que el administrador vea.
2. **Los traspasos entre cuentas propias** — del banco a la caja, de ahorros a corriente.
3. **La caja chica**, con fondo fijo, límite y reposición.

**Y su regla central, que es una trampa medida:** un traspaso **no es ni un ingreso ni un
egreso** (`RN-01`). Escrito como dos asientos, inflaría a la vez ingresos y egresos en el
estado financiero, el informe mensual, el presupuesto contra ejecutado y el saldo de fondos.

---

## 2 · Problema y baseline

### De dónde sale, y lo que NO la sostiene

**No la pidió la administradora.** En la sesión del 19 de agosto, «caja chica», «caja menor»,
«traspaso» y «transferencia entre cuentas» aparecen **cero veces**. Sale del inventario de
Habitanto (`docs/inventario-habitanto.md` §A.7): son los candidatos **`C7`** (caja chica) y
**`C8`** (transferencias entre cuentas propias), **los dos P2**.

> **Se construye por decisión de David del 10 de septiembre, para llegar listos al primer
> cliente** — el mismo razonamiento con el que se abrió `FIN-002` el 28 de agosto. Queda
> escrito porque `G0` no se supera por dolor declarado, sino por decisión (ver Puertas).

### Cómo lo hace Habitanto (inventario del 21 ago)

- **Caja chica** — *«tiene el fin de cubrir aquellos gastos menores, urgentes e
  imprevisibles»*. La apertura pide forma de pago, caja o banco de origen **con su saldo**,
  caja chica destino **con su saldo y su límite**, valor, fecha, **«páguese a la orden de»** y
  detalle. Hay **listado de reposiciones**.
- **Transferencia entre cuentas** — origen con saldo, destino, valor, fecha, número de
  documento y detalle.
- Y el egreso muestra el **saldo de la caja o banco** del que sale el pago.

### Lo medido en el repositorio y en producción (10 de septiembre de 2026)

| Medición | Resultado | Qué decide |
|---|---|---|
| Saldo por cuenta en el código | **No existe.** Ninguna función lo calcula | La entrega 1 es la base de las otras dos |
| `LedgerEntryType` | `"ingreso" \| "egreso"`, y **16 ficheros** lo leen (8 en `functions/`, 8 en `src/`) | Añadir `"traspaso"` obliga a revisar los 16 más el núcleo con espejo |
| Sitios que tratan «lo que no es X» como Y | **Dos**: `conciliacion.ts:88` (todo lo que no es ingreso resta) y `conciliacion-casos.ts:114` (todo lo que no es egreso es ingreso) | 🔴 Un tercer tipo se convertiría en gasto o en ingreso **sin avisar**. `RN-01` |
| Cuentas bancarias en producción | **4, una por conjunto** (Santa María, Las Playas, Queretarock, Qintilab); dos son «Banco de ejemplo» | **Ningún conjunto tiene dos cuentas**: los traspasos nacen sobre tabla vacía |
| Asientos con cuenta | **77 de 95**. Sin cuenta: 6 egresos, 4 recaudos, 3 reversos, 1 anticipo, 4 manuales | El saldo por cuenta necesita una línea «sin cuenta asignada». `RN-03` |
| Santa María | Tiene su cuenta (Santander), pero **ninguno de sus asientos la lleva** | Su saldo por cuenta saldrá entero en «sin cuenta» — y es verdad |
| 🔴 **Recaudo en el libro frente a lo cobrado según Cartera** | Coincide en **2 de 7** conjuntos. Santa María: libro $1.120.000, Cartera $2.200.000. Queretarock y Qintilab: libro $0, Cartera **$15.300.000** cada uno | **El saldo de fondos sale de Cartera**, así que un saldo por cuenta sumado desde el libro **no cuadra con el total en cinco conjuntos**. `RN-04` |
| El residente y las cuentas | Las lee con `active == true` (`/resident/account`), para decir **a qué cuenta pagó** | 🔴 **Una caja chica guardada como cuenta bancaria le aparecería como destino de pago.** `RN-08` |
| La conciliación | Busca pareja **solo entre asientos** (`conciliacion-casos.ts:579`) | Cada tramo de un traspaso aparecerá en el extracto de su banco. `RN-07` |
| El egreso | Ya elige la cuenta de la que sale (`bankAccountId`, en los 52 egresos) | Los gastos de la caja chica son **egresos normales** que salen de la caja |

### Métrica de éxito

- **Hoy:** 0 cuentas con saldo visible, 0 traspasos, 0 cajas chicas.
- **La que cuenta:** el día que un conjunto tenga dos cuentas, el administrador **sabe cuánto
  hay en cada una** y el total **cuadra con el saldo de fondos**, nombrando la diferencia.

---

## 3 · Usuarios, roles y permisos

| Rol | Saldo por cuenta | Traspasos | Caja chica |
|---|---|---|---|
| `tenant_admin` de su conjunto | Ve | Registra y anula | Abre, repone y paga desde ella |
| `super_admin` | Ve | Ve | Ve |
| Consejo, residente, portería | **Nada** | **Nada** | **Nada** |

---

## 4 · Objetivo, alcance y exclusiones

### Entra

- **Saldo por cuenta** (entrega 1): cada cuenta con su saldo inicial, lo que entró, lo que
  salió y lo que se traspasó; más las dos líneas que hacen cuadrar el total (`RN-03`, `RN-04`).
- **Traspasos** (entrega 2): de una cuenta propia a otra, con fecha, valor, referencia y
  detalle; anulables; **conciliables** en el extracto de cada banco.
- **Caja chica** (entrega 3): **fondo fijo con límite**, apertura, gastos que salen de ella y
  **reposición** de lo gastado, con su listado.

### No entra, y por qué

| Fuera | Por qué |
|---|---|
| Asignar cuenta a los asientos viejos | Decisión de David (10 sep): **se muestran aparte**, no se tocan. Editar asientos ya registrados es otra ficha |
| Bloquear por saldo insuficiente | El saldo calculado **está incompleto** (`RN-04`): bloquear por él frenaría operaciones legítimas. Avisa, no bloquea (`RN-09`) |
| Comprobante numerado correlativo | Vivaru decidió no llevar series (los recibos llevan código derivado). El traspaso lleva la **referencia del banco** más su código |
| Que la caja chica reciba cuotas | En Habitanto es solo para gastos menores. `RN-10` |
| Cheques, «páguese a la orden de» impreso | Habitanto lo imprime; aquí basta el campo de beneficiario en el gasto |
| Varias monedas | Todas las cuentas de un conjunto van en su moneda |

---

## 5 · Flujo funcional

### Camino feliz

1. **Finanzas → Tesorería.** Una fila por cuenta: saldo inicial, entradas, salidas,
   traspasos y **saldo**. Debajo, «sin cuenta asignada» y «cobrado en Cartera sin asiento en el
   libro», y el **total, que es el saldo de fondos**.
2. **«Traspasar»**: origen, destino, valor, fecha, referencia y detalle. Al guardar, el saldo
   de las dos cuentas cambia y **el total no**.
3. **«Abrir caja chica»**: nombre, **límite** (el fondo fijo) y la cuenta de la que sale el
   dinero. La apertura **es un traspaso** de esa cuenta a la caja.
4. **Pagar un gasto menor**: el egreso de siempre, eligiendo la caja como cuenta de salida.
5. **«Reponer»**: propone traspasar desde el banco **lo gastado desde la última reposición**,
   para devolver la caja a su límite. El listado de reposiciones es la historia de la caja.

### Validaciones y errores

- Origen y destino **distintos** y del mismo conjunto; valor mayor que cero; fecha no futura.
- Un traspaso que deja una cuenta en negativo **avisa** con el saldo que quedaría, y deja
  continuar (`RN-09`).
- Una reposición que pasaría el límite **avisa** con cuánto sobra.

### Casos límite

| Caso | Comportamiento |
|---|---|
| Un conjunto con **una sola cuenta** (todos, hoy) | El saldo por cuenta se ve; «Traspasar» explica que hacen falta dos |
| Un asiento sin cuenta | Suma en «sin cuenta asignada», con cuántos son y enlace a verlos |
| Cartera cobró más de lo que el libro registra | La diferencia se **nombra** como línea propia, no se reparte entre cuentas |
| Anular un traspaso | Deja de contar en los dos saldos; queda en la lista, tachado, con quién y cuándo |
| Una cuenta desactivada con saldo | Sigue en la tesorería: el dinero no desaparece porque la cuenta se archive |

---

## 6 · Estados y transiciones

**Traspaso:** `registrado → anulado`. No hay borrado (`RN-06`).
**Caja chica:** `abierta → cerrada`. Cerrarla exige saldo cero —se devuelve con un traspaso—.

---

## 7 · Contrato de datos y multi-tenancy

### `treasuryTransfers` — el traspaso, **fuera del libro**

| Campo | Tipo | Nota |
|---|---|---|
| `tenantId` | `string` | |
| `fromAccountId` · `toAccountId` | `string` | Una cuenta bancaria **o** una caja chica. Distintos |
| `amount` | `number` | Mayor que cero |
| `date` | `string` `YYYY-MM-DD` | |
| `reference` | `string?` | La del banco, si la hay |
| `detail` | `string?` | |
| `kind` | `"traspaso" \| "apertura" \| "reposicion" \| "cierre"` | Los de la caja son traspasos con nombre |
| `status` | `"registrado" \| "anulado"` | |
| `voidedAt` · `voidedBy` | | Al anular |
| `createdAt` · `createdBy` | | |

### `pettyCashFunds` — la caja chica, **fuera de `bankAccounts`**

| Campo | Tipo | Nota |
|---|---|---|
| `tenantId` · `name` | `string` | |
| `limit` | `number` | El fondo fijo |
| `sourceAccountId` | `string` | La cuenta de la que se repone |
| `status` | `"abierta" \| "cerrada"` | |

> ⚠️ **Por qué la caja no es una `bankAccount`:** el residente lee las cuentas activas para
> elegir a cuál pagó (`FLOW-002` CA11), y la regla le concede el documento entero. Una caja
> guardada ahí **le aparecería como destino de pago**. Excluirla obligaría a migrar las cuentas
> existentes y a cambiar la consulta del residente — tocar lo que funciona para poder añadir.
> **La caja no tiene banco, número ni extracto**: no es una cuenta bancaria.

**El egreso pagado desde la caja** lleva en `bankAccountId` el id de la caja. El campo se
lee desde esta ficha como **«cuenta de tesorería»**; los ids son globales y no chocan.

---

## 8 · Reglas de negocio

| # | Regla |
|---|---|
| `RN-01` | **Un traspaso no es un asiento.** Vive en `treasuryTransfers` y **ningún consumidor del libro lo lee**: ni el núcleo del estado financiero, ni el informe mensual, ni el presupuesto, ni el saldo de fondos. Lo vigila un guardián. Con dos asientos, inflaría ingresos y egresos a la vez; con un tercer tipo, dos sitios medidos lo convertirían en gasto o en ingreso sin avisar |
| `RN-02` | **Un traspaso no cambia el saldo de fondos**: mueve dinero de un saldo a otro y el total queda igual. Prueba con números a mano |
| `RN-03` | Los asientos sin cuenta suman en **«sin cuenta asignada»**, con cuántos son. No se reparten ni se adivinan (decisión de David) |
| `RN-04` | **El total de la tesorería ES el saldo de fondos**, por construcción: cuentas + sin cuenta + **«cobrado en Cartera sin asiento en el libro»**. Esa tercera línea nombra la diferencia medida en cinco conjuntos en vez de esconderla. Se calcula **con la misma función** que el saldo de fondos (`computeFundPosition`), nunca con otra suma |
| `RN-05` | Saldo de una cuenta = saldo inicial + asientos con esa cuenta (ingresos − egresos, reversos incluidos) + traspasos que entran − traspasos que salen, **solo los `registrado`** |
| `RN-06` | Un traspaso no se borra: se **anula**, con quién y cuándo. Anulado, deja de contar |
| `RN-07` | Cada tramo de un traspaso **es conciliable** en el extracto de su banco: la conciliación lo ofrece como candidato junto a los asientos. Sin esto, cada traspaso dejaría dos líneas sueltas |
| `RN-08` | **El residente no ve la tesorería ni la caja chica**, y la caja **no aparece** donde elige a qué cuenta pagó. Por eso vive fuera de `bankAccounts` |
| `RN-09` | Saldo negativo o límite superado **avisan, no bloquean**: el saldo calculado está incompleto (`RN-03`, `RN-04`) y bloquear por él frenaría operaciones legítimas |
| `RN-10` | La caja chica **no recibe cuotas**: el pago de un residente no puede entrar a una caja |
| `RN-11` | Reponer propone **lo gastado desde la última reposición** — el fondo fijo vuelve a su límite. Se puede ajustar, y avisa si pasa del límite |
| `RN-12` | El nombre sigue al país del conjunto: **«caja menor»** en Colombia, **«caja chica»** en Ecuador y México. Entra en `vocabulario-pais.ts` |
| `RN-13` | Una cuenta desactivada con saldo **sigue en la tesorería** |

---

## 9 · Notificaciones y correo

**Ninguna.** Es operación interna del administrador.

---

## 10 · Criterios de aceptación

### Deben pasar

| # | Criterio |
|---|---|
| `CA1` | La tesorería enseña una fila por cuenta con saldo inicial, entradas, salidas, traspasos y saldo |
| `CA2` | **El total es idéntico al saldo de fondos de `/admin/finanzas`**, en pantalla, en Las Playas y en Santa María — donde saldrá casi entero en «sin cuenta» y en «cobrado sin asiento» |
| `CA3` | Los asientos sin cuenta aparecen en su línea, **con su número** (18 en producción hoy) |
| `CA4` | Un traspaso de A a B baja A y sube B **en el mismo importe**, y el total no se mueve (`RN-02`) |
| `CA5` | **El estado financiero, el informe mensual y el presupuesto dan las mismas cifras antes y después de un traspaso** (`RN-01`) |
| `CA6` | Anular un traspaso lo saca de los dos saldos y lo deja en la lista con quién y cuándo |
| `CA7` | El tramo de salida de un traspaso se concilia contra la línea del extracto de A, y el de entrada contra la de B |
| `CA8` | Abrir una caja chica con límite: el banco baja, la caja sube hasta el límite |
| `CA9` | Un egreso pagado desde la caja **baja la caja** y cuenta en el estado financiero como cualquier egreso |
| `CA10` | Reponer propone exactamente lo gastado desde la última reposición, y la caja vuelve a su límite |
| `CA11` | Saldo negativo o límite superado: aviso con la cifra, y deja continuar (`RN-09`) |
| `CA12` | En un conjunto colombiano dice «caja menor»; en uno mexicano o ecuatoriano, «caja chica» |

### **Deben fallar**

| # | Criterio que tiene que ser rechazado |
|---|---|
| `CA13` | Un residente lee un traspaso o una caja chica → denegado |
| `CA14` | **La caja chica aparece en la lista de cuentas del residente** → no aparece (`RN-08`) |
| `CA15` | Un traspaso con origen igual a destino, valor ≤ 0 o una cuenta de otro conjunto → denegado |
| `CA16` | Borrar un traspaso → denegado; solo se anula (`RN-06`) |
| `CA17` | Un pago de residente con destino una caja chica → rechazado (`RN-10`) |
| `CA18` | Escribe un conjunto **suspendido** → denegado por `tenantOperable` |
| `CA19` | **Mutación:** el núcleo del estado financiero lee `treasuryTransfers` → **enrojece el guardián** (`RN-01`) |
| `CA20` | **Mutación:** el total de la tesorería se suma por su cuenta en vez de usar `computeFundPosition` → **enrojece `CA2`** en su prueba con números a mano (`RN-04`) |

> **Falsación**, como en `FEAT-009`: cada denegación con su pareja positiva, y **cada cláusula
> de las reglas quitada por separado** —borrar el bloque entero solo enrojece las positivas—.

---

## 11 · Arquitectura y dependencias

### La decisión obligatoria: **escritura directa**, con una excepción

| Pieza | Vía | Por qué |
|---|---|---|
| Traspaso y caja chica | **Escritura directa** | No mueven dinero de nadie ni tocan el libro; sus invariantes —conjunto, cuentas distintas, importe positivo, anular en vez de borrar— los sostienen las reglas, que pueden leer las dos cuentas con `get()` |
| El saldo por cuenta | **Cálculo en el cliente**, función pura | Lee lo que el administrador ya puede leer |
| **`RN-10`** (la caja no recibe cuotas) | **En la callable del pago** | El pago ya es callable (`aplicarPago`, `payments.ts:789` lee la cuenta de destino). **Una regla de Firestore no protege lo que escribe una callable**: la guarda va en el servidor |

### Piezas y el gemelo que ya lo hace bien

| Pieza | Cambio |
|---|---|
| `src/lib/finanzas/tesoreria.ts` | **Nuevo, puro**: `saldosPorCuenta(...)` → filas, sin cuenta, cobrado sin asiento y total. **El total sale de `computeFundPosition`** (`RN-04`) |
| `/admin/finanzas/tesoreria` | Nueva. Gemelo: `/admin/finanzas/presupuesto` |
| `treasuryTransfers` · `pettyCashFunds` | Colecciones nuevas, reglas, y su banco en **las dos listas** de vitest |
| La conciliación | Ofrece los tramos de traspaso como candidatos (`RN-07`) — en los **dos** espejos, `functions/src/conciliacion*.ts` y `src/features/finanzas/conciliacion-reglas.ts` |
| El egreso | Su selector de cuenta incluye las cajas abiertas |
| `payments.ts` | Rechaza una caja como destino (`RN-10`) |
| `vocabulario-pais.ts` | «caja menor» / «caja chica» (`RN-12`) |
| Bandera | `producto-tesoreria`, en **los CINCO sitios**, apagada |
| Guardián | El núcleo, el informe y el presupuesto **no leen** `treasuryTransfers` — midiendo el código **sin comentarios** |

### `TBD`

| # | Pregunta | Bloquea |
|---|---|---|
| `TBD-A` | ¿Asignar después la cuenta de los asientos viejos? Hoy se muestran aparte | Fase 2 |
| `TBD-B` | ¿La caja chica acepta ingresos que no sean reposición (un vuelto, un reintegro)? | No: entran como traspaso de «otros» o se deja para Fase 2 |

---

## 12 · Riesgos

| Riesgo | Señal | Mitigación |
|---|---|---|
| **El traspaso infla el estado financiero** | Ingresos y egresos crecen el mismo importe | `RN-01`: fuera del libro, con guardián y `CA5` |
| **El total de la tesorería no cuadra con el saldo de fondos** | Dos cifras de «cuánto dinero hay» | `RN-04`: la misma función, y la diferencia nombrada |
| **La caja chica se le ofrece al residente** | Aparece al pagar | `RN-08`: colección propia, y `CA14` |
| **Encendido sobre tabla vacía, otra vez** | Ningún conjunto con dos cuentas | Se sabe y se escribe: la entrega 1 sirve con una sola cuenta —enseña dónde está el dinero y qué falta asignar— |
| La conciliación deja líneas sueltas | Traspasos sin pareja | `RN-07` en la entrega 2, no después |

---

## 13 · Despliegue, rollback y Story Map

### Orden

**Reglas → functions → front.** Las reglas solo abren colecciones nuevas. **`functions` sí va
esta vez**: la guarda de `RN-10` está en `aplicarPago`.

### Rollback

Por bandera en lo que se ve. Los traspasos y las cajas quedan guardados; **no alteran el
estado financiero** porque nunca entraron en él (`RN-01`).

### Story Map

| Entrega | Qué | Por qué en este orden |
|---|---|---|
| **1** | Saldo por cuenta, con las dos líneas que lo hacen cuadrar | Es la base, y **sirve sola**: hoy nadie sabe dónde está el dinero, y va a enseñar que Santa María no asignó cuenta a ningún asiento |
| **2** | Traspasos, anulables y conciliables | Sin el saldo, un traspaso no mueve nada visible |
| **3** | Caja chica: fondo fijo, límite, gastos y reposición | Se apoya en las dos: la apertura y la reposición **son** traspasos |

### Qué se valida dónde

- **En staging:** los veinte criterios; hará falta **crear una segunda cuenta** en Las Playas.
- **Solo en producción, con ojos:** `CA2` en Santa María, donde el saldo por cuenta saldrá casi
  entero fuera de las cuentas — y eso es lo que tiene que decir.

---

## 14 · Lo que se vio al construir la entrega 1 (10 de septiembre de 2026)

### Lo construido

- **`saldosPorCuenta`** (`src/lib/finanzas/tesoreria.ts`), pura: por cuenta, saldo inicial,
  entradas, salidas y saldo; más «sin cuenta asignada», «cuentas que ya no están en el
  conjunto» y «cobrado en Cartera sin asiento en el libro». **El total sale de
  `computeFundPosition`**, con las mismas entradas que «Libro y fondos»:
  `repartirRecaudo(statements).total` y `sumarSaldoInicial(saldos)`. `sinExplicar` es lo que
  quede entre las dos formas de contar, y se enseña si no es cero.
- **El signo de cada movimiento sale de `movimientoEntraAlFondo`**, que ya existía: un
  reverso conserva el tipo del asiento que anula y lleva el importe en negativo, así que el
  reverso de un recaudo SALE y el de un gasto ENTRA.
- **Solo lee.** No toca reglas ni escribe nada: en esta entrega no hay colección nueva.
- La página pinta lo leído **atado al conjunto que lo pidió**, para que al cambiar de conjunto
  no enseñe los datos del anterior —la lección del campo de lectura de `FEAT-008`—.

### La falsación

| Mutación | Lo que enrojeció |
|---|---|
| `RN-04` · el total sumado a mano en vez de `computeFundPosition` | 5 pruebas, las del total y las de cuadre |
| El signo solo por el tipo del asiento | 5, entre ellas las dos cuentas |
| El recaudo del libro sin sus reversos | 4, empezando por «cobrado sin asiento» |
| La página calcula el fondo por su cuenta | El guardián |
| Control: un comentario que nombra `computeFundPosition` | **Nada, como debe** |

> «Santa María en pequeño» sigue en verde con la mutación de `RN-04`, y no es hueco: cuando
> Cartera y el libro coinciden, sumar a mano da el mismo total. La falsación la cazan las
> otras cinco.

**Un guardián del proyecto corrigió la página:** `las-dos-medidas` enrojeció con un
`max-w-[60ch]` escrito a mano — el ancho de lectura vive en `--medida-lectura`.

Conteos: `npm test` **1849 → 1863** (12 de la función pura y 2 del guardián); functions
**856**, sin cambio.

### La predicción, escrita antes de mirar la pantalla

Leída en la base de staging con la misma regla de signo:

- **Conjunto Las Playas:** una cuenta —«Cuenta operativa», BBVA México, corriente— con saldo
  inicial **$85,000**, entradas **$127,500**, salidas **$137,800** y saldo **$74,700**
  (53 movimientos). Sin cuenta: **$0 en 2 movimientos**. Si el saldo de fondos es el de
  Reportes —$74,700—, «cobrado sin asiento» tiene que dar **$0**.
- **Santa María en staging:** 0 cuentas y 0 asientos. El caso de «cuenta registrada que
  ningún asiento lleva» solo existe en producción.

## Puertas

| Puerta | Estado |
|---|---|
| **`G0` Necesidad** | ⚠️ **Débil, y superada por DECISIÓN, no por dolor.** La administradora no la pidió; son `C7` y `C8`, P2. David decidió el 10 sep construirla para llegar listos, como `FIN-002` |
| **`G1` Valor** | ✅ Baseline 0: no existe saldo por cuenta, ni traspasos, ni caja |
| **`G2` Datos y permisos** | ✅ Dos colecciones nuevas, solo del administrador. **Sin tocar `bankAccounts` ni la consulta del residente** |
| **`G3` Riesgo** | ✅ Medio, contenido: el libro no se toca (`RN-01`) |
| **`G4` Aceptación** | ✅ Veinte criterios, **ocho que deben fallar**, dos de ellos mutaciones |
| **`G5` Operación** | 🟡 El dueño existe —el administrador— pero **ningún conjunto tiene dos cuentas ni caja chica**. La entrega 1 sirve igual |
| **`G6` Escala** | ✅ Decenas de traspasos al mes por conjunto. Sin problema |

> **LISTA PARA DESARROLLO**, con `G0` superada por decisión y dicho en voz alta. Ningún `TBD`
> bloquea la entrega 1.
