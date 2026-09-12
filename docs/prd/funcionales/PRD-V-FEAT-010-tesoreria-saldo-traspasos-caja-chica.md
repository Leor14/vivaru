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
| **Estado** | **LAS CUATRO ENTREGAS —1, 2a, 2b y 3— EN PRODUCCIÓN** (10 sep 2026), **y el 11 sep la cuenta de salida en el pago de una cuota** · bandera encendida **solo en Las Playas**, con una demo sembrada; apagada en los otros nueve de producción. En staging, en Las Playas y Santa María. *(Medido el 12 sep 2026 resolviendo conjunto por conjunto. Esta celda decía «los otros ocho» y omitía la entrega del 11.)* |
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
| Sitios que tratan «lo que no es X» como Y | **Dos**: `efectoContable`, en `conciliacion.ts` (todo lo que no es ingreso resta), y `comoAsiento`, en `conciliacion-casos.ts` (todo lo que no es egreso es ingreso) | 🔴 Un tercer tipo se convertiría en gasto o en ingreso **sin avisar**. `RN-01` |
| Cuentas bancarias en producción | **4, una por conjunto** (Santa María, Las Playas, Queretarock, Qintilab); dos son «Banco de ejemplo» | **Ningún conjunto tiene dos cuentas**: los traspasos nacen sobre tabla vacía |
| Asientos con cuenta | **77 de 95**. Sin cuenta: 6 egresos, 4 recaudos, 3 reversos, 1 anticipo, 4 manuales | El saldo por cuenta necesita una línea «sin cuenta asignada». `RN-03` |
| Santa María | Tiene su cuenta (Santander), pero **ninguno de sus asientos la lleva** | Su saldo por cuenta saldrá entero en «sin cuenta» — y es verdad |
| 🔴 **Recaudo en el libro frente a lo cobrado según Cartera** | Coincide en **2 de 7** conjuntos. Santa María: libro $1.120.000, Cartera $2.200.000. Queretarock y Qintilab: libro $0, Cartera **$15.300.000** cada uno | **El saldo de fondos sale de Cartera**, así que un saldo por cuenta sumado desde el libro **no cuadra con el total en cinco conjuntos**. `RN-04` |
| El residente y las cuentas | Las lee con `active == true` (`/resident/account`), para decir **a qué cuenta pagó** | 🔴 **Una caja chica guardada como cuenta bancaria le aparecería como destino de pago.** `RN-08` |
| La conciliación | Busca pareja **solo entre asientos** (`leerCascada`, en `conciliacion-casos.ts`) —al escribir la ficha: la entrega 2b le añadió los tramos de traspaso— | Cada tramo de un traspaso aparecerá en el extracto de su banco. `RN-07` |
| El egreso | ~~Ya elige la cuenta de la que sale~~ **No la elegía**: `bankAccountId` existía en el documento y en el formulario, pero ningún control lo pedía. Lo corrigió la entrega 3 con «Sale de» (ver «Lo que la medición cambió antes de escribir») | Los gastos de la caja chica son **egresos normales** que salen de la caja |

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
| **`RN-10`** (la caja no recibe cuotas) | ~~En la callable del pago~~ **Por construcción** | El plan era una guarda en `aplicarPago`. **Al construir no hizo falta**: `aplicarPago` ya rechaza cualquier cuenta que no esté en `bankAccounts`, y la caja vive en `pettyCashFunds` (ver la entrega 3). Sigue siendo cierto que una regla de Firestore no protege lo que escribe una callable |

### Piezas y el gemelo que ya lo hace bien

