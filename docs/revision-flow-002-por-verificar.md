# Revisión de `FLOW-002` — CERRADA: 36 ciertas y resueltas, 1 descartada

> **CERRADA del todo el 24 de agosto de 2026.** Las 37 se triaron: **36 eran ciertas y están
> resueltas** —35 con código y la última con una decisión de David, cerrarle la lectura al consejo—
> y **una se descartó** con números: el polvo del sobrante, que `aMoneda` ya había matado. **No
> queda ninguna abierta.** Este documento se conserva como registro de cómo se triaron, no como
> lista de trabajo.

**Lo que había que leer antes de tocar una** — y se conserva porque la advertencia era buena aunque
el resultado la desmintiera: esta lista NO era una lista de defectos, sino de **sospechas sin
confirmar**, y tratarlas como certezas es la forma más rápida de perder un día arreglando cosas que
no existen. **Resultó que 35 de 37 existían**, lo cual dice más del revisor que del método: la
predicción de que la mitad se descartarían no se cumplió ni de lejos. **Reproducir antes de arreglar
sigue siendo la regla** — y fue lo que puso número a cinco de ellas, y lo que descartó la única que
no era real.

## De dónde sale, y por qué no está verificada

Revisión adversarial de todo lo que entró a producción el 24 de agosto de 2026 (`5d6df95..`),
con seis lentes independientes —aritmética del dinero, transacciones, reglas, el «% de recaudo»,
el front, y la coherencia de la documentación— y **tres jueces por hallazgo, cada uno con una
lente distinta**: reproducirlo leyendo el código, buscar si ya está cubierto por otra guarda, y
comprobar si es una decisión deliberada del proyecto.

**La fase de verificación se cayó.** De 117 agentes, 59 murieron con `529 Overloaded`, y casi
todos eran jueces. Solo **un** hallazgo llegó a tener sus tres votos:

> **La comprobación de R1 era tautológica y, con centavos, abortaba pagos legítimos.**
> Confirmado 3/3, reproducido y medido a mano, y **corregido y desplegado** (`e10ae1a`), junto
> con su hermano `sumaAsignada > monto`. Ver `functions/src/payments.ts` → `aMoneda` y
> `TOLERANCIA_MONEDA`.

**Ya no queda ninguna con un solo par de ojos** — doce eran de documentación y se verificaron y resolvieron el 24 de agosto (ver la sección de abajo). Un hallazgo de un solo revisor sin refutar es
una hipótesis: este mismo ejercicio produjo, con jueces, un descarte por cada confirmación.

## Cómo acabó, y las cinco cosas que enseñó

**El recuento final:** 12 de documentación (ciertas), 23 de código ciertas y corregidas, 1
resuelta por decisión de producto, 1 descartada. Cinco se midieron con números en vez de razonarlas.

1. **El punto ciego estaba escrito en el propio banco de pruebas, tres veces.** El test de «con la
   bandera apagada no cambia un solo número» usaba la forma que no puede fallar; «ni el consejo, ni
   la portería» existía solo para `bankAccountBalances`; y las pruebas de `aplicarAjustes` solo
   ajustaban cargos que la propuesta ya incluía. **Al revisar una guarda, buscar la forma que las
   pruebas NO ejercitan.**
2. **Un espejo que se queda atrás no duele hasta que alguien lee el documento.** R12 se aplicó en
   `src/` y no llegó a `functions/`; **R16 repitió la historia exacta un día después**. Ahora hay
   tres espejos vigilados en `tests/flow-002-espejos.test.ts`, que lee los ficheros como texto.
3. **El dinero con centavos no se comporta como el entero, y hay que MEDIRLO.** Dos sospechas se
   convirtieron en porcentajes al barrer 20.000 combinaciones: 3,0 % de los anticipos descruzados
   quedaban imposibles de anular, 2,1 % de los cruces dejaban el cargo «pendiente» con 0,00. Leer el
   código no da esos números.
