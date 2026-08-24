# Llevar `FLOW-002` a producción — los cuatro pasos, en orden

**Escrito el 24 de agosto de 2026, con todo listo y verificado en staging.** Existe porque el
orden **no es el habitual de tres pasos**: hay uno nuevo delante, y hacerlo después deja una
ventana en la que un residente lee el saldo del conjunto.

`origin/develop` = `218383b` · `origin/master` = `5d6df95` (producción). **No divergen**: `master`
es ancestro estricto, así que el delta es exactamente `FLOW-002` A + B.

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
anticipo de 60—. `producto-pago-multiple` puede ir sola o después; sin la primera, el sobrante de
un reparto vuelve a evaporarse.

## Un hueco conocido que NO bloquea esto

`writeAuditLog` audita **fuera** de la transacción y revienta con un campo `undefined`, dejando la
operación hecha y la llamada en error. Está **mitigado desde el cliente** —siempre se manda
`statementId`— así que la aplicación no lo dispara. Sigue abierto para cualquier otro llamante y
el arreglo va en `functions/`. Detalle en `docs/pendientes.md`.