| Pieza | Cambio |
|---|---|
| `src/lib/finanzas/tesoreria.ts` | **Nuevo, puro**: `saldosPorCuenta(...)` → filas, sin cuenta, cobrado sin asiento y total. **El total sale de `computeFundPosition`** (`RN-04`) |
| `/admin/finanzas/tesoreria` | Nueva. Gemelo: `/admin/finanzas/presupuesto` |
| `treasuryTransfers` · `pettyCashFunds` | Colecciones nuevas, reglas, y su banco en **las dos listas** de vitest |
| La conciliación | Ofrece los tramos de traspaso como candidatos (`RN-07`) — en los **dos** espejos, `functions/src/conciliacion*.ts` y `src/features/finanzas/conciliacion-reglas.ts` |
| El egreso | Su selector de cuenta incluye las cajas abiertas |
| `payments.ts` | ~~Rechaza una caja como destino (`RN-10`)~~ Sin cambios: ya rechazaba toda cuenta que no esté en `bankAccounts`, así que `RN-10` se cumple por construcción |
| `vocabulario-pais.ts` | «caja menor» / «caja chica» (`RN-12`) |
| Bandera | `producto-tesoreria`, en **los CINCO sitios**. Nació apagada; hoy está encendida solo en Las Playas de producción, la demo |
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
esta vez**: la guarda de `RN-10` está en `aplicarPago`. *(Así se planeó. Al construir, `RN-10` se
cumplió sin servidor y la entrega 3 no desplegó functions; sí las desplegaron la 2b y la entrega del
11 sep.)*

### Rollback

Por bandera en lo que se ve. Los traspasos y las cajas quedan guardados; **no alteran el
estado financiero** porque nunca entraron en él (`RN-01`).

### Story Map

| Entrega | Qué | Por qué en este orden |
|---|---|---|
| **1** | Saldo por cuenta, con las dos líneas que lo hacen cuadrar | Es la base, y **sirve sola**: hoy nadie sabe dónde está el dinero, y va a enseñar que Santa María no asignó cuenta a ningún asiento |
| **2a** | Traspasos, anulables | Sin el saldo, un traspaso no mueve nada visible |
| **2b** | La conciliación de sus tramos (`RN-07`) | **Partida el 10 sep por decisión de David**: toca las cinco funciones de conciliación de `FLOW-004`, que está en producción |
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

### Vista en staging, contra la predicción (10 de septiembre de 2026)

| Línea, en Conjunto Las Playas | Predicción | Pantalla |
|---|---|---|
| Cuenta operativa · BBVA México · corriente | 85,000 · 127,500 · 137,800 · **74,700** | $85,000.00 · $127,500.00 · $137,800.00 · **$74,700.00** |
| Sin cuenta asignada | $0 en 2 movimientos | $0.00 en 2 movimientos |
| Cobrado en Cartera sin asiento | $0 | $0.00 |
| **Total** | 74,700 | **$74,700.00**, y sin línea de «sin explicar» |

- **`CA2`**: «Libro y fondos» dice **SALDO DE FONDOS $74,700.00**, el mismo número.
- **`CA3`**: los dos movimientos sin cuenta son un pago de multa de **+$500.00** y su reverso,
  **−$500.00** — el reverso sale con el signo bueno, que es lo que protege
  `movimientoEntraAlFondo`.
- **Sin cuentas** (Santa María en staging, que no tiene ni cuentas ni asientos): «Este conjunto
  no tiene cuentas bancarias registradas. Todo su dinero aparece en las líneas de abajo», todo
  en cero y en el formato de moneda del conjunto.

**En producción el 10 sep** (`5842e33`), con la bandera **apagada en los nueve**: solo front, sin
reglas. Queda verla en Santa María de producción, donde el saldo por cuenta saldrá casi entero
fuera de las cuentas — leído en la base: Santander con $5.000.000 y **cero** movimientos, y
−$6.475.000 en 13 movimientos sin cuenta.

## 15 · La entrega 2a: los traspasos (10 de septiembre de 2026)

### Por qué la entrega 2 se partió