4. **Probar una regla contra el emulador encuentra lo que leerla no ve, y en las dos direcciones.**
   Al comprobar que el veto de `sourceType` dejaba pisar un asiento apareció el problema contrario y
   más caro: **la conciliación no podía casar ni un pago**, porque en un `update` con merge la regla
   ve el documento resultante. Eso no estaba en ninguna de las 37.
5. **Hay defectos que ya estaban muertos.** El polvo del sobrante lo mató `aMoneda` sin que nadie lo
   buscara. **Descartar también es un resultado**, y se anota.

## Las dos «gordas»: verificadas el 24 de agosto, y las DOS eran ciertas

**Se reprodujeron antes de tocar nada, y las dos se sostuvieron.** Detalle en cada entrada tachada
más abajo; lo que hay que llevarse:

- **El anticipo con la bandera apagada era real, y aparece DOS VECES en las listas** (una en ALTA y
  otra en MEDIA, por lentes distintas). Al contar cuántas quedan, no son dos hallazgos.
- **`bankAccounts` abierta a la portería era real**, y la sospecha acertó también el diagnóstico:
  incoherencia con el comentario de la regla de `advances`.
- **Estaba viva pero dormida.** Se leyeron las banderas de los dos ambientes en vez de suponerlas:
  en producción `producto-pago-multiple` no tiene ni documento ni override, así que la combinación
  peligrosa no se daba. **Se daba al seguir el runbook**, que autorizaba encender múltiple sola, y
  **al hacer el rollback documentado**. Las dos cosas están corregidas.
- **El método que las cazó, en las dos, fue el mismo:** buscar la forma que el banco de pruebas
  NO ejercita. El test de «bandera apagada» usaba la forma vieja; el de «ni el consejo, ni la
  portería» existía solo para `bankAccountBalances`. **El punto ciego estaba escrito en el propio
  banco.**

## Cómo trabajarlos

1. **Reproduce antes de arreglar.** El único confirmado se sostuvo porque se midió: 2,2 % de los
   sobrepagos con centavos, 0 con enteros. Si un hallazgo no se puede reproducir, se descarta y se
   anota que se descartó.
2. **Los de documentación son los más baratos y los más probables**, porque los escribí yo hoy y
   la sesión terminó con cuatro cabeceras que se pisan entre sí. Empieza por ahí: son verificables
   leyendo, sin ambigüedad.
3. ~~**Ojo con dos que, si son reales, son de las gordas.**~~ **HECHO el 24 de agosto: las dos eran
   ciertas y están corregidas** — ver la sección de arriba. No hay que volver a mirarlas.
4. ~~**Vuelve a correr la revisión con los jueces.**~~ **Ya no hace falta: se triaron todas a mano.**
   La fase de jueces existía para separar lo real de lo plausible; con 35 de 37 confirmadas
   reproduciendo, el filtro habría descartado poco y costado mucho.

## Las doce de documentación: verificadas y resueltas el 24 de agosto de 2026

Aparecen tachadas más abajo. **Se verificaron leyendo, que es lo que las hacía baratas**, y las doce
eran ciertas — lo cual dice algo del revisor de esa lente y también de mí: **las escribí yo esa misma
noche**, y una sesión que reescribe cuatro cabeceras a mano termina con las cuatro pisándose.

**Tres no eran de redacción y se quedan como pendientes de código**, ahora sí registradas en
`docs/pendientes.md` y en la PRD:

- **§9 y CA13 no están construidos** — el aviso al residente no nombra los cargos cubiertos ni el
  saldo a favor. Y el documento decía «no queda nada sin mirar»: CA13 no se miró **porque no existe**.
- **CF8 no se cumple** — las callables no comprueban si el conjunto está `suspended`, y usan el Admin
  SDK, que no pasa por las reglas. Anterior a la ficha; esta lo amplía.
- **`personId` del anticipo no lo escribe nadie**, y §7.6 construye una retención encima.

**Y de las cabeceras salió una decisión:** dejan de llevar el número de commit a mano. Se quedaron
cortas tres veces en una noche, y una cabecera que hay que actualizar en cada push acaba mintiendo.
Ahora dicen que se lea `git ls-remote`.

