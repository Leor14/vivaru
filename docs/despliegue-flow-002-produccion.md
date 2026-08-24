# Llevar `FLOW-002` a producción — los cuatro pasos, en orden

**Escrito el 24 de agosto de 2026, con todo listo y verificado en staging.** Existe porque el
orden **no es el habitual de tres pasos**: hay uno nuevo delante, y hacerlo después deja una
ventana en la que un residente lee el saldo del conjunto.

Los cuatro pasos de abajo se ejecutaron el 24 de agosto de 2026 (`70136b9`), y después dos
despliegues más de `functions/`. **Esa ya NO es la punta**: la noche del 24 salió una segunda
tanda, `1a9e022`, con el cierre de la revisión adversarial. **Leer la punta con `git ls-remote`, no
de aquí** — este documento llevó el commit a mano y por eso esta línea llegó a mentir.

> **El paso 1 no se repite.** Mover el saldo inicial de `bankAccounts` a `bankAccountBalances` ya
> se hizo y el script es idempotente, pero la segunda tanda **no lo necesitó**: fueron tres piezas
> (reglas → functions → front), no cuatro. Quien lea esto buscando el guion de un despliegue
> cualquiera: los pasos 2, 3 y 4 son el ciclo normal; el 1 fue de esta migración concreta.

> **Este runbook pasó de plan a REGISTRO.** Se conserva porque el orden que describe es el que hay
> que repetir en cualquier ambiente nuevo, y porque el paso 1 —el que no es obvio— se olvidaría.

**Lo que se desplegó de verdad, y no fue exactamente el delta que este documento anunciaba:**
además de `FLOW-002` A y B fueron los scripts de lectura, el arreglo de `writeAuditLog`, la
callable de vista previa y el arreglo de los dos guardianes de coma flotante. Se anota porque la
cabecera decía «el delta es exactamente `FLOW-002` A + B» y dejó de ser cierto en cuanto la sesión
siguió.

## Lo que va SIN bandera, y hay que saberlo antes de empezar

Las dos banderas (`producto-anticipos`, `producto-pago-multiple`) nacen apagadas y esto **no las
enciende**. Pero seis cosas no van detrás de bandera:

| Qué cambia | Para quién | Riesgo |
|---|---|---|
| El saldo inicial deja de estar en `bankAccounts` | Nadie lo lee hoy | Ninguno, si el paso 1 va antes que el 2 |
| Los residentes pasan a leer las cuentas **activas** de su conjunto | Residentes | **Es la decisión de David del 24 ago.** Ven nombre, banco y número de cuenta; NO el saldo |
| Selector «¿A qué cuenta pagaste?» al subir comprobante | Residentes | Aditivo, opcional |
| Selector de cuenta en el cobro y en la revisión | Administración | Aditivo, opcional |
| El «% de recaudo» mide liquidación | Administración y consejo | **Inerte sin anticipos, y está medido** (`tests/kpi-definitions.test.ts`), no predicho. Producción tiene cero |
| Los mensajes de error del servidor llegan a la pantalla | Todos | Estrictamente mejor |

## Paso 1 · Mover el saldo inicial · **VA PRIMERO**

```bash
node scripts/mover-saldo-inicial-de-cuentas.mjs --proyecto hogaru-1
```

Ensayo. Debe listar **4 cuentas**, una de ellas `tenant-santa-maria · Cuenta Operativa ·
5.000.000` — **ese es el número que este paso protege**. Si lista otra cosa, parar y mirar.

```bash
node scripts/mover-saldo-inicial-de-cuentas.mjs --proyecto hogaru-1 --escribir
```

**Comprobar antes de seguir:** vuelve a correr el ensayo. Tiene que decir `Por migrar: 0`.

## Paso 2 · Reglas

```bash
firebase deploy --only firestore:rules --project hogaru-1
```

Aquí es cuando los residentes ganan la lectura. Si el paso 1 no se hizo, **el saldo queda
legible**. Las reglas nuevas están probadas con emulador, con la forma de consulta real.

## Paso 3 · Functions

```bash
npm --prefix functions run build && firebase deploy --only functions --project hogaru-1
```

**No hay predeploy build**, por eso el `&&`. Verificado el 24 de agosto: compila y sus 466
pruebas pasan.