Medir antes de escribir código mostró que **`RN-07` no es añadir un candidato**: la conciliación
empareja **línea del extracto ↔ asiento del libro** en cinco funciones de servidor (asegurar,
aplicar, rechazar, reabrir y liberar, con sus cascadas), guarda `matchedLedgerEntryId` en la
línea con las reglas vetando al cliente tocarlo, y tiene un espejo en el front vigilado por su
propia prueba. **Todo en producción** (`FLOW-004`), con ~87 pruebas encima. Un segundo tipo de
pareja toca ese circuito entero y exige desplegar functions — y **hoy ningún conjunto tiene dos
cuentas**, así que ningún traspaso llegaría a conciliarse todavía.

**Decisión de David:** 2a ahora —los traspasos— y **2b sola después**, con su propia falsación
sobre el circuito vivo. Mientras tanto, la línea del extracto de un traspaso se rechaza con el
motivo «otro» y un texto, que ya existe.

### Lo construido

- **`treasuryTransfers`**: las reglas exigen dos cuentas **distintas que existan y sean del
  conjunto** (leídas con `get()`), valor numérico mayor que cero, fecha con forma de fecha, nacer
  `registrado` con `kind: "traspaso"` —los de la caja chica llegan en la 3— y firma de quien
  escribe. **Al anular no puede cambiar nada más** que estado, quién y cuándo (`hasOnly`), la hora
  la pone el servidor, no se anula dos veces y **no se borra nunca**.
- **`saldosPorCuenta`** mueve las dos cuentas —columna «Traspasos»— y **el total no se entera**,
  porque el traspaso nunca entra en `computeFundPosition`.
- **La página**: «Traspasar» (deshabilitado con menos de dos cuentas activas, diciendo por qué),
  aviso si el origen queda en negativo sin bloquear (`RN-09`), y lista con «Anular» y confirmación.
- **Guardián de `RN-01`**: siete consumidores del libro —los dos núcleos, el informe mensual, el
  informe del consejo, el estado financiero, el libro y el presupuesto— no pueden nombrar
  `treasuryTransfers`.

### La falsación

| Mutación | Lo que enrojeció |
|---|---|
| Reglas · el bloque entero | Las 4 positivas, ninguna denegación |
| Reglas · origen ≠ destino · valor > 0 · cuenta de destino del conjunto | Cada una, su `CA15` |
| Reglas · nacer registrado · `kind` traspaso · forma de fecha · `createdBy` · `tenantOperable` | Cada una, la suya |
| Reglas · anular sin `hasOnly` · sin `voidedBy` · sin hora de servidor · sin exigir registrado | Cada una, la suya |
| Reglas · permitir borrar | `CA16` |
| Contar los anulados | `RN-05`/`RN-06` |
| Restar del origen sin sumar al destino | `CA4`, `RN-02` y el de la cuenta que ya no existe |
| El informe del consejo nombra `treasuryTransfers` | El guardián |
| Control: un comentario que la nombra | **Nada, como debe** |

Conteos: `npm test` **1863 → 1881**; reglas **404 → 424**, las 20 de traspasos en verde.

### Vista en staging, sobre Las Playas (10 de septiembre de 2026)

Con el visto bueno de David se creó **una segunda cuenta de prueba** —«Cuenta de ahorros (prueba)»,
BBVA México, ahorros, MXN, saldo inicial 0— y un traspaso de prueba que después se anuló.

| | Antes | Con el traspaso | Anulado |
|---|---|---|---|
| Cuenta de ahorros (prueba) | $0.00 | **+$10,000.00 → $10,000.00** | $0.00 |
| Cuenta operativa | $74,700.00 | **−$10,000.00 → $64,700.00** | $74,700.00 |
| Saldo de fondos | $74,700.00 | **$74,700.00** | $74,700.00 |

- **`CA4`** y **`RN-02`**: las dos cuentas se mueven el mismo importe y el total no.
- **`CA5`**, el libro no se entera: con el traspaso registrado, «Libro y fondos» siguió en saldo de
  fondos **$74,700.00**, ingresos por cuotas **$127,500.00** y egresos **$137,800.00** — los mismos.
- **`CA6`**: la confirmación dice «Deja de contar en los dos saldos. ¿Anular?»; anulado, las cuentas
  vuelven y la fila queda **tachada** con «Anulado».