### Sospechas de gravedad ALTA — **ninguna sin verificar**
- ~~**El informe mensual automático sigue con la fórmula vieja del «% de recaudo»**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `functions/src/index.ts` · `monthlyFinancialArchive`
  **Era cierta, y eran TRES sitios**: el XLSX del histórico de cartera, y el resumen del comité en
  XLSX y en PDF. Los tres calculaban `Σ paymentAmount / Σ amount`, que es justo la fórmula que R16
  sustituyó. **Es la misma historia que el comentario de `esRecaudoDeCartera` ya cuenta con R12:**
  la regla se aplicó en `src/` y nunca llegó a `functions/`. Corregido con un espejo nuevo
  (`montoLiquidadoDelCargo` / `montoFacturadoDelCargo`) y una prueba que lo vigila. **Y con el
  gemelo**: `handleSaveCarteraHistory` producía un fichero con el mismo nombre y las mismas
  columnas con el otro número dentro.
- ~~**El ajuste a mano de un cargo sin línea propuesta se acepta en pantalla y se tira al enviar**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `src/features/billing/reparto.ts (y su uso en src/components/features/finanzas/RecordPaymentModal.tsx)` · `aplicarAjustes / RecordPaymentModal (bloque de líneas editables)`
  **Era cierta.** La pantalla pinta la casilla para **todo** cargo marcado —tenga línea propuesta o
  no— y `aplicarAjustes` recorría solo `sugerido`, así que lo escrito sobre un cargo sin línea no
  llegaba a `lineas`: el administrador veía su número, el botón activo, y el cargo salía sin
  cobrar. Ahora se añade al final. **Vacío y cero siguen sin crear línea**, y esa contraparte
  también está probada: el servidor rechaza toda línea que no sea mayor que cero.
- ~~**La pantalla anuncia el importe entero como sobrante mientras la vista previa no ha llegado, y para siempre si falla**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `src/components/features/finanzas/RecordPaymentModal.tsx` · `RecordPaymentModal — bloque `{cuadra && reparto.sobrante > 0 ? ... : null}` junto con `aplicarAjustes``
  **Era cierta, y las dos mitades.** El sobrante se calcula contra la propuesta del servidor, y
  antes de que llegue la lista está vacía: al abrir el cobro, durante el viaje de red, la pantalla
  anunciaba «Sobran $140.000: quedarán como saldo a favor» sobre un pago que no dejaba nada a
  favor. Y el `.catch` dejaba `sugerido` vacío **sin decirlo**, así que el aviso se quedaba puesto.
  **Lo que lo hacía difícil: una propuesta vacía es un estado legítimo** —CA8, el pago que se va
  íntegro a anticipo—, así que «la lista está vacía» no servía como señal. Corregido con un estado
  explícito (`EstadoPropuesta`) y una función pura probada, `avisoDelSobrante`; el fallo ahora se
  dice en pantalla.
- ~~**El anticipo se crea aunque `producto-anticipos` esté apagada**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `functions/src/payments.ts` · `aplicarPago — el bloque `if (sobrante > 0)``
  **Era cierta.** El comentario decía que con la bandera apagada `sobrante` queda en cero «por
  construcción», y lo era **solo para la forma vieja** (`statementId` + `amount`), que es la única
  que probaba el banco. Con `allocations` sumando menos que lo pagado —cosa que R7 permite a
  propósito— nacía el anticipo. Medido con el emulador: dos cargos de 70.000 y un pago de 200.000
  con `producto-pago-multiple` encendida dejaban un anticipo de 60.000 **inoperable**. Arreglado
  rechazando el cobro (`invalid-argument`), con un invariante dentro de la transacción y el botón
  bloqueado en la pantalla.