**Comprobar antes de seguir:** que en `/superadmin/flags` de producción `producto-anticipos` y
`producto-pago-multiple` sigan **apagadas**. Con ellas apagadas, `aplicarPago` se comporta
exactamente como hoy — la firma ampliada es aditiva.

## Paso 4 · Front

```bash
git checkout master && git merge --ff-only develop && git push origin master
```

App Hosting construye solo. **Comprobar que el remoto se movió** (`git ls-remote origin
refs/heads/master`): un push sin cambios responde «success».

## Después, y es lo único que producción aporta

**Que la ruta de un solo cargo siga comportándose igual** (§13 de la PRD). Es un cobro real sobre
un conjunto real, así que **lo hace David, no el agente**: registrar un cobro normal y comprobar
que la cuota, el asiento y el recibo salen como siempre. Si hay que usar un conjunto de ejemplo,
`conjunto-las-playas` existe también en producción.

**Al probar aprobaciones de comprobante, ojo con el correo:** aprobar crea un recibo y
`onPaymentVoucherCreated` **notifica a los residentes de esa unidad**.

## Encender las banderas es OTRA decisión, y va después

Y va **una cada vez**, mirando. `producto-anticipos` primero: cambia un número que ya se mira —un
pago de 200 sobre una cuota de 140 deja de dejar `paymentAmount: 200` y pasa a dejar 140 más un
anticipo de 60—.

**`producto-pago-multiple` puede ir sola, y esta línea decía por qué de forma equivocada.** Decía
que «sin la primera, el sobrante de un reparto vuelve a evaporarse». **No se evaporaba: se
congelaba.** Con múltiple encendida y anticipos apagada, `aplicarPago` creaba un anticipo que
ninguna de las tres callables de `advances.ts` podía cruzar ni anular —todas exigen la bandera—,
así que ese dinero quedaba fuera de alcance mientras la pantalla prometía que se contabilizaba
contra el cargo. Reproducido con el emulador el 24 de agosto de 2026: dos cargos de 70.000 y un
pago de 200.000 dejaban un anticipo de 60.000 inoperable.

**Corregido el 24 de agosto:** con los anticipos apagados, un reparto que no llega al importe se
**rechaza** —`invalid-argument`, y el botón de la pantalla se bloquea antes de enviar—. Así que
múltiple puede ir sola: lo que no se puede, con anticipos apagados, es repartir un pago que deje
sobrante. **Y ojo al rollback:** apagar solo `producto-anticipos` donde múltiple esté encendida era
exactamente la combinación mala; hoy ya no crea nada, rechaza.

## Dos huecos que YA ESTÁN CERRADOS — se dejan escritos porque enseñan algo

**`writeAuditLog` reventaba con un campo `undefined`**, y como audita **fuera** de la transacción,
lo hacía con el dinero ya movido. **Cerrado en la raíz** con `limpiarMetadata`
(`functions/src/audit.ts`), no con `ignoreUndefinedProperties: true` — aquello lo taparía de un
plumazo y a la vez escondería el mismo fallo en todas las escrituras del proyecto.

**Dos guardianes de `aplicarPago` rechazaban cobros CORRECTOS con centavos.** El de R1 era una
tautología: `sobrante` se define como `monto − totalAplicado`, así que la comparación no podía ser
cierta salvo por el error de coma flotante — **saltaba exactamente cuando no había defecto**, y
abortaba la transacción sin dejar marca de idempotencia. Cerrado con `aMoneda` y
`TOLERANCIA_MONEDA`.

**La lección que dejan los dos, y que aplica al siguiente ambiente:** un camino de dinero no
termina en el `commit`. Al revisar uno, listar qué corre **después** —auditoría, correo,
telemetría— y qué pasa si eso falla.

## Lo que queda pendiente de verdad

- **§9 y CA13 no están construidos:** el aviso al residente no nombra los cargos cubiertos ni el
  saldo a favor.
- **CF8 no se cumple:** las callables no comprueban si el conjunto está `suspended`.
- **La revisión adversarial está CERRADA:** `docs/revision-flow-002-por-verificar.md`. De 37, **35 eran ciertas y están corregidas**, una se descartó con números y una espera decisión.