- **En la base**, no en la pantalla: `zswGJzzGaO0SL3khQglt`, `kind: traspaso`, `status: anulado`,
  creado y anulado por la misma cuenta, `voidedAt` puesta por el servidor, y **sin campo
  `reference`** — la referencia vacía no se manda, que es lo que evita que Firestore rechace el
  documento por un `undefined`.

> ⚠️ **La cuenta de prueba es una cuenta bancaria normal y activa**, así que los residentes de Las
> Playas en staging la ven al elegir a qué cuenta pagaron. Es dato de staging; se deja porque sirve
> para la entrega 3.

### Pendiente

- ~~Producción de la 2a~~ **hecha el 10 sep**, en su orden: reglas (ruleset `ecec39a4`, idéntico al
  repo) → front (`480ed9d`, servido por `build-2026-09-11-001`). Bandera apagada en los nueve.
- **La 2b** —conciliar los tramos—. La 3 sigue en §16.

## 16 · La entrega 3: la caja chica (10 de septiembre de 2026)

### Lo que la medición cambió antes de escribir

- **El egreso no elegía cuenta.** §4 daba el selector por hecho —«ya elige la cuenta de la que
  sale»—. El campo `bankAccountId` existe en el egreso y en el formulario (valor inicial y al
  editar), pero **ningún control lo pedía**: los egresos que lo llevan lo traen de la siembra. Sin
  selector, `CA9` era imposible. Se construyó **«Sale de»** en el formulario de egresos, detrás de la
  bandera y solo con el egreso en `pagado`: cuentas activas y cajas abiertas, **más la que ya lleve
  el egreso aunque esté desactivada o cerrada** —si no, el selector la borraría al guardar—.
- **El pago de una cuota de `FLOW-008` tampoco manda cuenta**: `payExpenseInstallment` la acepta y
  la copia sin comprobarla, y el panel de cuotas nunca la envía. **Fuera de esta entrega**: una caja
  chica no paga facturas a plazos. Queda anotado.
- **`RN-10` no necesitó código de servidor.** Los tres caminos por los que entra el pago de un
  residente —el que registra el administrador, el comprobante aprobado y el que declara el propio
  residente— pasan por `aplicarPago`, que ya rechazaba cualquier id que no esté en `bankAccounts`.
  La caja vive en otra colección: **la guarda se cumple por construcción**. `CA17` lo fija con una
  prueba de comportamiento —ni asiento ni cuota tocada— y un guardián vigila la causa.
  **Esta entrega no despliega functions.**

### Lo construido

- **`pettyCashFunds`** (§7): nombre, límite, cuenta de origen, `abierta → cerrada`. Solo la
  administración la lee (`CA13`); no se borra.
- **Cada nombre de traspaso fija de dónde a dónde va el dinero**: `traspaso` banco → banco (igual que
  en la 2a); `apertura` y `reposicion` banco → caja abierta; `cierre` caja abierta → banco.
- **Apertura y cierre van en un lote.** La apertura nace con su caja, así que la regla la mira con
  `getAfter` —con `get` todavía no existiría—. El cierre va en el lote que la cierra: se mira con
  `get`, como estaba antes de escribir.
- **Cerrar exige saldo cero, y eso no lo puede comprobar una regla**: el saldo se suma de egresos y
  traspasos. Lo sostiene la pantalla: con dinero dentro, el cierre lo devuelve al banco en el mismo
  lote; **en negativo no deja cerrar**, porque cerrar escondería la diferencia.
- **El núcleo** (`saldosPorCuenta`) trata la caja como una cuenta más: sin saldo inicial, detrás de
  los bancos, y fuera de la tabla cuando está cerrada y en cero (con saldo sigue, `RN-13`). Sin
  pasarle las cajas, sus gastos caerían en «cuentas que ya no están».