- ~~**El roadmap dice «Producción no se ha tocado» y FLOW-002 está en producción**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `docs/roadmap-producto.md` · `## Estado de esta revisión → fila «Estado» (v0.9.22, 24 ago)`
- ~~**La PRD deja como «Abierta» la vista previa del reparto, que ya la calcula el servidor**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `docs/prd/funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md` · `Tabla de cabecera → fila «Estado» («**Abierta:** §11.3 …»)`
- ~~**La PRD y el runbook dan por vivo el defecto de writeAuditLog, que está corregido y desplegado**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `docs/despliegue-flow-002-produccion.md` · `## Un hueco conocido que NO bloquea esto`
- ~~**El índice de PRD dice que falta el front de FLOW-002 y que producción está sin tocar**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `docs/prd/README.md` · `Tabla de PRD funcionales → fila «PRD-V-FLOW-002 — Anticipos y aplicación del pago a varios cargos»`
- ~~**Las cabeceras de CLAUDE.md y pendientes.md dan commits que ya no son los de los remotos**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `CLAUDE.md` · `## Estado actual — lo primero, y lo que más cambia (primer párrafo)`

### Sospechas de gravedad MEDIA — **todas verificadas**
- ~~**El «Histórico de cartera» que exporta /admin/billing contradice el «% recaudo» de su propia pantalla**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `src/app/(admin)/admin/billing/page.tsx` · `handleSaveCarteraHistory`
  **Era cierta, y es el gemelo del hallazgo ALTA de arriba**: mismo nombre de fichero, mismas
  columnas, misma fórmula vieja. Se arreglaron los dos a la vez porque arreglar uno solo dejaría
  dos versiones del mismo documento discrepando. Ahora los dos usan la fórmula única de
  `collection.ts` y exponen **recaudado y liquidado por separado**, que son dos preguntas
  distintas.
- ~~**En /admin/billing conviven dos «% recaudo» con el mismo rótulo y distinta fórmula**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `src/app/(admin)/admin/billing/page.tsx` · `campaignRows`
  **Cierta.** El de la tabla de campañas era `recaudado / emitido` y el StatTile de la misma pantalla mide liquidación: dos porcentajes distintos con el mismo nombre a un palmo. Ahora los dos salen de `collection.ts`.
- ~~**El reporte de comité pinta una línea de «% recaudo» que contradice sus propias barras y no expone lo liquidado**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `src/features/reports/use-committee-report.ts` · `useCommitteeReport (trends.byMonth y executive.collectionRate)`
  **Cierta.** Las barras son `facturado` y `recaudado` y la línea mide liquidación, así que un mes saldado con anticipos deja la barra verde corta y la línea al 100 % sin nada que lo explique. `byMonth` expone ahora `liquidado` y el tooltip lo enseña, como ya hacía el de Cartera.
- ~~**Se puede enviar el reparto de la propuesta anterior: desmarcar un cargo y registrar antes de que llegue la nueva vista previa**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `src/components/features/finanzas/RecordPaymentModal.tsx` · `RecordPaymentModal — efecto de `previewPaymentAllocationCallable`, `reparto`, `cuadra` y `handleSubmit``
  **Cierta.** La propuesta anterior se conserva a propósito para no parpadear, y el botón seguía activo durante los 400 ms de respiro más el viaje de red: se podía imputar dinero a un cargo recién desmarcado. Ahora `allocations` solo viaja con la propuesta recibida, y el botón espera.
- ~~**El efecto de reset depende de `people`, una suscripción viva: cualquier cambio en personas borra el formulario abierto y saca de la pantalla del recibo**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `src/components/features/finanzas/RecordPaymentModal.tsx` · `RecordPaymentModal — `useEffect(..., [open, statement, people])``
  **Cierta.** Otro administrador editando un teléfono devolvía un array nuevo, el efecto se reejecutaba y borraba el formulario abierto —y ponía `createdVoucher` a `null`, sacando de la pantalla del recibo a quien lo estuviera mirando—. Las personas pasan a una `ref`: solo se usan al abrir.