- **`RN-11`, precisado**: «Reponer» propone **el límite menos lo que queda**. Es lo gastado desde la
  última reposición cuando esa la dejó llena —lo normal—; si fue parcial, la propuesta cubre también
  lo que faltó, porque la regla existe para que la caja vuelva a su límite.
- **`RN-12`**: `cajaChica` en `vocabulario-pais.ts` — «caja menor» en Colombia; «caja chica» en
  Ecuador, México y sin país.
- La tarjeta de la caja en Tesorería (abrir; reponer con la propuesta y los avisos de límite y de
  banco en negativo; cerrar), el nombre del movimiento en la lista de traspasos y la fila de la caja
  en la tabla de cuentas.

### La falsación

- **Reglas: 30 mutaciones, 29 en rojo.** La trigésima —quitar `limit is number`— es
  **equivalente**: cualquier no-número hace fallar la comparación `> 0`. Se queda como intención.
- **La falsación cazó dos huecos**, cerrados con pruebas: quitar `name is string` pasaba en verde
  —la prueba usaba `7`, y `7.size()` ya falla; una lista `["Caja"]` sí tiene tamaño—, y dejar una
  caja abierta con fecha de cierre no lo probaba nadie. Se añadió `CA18` para el cierre.
- **Código: 12 mutaciones, 11 en rojo al primer pase.** La que pasó en verde: quitar «bancos antes
  que cajas» — la caja de la prueba se llamaba «Portería» y ya ordenaba detrás por nombre. Prueba
  nueva con una caja «Alcancía».

### La predicción, escrita antes de mirar la pantalla

Las Playas (staging, **México**, bandera encendida, 0 cajas). Con una «Caja de portería» de límite
**5.000** que sale de la *Cuenta operativa*, y un egreso de **800** pagado desde ella:

1. Todo dice **«Caja chica»**.
2. Al abrirla, la operativa baja 5.000 y la caja entra en la tabla con saldo 5.000 y traspasos
   +5.000. **El saldo de fondos no cambia.**
3. En el egreso en `pagado`, «Sale de» ofrece la caja bajo «Caja chica». Pagado desde ella, la caja
   baja a **4.200** y el saldo de fondos baja **800** — el mismo número que en Libro y fondos.
4. «Reponer» propone **800**; registrada, la caja vuelve a **5.000**, la operativa baja otros 800 y
   el saldo de fondos no cambia.
5. En la cuenta del residente la caja **no aparece** entre las cuentas a las que se paga (`CA14`).

### Vista en staging, contra la predicción (10 de septiembre de 2026)

Con permiso de David, el ciclo entero en Las Playas, con su sesión de administradora:

| Paso | Cuenta operativa | Caja de portería | Saldo de fondos | Predicción |
|---|---|---|---|---|
| Antes | $74,700.00 | — | $74,700.00 | |
| Apertura de 5,000 | $69,700.00 (traspasos −5,000) | $5,000.00 (+5,000) | $74,700.00 | ✅ 2 |
| Egreso de 800 desde la caja | $69,700.00 | $4,200.00 (salidas 800) | $73,900.00 — **Libro y fondos: $73,900.00** | ✅ 3 |
| Reponer (propuso **800**) | $68,900.00 | $5,000.00, «en su límite» | $73,900.00 | ✅ 4 |
| Cerrar (devolvió 5,000) | $73,900.00 | fuera de la tabla | $73,900.00 | §6 |

- **Todo dijo «Caja chica»** (✅ 1). «Sale de» apareció solo con el egreso en `pagado`, con dos
  grupos —«Cuentas bancarias» y «Caja chica»— y, **cerrada la caja, dejó de ofrecerla**.
- **Leído de la base, no solo de la pantalla**: el egreso y su asiento llevan en `bankAccountId` el
  id de la caja; la apertura, la reposición y el cierre, su `kind`. **Los dos lotes funcionaron
  contra Firestore real**: la apertura con `getAfter` y el cierre con `get`.
- El punto 5 (`CA14`, el residente) **no se vio en pantalla**: la sesión es de administradora. Lo
  sostienen la regla (el residente no lee `pettyCashFunds`) y el guardián de destinos de pago.

**Mirar encontró dos defectos que ninguna prueba veía**, uno de esta entrega y uno de antes:

- **La historia de la caja salía desordenada**: la lista ordenaba solo por fecha, y la apertura, la
  reposición y el cierre del mismo día salieron como «Apertura, Cierre, Reposición». Ahora, dentro
  del día, por la hora en que se registró (`ordenarTraspasos`, con prueba falseada). **Visto en
  staging con `c1d7282`**: Cierre, Reposición, Apertura, y detrás el traspaso anulado de la 2a.
- **Preexistente, fuera de esta entrega**: el formulario de egresos toma «hoy» en **UTC**
  (`toISOString()`): a las siete de la tarde en México, el egreso y su asiento quedaron con fecha
  **del día siguiente** (`2026-09-11`). A fin de mes, eso cambia el mes del gasto. Propuesto como
  tarea aparte.
- Y uno visual, corregido: el texto de ayuda del límite desalineaba los campos de la apertura.

**Datos de prueba que quedan en staging (Las Playas):** la caja `HDMmec3CyMjnJfqsqUBx` «Caja de
portería», **cerrada**; sus tres traspasos (apertura, reposición y cierre); y el egreso
`n7aHPvUksBG3oa3HFrNz` de 800, **pagado desde la caja**, que baja el saldo de fondos de Las Playas
en 800.

### Producción (10 de septiembre de 2026)

En su orden, **reglas → front**; esta entrega no despliega functions.

- **Reglas**: ruleset `f551b415`, «idéntico al repo: SÍ».
- **Front**: `master` en `c1d7282`, servido por `build-2026-09-11-002`.
- `producto-tesoreria` resuelta con el compilado: **apagada en los nueve**. **0 cajas** en producción.

### Pendiente

- **La 2b** —conciliar los tramos de un traspaso—, en sesión aparte: toca `FLOW-004` en producción.
- El pago de una cuota de `FLOW-008` no manda cuenta (`payExpenseInstallment` la acepta sin
  comprobarla y el panel nunca la pide). Una caja chica no paga a plazos, pero el banco sí.
- El «hoy» en UTC del formulario de egresos: preexistente, propuesto como tarea aparte.

## 17 · La entrega 2b: conciliar los tramos (10 de septiembre de 2026)

### Lo que la medición decidió

- La conciliación empareja **línea del extracto ↔ asiento del libro** en cinco callables —asegurar,
  aplicar, rechazar, reabrir y liberar— con sus cascadas, todo en producción (`FLOW-004`). **Un tramo
  no es un asiento**: `efectoContable` trata todo lo que no es ingreso como salida y `comoAsiento`
  todo lo que no es egreso como ingreso, así que meterlo por ahí lo habría convertido en gasto o en
  ingreso sin avisar (`RN-01`). Tiene tipo propio, `TramoDeTraspaso`, con el efecto **ya calculado**:
  la salida resta y la entrada suma.
- **Ningún conjunto de producción tiene dos cuentas**; en staging, Las Playas (2 cuentas, 22 líneas
  de extracto, 4 traspasos).

### Lo construido

- **El enlace**: la línea guarda `matchedTransferId` y `matchedTransferLeg`; el traspaso,
  `salidaLineId` y `entradaLineId`; el expediente, con quién casó. **El libro no se toca.**
- **La cuenta del tramo es ESTRICTA**, a diferencia del asiento —16 de 93 no declaran cuenta y no se
  descartan—: un traspaso siempre dice las dos. Por eso **el lado de una caja chica nunca casa**: la
  caja no tiene extracto. El lado del banco de una apertura, reposición o cierre, sí.
- **Candidatos**: el servidor y la bandeja cuentan asientos y tramos juntos. Un asiento y un tramo
  del mismo importe son dos candidatos, y con dos no se propone (R4).