- ~~**La cuenta bancaria que declaró el residente puede estar inactiva: el select sale en blanco y la aprobación falla sin causa visible**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `src/components/features/billing/PaymentReceiptsReviewPanel.tsx` · `PaymentReceiptsReviewPanel — `cuentaElegida` y el `<select>` alimentado por `bankAccountsActivas``
  **Cierta.** El desplegable solo ofrece las activas, así que un id dado de baja no casaba con ninguna opción y salía en blanco; si el revisor no lo tocaba, el servidor rechazaba con «esa cuenta bancaria está inactiva». Ahora no se preselecciona y se dice en pantalla por qué.
- ~~**Las claves de idempotencia de pagos no llevan el conjunto, y el atajo idempotente no comprueba el tenant**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `functions/src/payments.ts` · `aplicarPago y revertirPago — `opRef`/`revRef` y sus salidas tempranas `if (opSnap.exists)` / `if (revSnap.exists)``
  **Cierta, y `advances.ts` es el gemelo que lo hace bien** —sus claves sí llevan el `tenantId`—. No se puede cambiar el id del documento sin dejar inalcanzables las marcas ya escritas en producción, y con ellas la reversión de todos los pagos que hay. Lo que faltaba y sí se puede es **comprobar el conjunto antes de devolver el resultado**.
- ~~**Se crea un anticipo con `producto-anticipos` APAGADA, y nace congelado**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `functions/src/payments.ts` · `aplicarPago — `if (sobrante > 0) { … tx.set(advanceRef, …) }`, sin guarda de la bandera `anticipos``
  **Es la misma que la de gravedad ALTA, contada dos veces** por dos lentes distintas — conviene
  saberlo al contar cuántas quedan. Y la parte de «nace congelado» también se comprobó: las tres
  callables de `advances.ts` exigen la bandera, así que ese anticipo no se podía cruzar, ni anular,
  ni deshacer.
- ~~**CF3 compara `remaining` y `amount` con igualdad exacta: un anticipo cruzado y descruzado ya no se puede anular**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `functions/src/advances.ts` · `anularAnticipo — `if ((advance.remaining ?? 0) !== (advance.amount ?? 0)) throw failed-precondition("Ese anticipo ya se aplicó a algún cargo…")``
  **Cierta y medida: 603 de 20.000 combinaciones con centavos, un 3,0 %.** Reproducida de punta a punta — 21,99 cruzado 3,74 y descruzado vuelve como 21,990000000000002, y anular respondía «ya se aplicó a algún cargo», que era mentira y no tenía salida. Se redondea la aritmética del cruce y CF3 pasa a comparar con tolerancia, que además rescata a los que ya están escritos así.
- ~~**`sobrante > 0` sin umbral crea anticipos y asientos de polvo (~1e-13)**~~ · **DESCARTADA** el 24 ago 2026
  `functions/src/payments.ts` · `aplicarPago — la guarda `if (sobrante > 0)` que decide crear `advances` + el `ledgerEntries` de `category: "anticipo"``
  **No se sostiene, y conviene saber por qué:** `sobrante` ya pasa por `aMoneda`, que redondea al céntimo, así que un residuo de 1e-13 sale exactamente 0 y no entra en el `if`. Lo mató el arreglo de los guardianes de R1 (`e10ae1a`) sin que nadie lo buscara. Comprobado con números, no leyendo.