- **Anular un traspaso conciliado**: la regla lo veta mientras tenga un tramo casado; la tesorería
  llama antes a `releaseReconciliation` con el traspaso, que suelta los dos tramos y deja cada
  expediente en `reversado` con un motivo nuevo, `traspaso_anulado`. Borrar una línea casada con un
  tramo la reabre antes.
- **Reglas**: el cliente no escribe el enlace con un tramo —ni en la línea ni en el traspaso—, y un
  traspaso no nace con uno puesto.
- **Lo que se ve, detrás de la bandera**: la bandeja solo ofrece tramos con `producto-tesoreria`. La
  coherencia en el servidor va sin bandera, como en `FLOW-004`.

### La falsación

- **23 mutaciones** —siete de reglas, trece del servidor, tres del espejo—: **21 en rojo al primer
  pase**. Las dos que no lo estaban eran **huecos reales**, cerrados con pruebas:
  1. anular con **solo la entrada** casada: la siembra solo tenía la salida;
  2. que liberar **no suelte una línea que ya apunta a otra cosa**. Es alcanzable: el id de una línea
     se deriva de su contenido, así que borrada a mano y reimportada vuelve con el mismo id — y si
     entretanto casó con un asiento, anular el traspaso habría soltado una conciliación ajena.
- Bancos: `npm test` **1935** · functions **870** · reglas **457** · emulador de functions **365 de
  367** (`CA12` y `D-B` de `payments`, preexistentes).

### La predicción, escrita antes de mirar la pantalla

Las Playas (staging). Un traspaso de **1.500** de la *Cuenta operativa* a la *Cuenta de ahorros
(prueba)*, y un extracto de una línea por cuenta: **−1.500** en la operativa y **+1.500** en la de
ahorros, con la fecha del traspaso.

1. Importada, la línea de la operativa nace **propuesta** —un único candidato: la salida del
   traspaso—, y el modal la ofrece como «Traspaso: Cuenta operativa → Cuenta de ahorros (prueba)»,
   **−1.500**.
2. Conciliada, dice «Con el traspaso … · salida», y en Tesorería el traspaso dice «Conciliada la
   salida en el banco». **Ningún asiento nuevo en el libro.**
3. Lo mismo con la línea de ahorros y la **entrada**: «Conciliada la salida y la entrada».
4. Anular el traspaso avisa de que suelta la conciliación; después, las dos líneas vuelven a
   pendientes, cada expediente en `reversado` con `traspaso_anulado`, y ya **sin candidato**.

### Vista en staging, contra la predicción (10 de septiembre de 2026)

Con permiso de David, en Las Playas: reglas `c55fc54a` (idénticas al repo) → las cuatro callables →
front `0f30ea1`. El traspaso `lAFu0QuqyFfJjLLgSUhB` y un extracto de una línea por cuenta, importados
desde la pantalla.

| Punto | En pantalla | En la base |
|---|---|---|
| 1 | Cada línea cayó en «Con un movimiento que encaja (1)»; el modal ofreció **solo** el tramo —«Traspaso: Cuenta operativa → Cuenta de ahorros (prueba)», −1,500.00, «sale de esta cuenta; no es un gasto ni un ingreso»— | Expediente nacido `propuesto` con `candidateTransferLegs` = el tramo |
| 2 y 3 | «Con el traspaso … · salida» y «· entrada»; Tesorería: «Conciliada la salida y la entrada en el banco» | `propuesto → aplicado`; **0 asientos nuevos** en el libro |
| 4 | La confirmación avisó de que suelta la conciliación; anulado, la operativa volvió a 73,900.00 y ahorros a 0.00; las dos líneas, a «Sin movimiento que les corresponda» con «Se deshizo sola» | `aplicado → reversado` con `traspaso_anulado`; el traspaso, sin tramos casados |

**Datos que quedan en staging:** el traspaso anulado y las dos líneas de 1,500, **pendientes**.

### Producción (10 de septiembre de 2026)

En su orden, **reglas → functions → front**:

- **Reglas**: ruleset `f2afe2d9`, «idéntico al repo: SÍ». Solo restringen campos que en producción
  aún no existen, así que ir primero no rompe nada.
- **Functions**: las cuatro que cambian —`reconcileCase`, `reopenReconciliationCase`,
  `releaseReconciliation` y `ensureReconciliationCases`—, las cuatro con «Successful update
  operation».
- **Front**: `master` en `b415636`, servido por `build-2026-09-11-003`.
- `producto-tesoreria` resuelta con el compilado: **apagada en los nueve**. Producción tiene **0
  traspasos y 0 cajas**, así que ningún tramo llegará a la bandeja hasta que haya dos cuentas.

## 18 · El pago de una cuota, con su cuenta — 11 de septiembre de 2026

La entrega 3 construyó «Sale de» en el formulario de egresos y **se dejó fuera el pago de una cuota
de `FLOW-008`**. El panel de cuotas no mandaba cuenta, así que toda cuota pagada quedaba **«sin
cuenta»** en la tesorería (`RN-03`); y el servidor, si le llegaba una, la copiaba **sin
comprobarla**. Dos mitades del mismo hueco, cerradas el mismo día:

| Mitad | Qué | Commit |
|---|---|---|
| Servidor | `comprobarCuentaDeSalida` (`functions/src/egresos-en-cuotas.ts`) la lee **dentro de la transacción**: cuenta bancaria activa o caja abierta, las dos del conjunto. Un id inexistente, ajeno, inactivo o de una caja cerrada se rechaza **sin asiento y con la cuota pendiente** | `63c0fde` |
| Pantalla | El panel de cuotas ofrece «Sale de» con la tesorería encendida, con **la misma regla** que el formulario: `cuentasDeSalida`, que salió de dentro de la página de egresos | `75c346a` |

**No es la función de `aplicarPago`, a propósito**: lo que paga un residente nunca entra a la caja
(`RN-08`), y un egreso sí puede salir de ella (§7). El saldo no se mira (`RN-09`).

**Pruebas:** 8 de emulador y 5 del front, falsadas en 6 y 5 mutaciones. **Visto en staging, antes y
después**, Santa María, «Mantenimiento del ascensor 2026», abriendo el pago de la cuota 1 sin
registrarlo: con `63c0fde` el formulario pedía solo la fecha, **sin «Sale de»**; con `75c346a`
(`build-2026-09-11-023`) aparece «Sale de» con **una sola opción, «Sin indicar»**, que es lo que se
predijo leyendo la base antes de mirar: Santa María no tiene en staging ni cuentas ni cajas. Que
ofrezca las cuentas correctas lo fijan las pruebas; que el selector se esconda con la tesorería
apagada no lo alcanza ninguna (vitest corre sin DOM).

### Y el camino del cliente, en las reglas

**Las reglas de `expenses` y `ledgerEntries` no comprobaban `bankAccountId`**: «Sale de» y los
asientos manuales escriben directo, así que el mismo hueco seguía abierto por el cliente, y
`cuentaDelConjunto` solo la usaban los traspasos y la caja. Cerrado el mismo día
(`cuentaDelMovimientoValida` en `firestore.rules`):

- **al crear**, la cuenta es nula, una cuenta bancaria del conjunto o una caja del conjunto;
- **al editar, solo se mira si la cuenta cambia**: un gasto viejo conserva la suya aunque se haya
  dado de baja;
- **el reverso puede copiar la cuenta del asiento que anula** aunque esa cuenta se haya borrado —las
  reglas permiten borrar cuentas, y negar una anulación por eso sería peor—, pero solo si la copia
  exacta y el original es del conjunto.

**Medido antes de escribirla: 0 egresos y 0 asientos con una cuenta ajena o inexistente**, en los
dos ambientes, así que no deja a nadie fuera. 9 pruebas de reglas contra el emulador, cada
denegación con su pareja positiva. **Es una regla que restringe**: se despliega después del front,
que no escribe cuentas ajenas.

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