- ~~**La PRD nombra dos banderas que no existen**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `docs/prd/funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md` · `§11.4 Índices, jobs y banderas → viñeta «Banderas»`
- ~~**CA13 y §9 (el aviso con los cargos cubiertos y el saldo a favor) no están construidos y ningún documento lo registra**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `docs/pendientes.md` · `«No queda nada de `FLOW-002` sin mirar.» (sección «EL PORTAL DEL RESIDENTE — VALIDADO»)`
- ~~**pendientes.md declara pendiente en producción la migración de saldos que su propia cabecera da por hecha**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `docs/pendientes.md` · `### Lo que hizo falta y la PRD no preveía → «El orden de despliegue importa…»`
- ~~**§7.5 y CF8 prometen que un conjunto suspendido queda en solo lectura, y las callables de anticipos no miran el estado del conjunto**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `docs/prd/funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md` · `§7.5 Multi-tenancy y ciclo de vida / CF8`
- ~~**El consejo gana detalle financiero POR UNIDAD que el resto del modelo le niega, y sin bandera**~~ · **RESUELTA** el 24 ago 2026, por decisión de David
  `vivaru/firestore.rules` · `match /advances/{docId} y match /advanceApplications/{docId} — la cláusula tenantRole(resource.data.tenantId, 'committee') del allow read`
  **El hecho es cierto:** el consejo NO puede leer `billingStatements` (solo administración y el residente de su unidad), pero sí `advances` y `advanceApplications`, que llevan `unitId` y `unitLabel` — así que sabe qué unidad tiene saldo a favor y cuánto. La PRD §3 le da «Total de anticipos del conjunto», que es un agregado, **y una regla de Firestore no sabe agregar**. Las salidas son tres y ninguna es obvia: cerrarle la lectura (hoy no rompe nada, porque `canAccessPath` lo deja solo en `/admin/documents`), construir un documento agregado, o aceptar el detalle y corregir la PRD. **Decisión de David, 24 de agosto: se le CIERRA la lectura**, que hoy no rompe nada —`canAccessPath` lo deja solo en `/admin/documents`, y los únicos consumidores de estas colecciones son `/admin/billing` y `/resident/account`—, y **el total pasa a `PRD-V-PLAT-004`**, que es donde se decide qué pantallas ve. Construir el agregado hoy sería fijar la forma de un dato sin saber quién lo consume. Se revierte con una línea de reglas. La PRD §3 queda anotada para que no prometa lo que no da.
- ~~**bankAccounts se abrió a TODOS los miembros, no solo a los residentes: la portería lee las cuentas del conjunto**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `vivaru/firestore.rules` · `match /bankAccounts/{docId} — la rama (tenantMember(resource.data.tenantId) && resource.data.active == true) del allow read`
  **Era cierta, y la sospecha acertó también el motivo:** incoherencia dentro del mismo cambio. El
  comentario de la regla de `advances`, veinte líneas más arriba, evita `sameTenant` diciendo que
  «eso incluiría a la portería, que según la PRD no ve nada de esto» — y `tenantMember` es
  exactamente eso. Reproducido contra el emulador: la portería leía el documento **y** podía
  consultar la colección en bloque. El consejo también entraba de propina. Corregido a
  `tenantRole(..., 'resident')`. Ninguna pantalla de `/guard` la usaba: el único consumidor de
  `watchActiveBankAccounts` es el portal del residente.

### Sospechas de gravedad BAJA — **todas verificadas**
- ~~**El StatTile «Brecha» conserva el rótulo que el tooltip de su propio gráfico renombró a «Pendiente»**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `src/app/(admin)/admin/billing/page.tsx` · `trendSummary / StatTile label="Brecha"`
  **Cierta.** Mismo número, dos nombres, en la misma pantalla. Ahora los dos dicen «Pendiente».
- ~~**Estados de la vista previa que no se limpian: «Calculando…» se queda encendido y `sobranteSeraAnticipo` sobrevive al cierre del diálogo**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `src/components/features/finanzas/RecordPaymentModal.tsx` · `RecordPaymentModal — `calculando`, `sobranteSeraAnticipo` y la rama de guarda del efecto de vista previa`
  **Cierta las dos mitades.** La rama de guarda del efecto devolvía sin apagar `calculando`, así que borrar el importe con una propuesta en vuelo dejaba «Calculando…» encendido sin nada calculándose; y el reset no tocaba `sugerido`, `sobranteSeraAnticipo` ni `calculando`, que sobrevivían al cierre. Se limpian los cuatro.
- ~~**El mensaje que bloquea el botón dice «suma más que el importe» también cuando el problema es una línea en cero**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `src/features/billing/reparto.ts (mensaje en src/components/features/finanzas/RecordPaymentModal.tsx)` · `repartoCuadra / el aviso `!cuadra` de RecordPaymentModal`
  **Cierta.** `repartoCuadra` devolvía `false` por dos motivos y la pantalla enseñaba el segundo para los dos, mandando a buscar el error donde no estaba. Se separa el motivo en `motivoDeNoCuadrar`, que se puede probar sin pintar nada.
- ~~**Revertir un pago que se fue entero a anticipo escribe un asiento de importe cero**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `functions/src/payments.ts` · `revertirPago — el respaldo `const reparto = Array.isArray(op.allocations) && op.allocations.length > 0 ? … : [{ statementId, ledgerEntryId, amount: montoDeCartera }]``
  **Cierta, reproducida en el emulador:** el libro quedaba con `ingreso: 0` y categoría «alicuota». Un pago sin cargos pendientes (CA8) guarda `allocations: []` y `appliedToStatement: 0`, y el respaldo del reverso fabricaba una línea de cero. El dinero se revierte donde de verdad está, en el asiento del anticipo (R15).
- ~~**Cruzar un anticipo cubriendo la deuda entera puede dejar el cargo en «pendiente» con saldo de 0,00**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `functions/src/advances.ts` · `cruzarAnticipo — `const cruzadoDespues = cruzadoAntes + aplicado` pasado a `calcularSaldo` (cuyo umbral es `bruto > 0`, en functions/src/payments.ts)`
  **Cierta y medida: 426 de 20.000, un 2,1 %.** `calcularSaldo` decidía sobre una resta sin redondear y el residuo de ~3,5e-15 impedía el `paid`. Se redondea al céntimo **en los dos espejos**, con su prueba de no divergencia. Con COP, que es entero, no cambia ni un resultado.
- ~~**§11.4 declara dos índices compuestos que no se crearon y que el código dice no necesitar**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `docs/prd/funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md` · `§11.4 Índices, jobs y banderas → viñeta «Índices»`
- ~~**El contrato de datos dice que el servidor escribe personId en el anticipo, y nadie lo escribe**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `docs/prd/funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md` · `§7.1 Colección nueva: `advances` (fila `personId`) y §7.6 Retención y borrado`
- ~~**El runbook describe un delta a producción que no es el que se desplegó**~~ · **VERIFICADA Y RESUELTA** el 24 ago 2026
  `docs/despliegue-flow-002-produccion.md` · `Cabecera («`origin/develop` = `218383b` · `origin/master` = `5d6df95`»)`
- ~~**El veto de sourceType no protege el asiento del anticipo frente a una sobrescritura completa**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `vivaru/firestore.rules` · `match /ledgerEntries/{docId} — allow create, update con !(request.resource.data.get('sourceType','') in ['billingStatement','advance'])`
  **Cierta, y probándola apareció el problema contrario, que era peor.** El veto miraba solo el documento entrante: un `setDoc` sin `merge` omitiendo `sourceType` pasaba y permitía pisar el importe. **Y al revés** — en un `update` con merge Firestore evalúa el documento resultante, que sí conserva el `sourceType`, así que marcar conciliado un asiento de pago se **denegaba**; y como desde `FIN-001` todos los asientos de cobro nacen con `sourceType: 'billingStatement'`, **la conciliación no podía casar ni un pago**. La regla mira ahora lo que ya está: si es de origen pago solo se le puede tocar la conciliación, y no se puede borrar.
- ~~**La semilla de trial vuelve a escribir openingBalance dentro de bankAccounts, el campo que la migración sacó de ahí**~~ · **REPRODUCIDA Y CORREGIDA** el 24 ago 2026
  `vivaru/functions/src/trial-seed.ts` · `seedTrialWorkspace — la llamada set("bankAccounts", bankAccountId, { ... openingBalance: 0, active: true, ... })`
  **Cierta.** Escribía un cero, que no filtra nada, pero devolvía el campo al sitio del que `FLOW-002` lo había sacado para poder abrir la lectura al residente — y la siguiente semilla ya no sería un cero. Va a `bankAccountBalances`.
