# PRD-V-FLOW-002 — Anticipos y aplicación del pago a varios cargos

| | |
|---|---|
| **ID** | `PRD-V-FLOW-002` (tentativo hasta registrarlo en `docs/prd/README.md`) |
| **Tipo** | `FLOW` — cambia el proceso de cobro de punta a punta, que ya existe y está en producción |
| **Portales** | **`ADMIN`** (alcance) · **`RESIDENTE`** (alcance: ve su saldo a favor e indica a qué cuenta pagó) · `SUPERADMIN` (afectado) · `PORTERIA` (no afectado) |
| **Módulo** | Finanzas · Cartera |
| **Usuario principal** | `tenant_admin` / `admin_tenant` |
| **Usuarios secundarios** | `resident` · `committee` |
| **Responsable** | David |
| **Estado** | **Lista para desarrollo** — versión 1.0. D1 y D2 cerradas por David el 21 de agosto de 2026 |
| **Dependencias** | **Secuencia obligatoria: `PRD-V-PLAT-003` va ANTES.** Las dos modifican `aplicarPago`, que está en producción — aquella cambia **qué valor** escribe en la categoría, esta cambia **su firma**. **No pueden estar en vuelo a la vez.** Si esta va primero, añade el valor `"anticipo"` a un enum que `PLAT-003` sustituye acto seguido |
| **Riesgo** | **Alto.** Modifica `aplicarPago`, que está **en producción y mueve dinero real** |
| **Reversibilidad** | **Parcial.** El anticipo y el reparto se apagan con bandera; el cambio de firma de `aplicarPago` no (§13) |
| **Fase comercial** | Cartera está en `preview` durante la prueba. Ver §7.5 |

---

## 1. Resumen ejecutivo

Hoy, si un residente paga más de lo que debe, **el excedente desaparece**: la cuota queda
pagada, el sobrante se contabiliza como ingreso del período y **no queda saldo a favor en
ninguna parte**. El mes siguiente empieza de cero. Y si paga cuatro meses de una vez —que en
este mercado es lo normal— el administrador tiene que registrar cuatro pagos a mano.

Esta PRD introduce el **anticipo** como saldo a favor de la unidad, permite **aplicar un pago a
varios cargos**, y hace que el pago registre **a qué cuenta bancaria entró**, que hoy no se
guarda.

## 2. Problema y baseline

### Lo que existe hoy, verificado en `functions/src/payments.ts`

| Qué | Dónde | Comportamiento |
|---|---|---|
| Aplicar un pago | `aplicarPago`, línea 156 | Recibe **un** `statementId` y **un** `amount` |
| Aritmética del saldo | `calcularSaldo`, línea 115 | `balance = max(0, cobrado − pagado)` |
| Idempotencia | `operationKey` | Un reintento no duplica el pago ni el recibo |
| Recibo | Línea 296 | **Se emite dentro de la misma transacción** (`FIN-001`, cerrada el 20 ago 2026) |
| Reversión | `revertirPago`, línea 459 | Asiento negativo + `paymentAmount` restaurado |
| Espejo en el cliente | `computeBalanceStatus` en `src/features/finanzas/use-payments.ts` | Duplicado a propósito; **manda el del servidor** |

### Los tres defectos, nombrados

**D-A · El sobrepago se evapora.** Con `pagadoDespues = pagadoAntes + monto` y
`balance = max(0, cobrado − pagado)`, pagar 200 sobre una cuota de 140 deja la cuota en `paid`,
`paymentAmount = 200`, `balance = 0` — y **los 60 sobrantes se contabilizan íntegros como
ingreso del período** con `category: "alicuota"`. No hay saldo a favor ni obligación pendiente.
**El dinero entró y el producto lo olvidó.**

**D-B · Un pago, un cargo.** No existe forma de repartir un pago entre varios cargos. Pagar
cuatro meses son cuatro operaciones manuales, cada una con su recibo.

**D-C · El pago no sabe a qué cuenta entró.** El asiento se escribe con `bankAccountId: null`
fijo (línea 267). La conciliación tiene que adivinar por importe y fecha.

### Baseline

| Indicador | Hoy |
|---|---|
| Saldos a favor registrados | **0. El concepto no existe** |
| Operaciones para cobrar cuatro meses | **4** |
| Pagos con cuenta bancaria identificada | **0 de 0** — el campo se escribe siempre nulo |

**Métrica de éxito:** que un pago superior a lo adeudado deje **saldo a favor visible para el
residente**, y que la suma de lo aplicado más el anticipo generado sea **exactamente** igual a
lo pagado.

## 3. Usuarios, roles y permisos

| Rol | Ve | Puede | **NO puede** |
|---|---|---|---|
| `tenant_admin` | Anticipos abiertos de su conjunto y el saldo de cada unidad | Registrar un pago repartiéndolo entre varios cargos; cruzar un anticipo contra un cargo; anular un anticipo con motivo | Cruzar un anticipo de una unidad contra el cargo de **otra** (§8, R6). Revertir un pago cuyo anticipo ya fue cruzado (R8). Operar si el conjunto está `suspended` o `expired` |
| `resident` | **Su** saldo a favor y de qué pago viene | Consultarlo. **Indicar a qué cuenta bancaria pagó** al subir su comprobante | Cruzar ni anular nada. Ver el anticipo de otra unidad |
| `committee` | Total de anticipos del conjunto | Consultar y exportar | Operar |
| `security_guard` | Nada | — | Acceder |
| `superadmin` | Todo | Todo, incluida la corrección de un anticipo mal creado | — |

> **Nota de portafolio — 21 ago 2026.** Lo que esta PRD asigna al rol `committee` **hoy no es
> alcanzable**: `canAccessPath` (`src/lib/auth/routing.ts:28`) lo deja **solo en
> `/admin/documents`**. A nivel de reglas **sí puede leer** —es miembro del conjunto— así que
> **el bloqueo es de navegación, no de permisos**. Ampliar su alcance merece **PRD propia**:
> decidir qué pantallas ve y comprobar que las reglas no le abran datos personales por el
> camino. **Hasta entonces, las filas de `committee` de esta tabla son intención declarada, no
> capacidad disponible.**


**Por qué el residente no cruza su propio anticipo:** cruzar mueve dinero entre obligaciones.
Que lo haga quien responde de la contabilidad del conjunto, no quien la paga.

## 4. Objetivo, alcance y exclusiones

**Objetivo.** Que el dinero que entra tenga siempre dónde quedarse, y que aplicarlo no dependa
de repetir la operación una vez por cuota.

### Entra

1. **Anticipo** como saldo a favor de la unidad, con historia y trazabilidad.
2. **Anticipo automático** cuando el pago supera lo adeudado.
3. **Anticipo manual**: registrar un pago sin cargo al que aplicarlo.
4. **Cruce** de un anticipo contra uno o varios cargos.
5. **Aplicar un pago a varios cargos** en una sola operación, con reparto sugerido.
6. **Cuenta bancaria en el pago**, y en el comprobante que sube el residente.
7. Visibilidad del saldo a favor para residente y consejo.
8. Anulación de un anticipo con motivo.
9. Reversión coherente: qué pasa al revertir un pago que generó anticipo.

### No entra, y por qué

| Excluido | Por qué |
|---|---|
| **Devolver el dinero de un anticipo** | Es un egreso, no un movimiento de cartera. PRD del lado del gasto |
| **Bandeja de ingresos no identificados** | Backlog `D5`. Un anticipo tiene dueño; un ingreso no identificado, no. **Son problemas distintos y mezclarlos confunde los dos** |
| **Intereses sobre el saldo a favor** | Nadie los paga en este mercado |
| **Caducidad del anticipo** | Requiere decisión legal por país. Anotado, fuera del MVP |
| **Cierre de conciliación** | Backlog `D1–D4`, PRD aparte. Esta solo aporta el `bankAccountId` que aquella necesitará |
| **Cambiar cómo se emite el recibo** | `FIN-001` está cerrada y funciona. **No se toca** |

## 5. Flujo funcional

### 5.1 Registrar un pago que cubre varios cargos

```mermaid
flowchart TD
    A[Admin abre Cartera y elige la unidad] --> B[Marca los cargos a pagar]
    B --> C[Introduce importe, fecha, cuenta bancaria y forma de pago]
    C --> D[El servidor reparte: del más antiguo al más nuevo]
    D --> E[Vista previa: cargo · saldo · a aplicar · sobrante]
    E --> F{¿Ajusta el reparto a mano?}
    F -->|Sí| G[Edita línea a línea; la suma debe cuadrar con el importe]
    F -->|No| H{¿Sobra dinero?}
    G --> H
    H -->|No| I[Se aplica y se emite el recibo]
    H -->|Sí| J[El sobrante se convierte en ANTICIPO de la unidad]
    J --> I
    I --> K[Se notifica al responsable, con el detalle de qué cubrió]
```

**El reparto del más antiguo al más nuevo es la regla por defecto**, no una imposición: reduce
la mora y es lo que espera cualquier contador. El administrador puede cambiarlo.

### 5.2 Cruzar un anticipo

```mermaid
flowchart TD
    A[Admin abre los anticipos de la unidad] --> B[Elige uno con saldo]
    B --> C[Marca los cargos a cubrir]
    C --> D[Vista previa del cruce]
    D --> E{¿Confirma?}
    E -->|No| F[Cancela: nada cambia]
    E -->|Sí| G[Baja el saldo del anticipo y sube lo pagado del cargo]
    G --> H[NO se crea asiento de libro: el dinero ya entró cuando se recibió]
```

**«No se crea asiento» es la regla contable de esta PRD**, y está en §8 R4. El ingreso ocurrió
al recibir el anticipo. Contarlo otra vez al cruzarlo duplicaría los ingresos del conjunto.

### 5.3 Casos límite

| Caso | Comportamiento |
|---|---|
| Pago exactamente igual al saldo | Se aplica entero; **no se crea anticipo de cero** |
| Pago menor que el saldo | Pago parcial; el cargo queda `pending` u `overdue` |
| Pago sin ningún cargo pendiente | **Todo** se convierte en anticipo |
| Cruce mayor que el saldo del cargo | Se limita al saldo; el resto sigue en el anticipo |
| Anticipo de una unidad, cargo de otra | **Bloqueado** (R6) |
| Revertir un pago cuyo anticipo ya se cruzó | **Bloqueado**: primero se deshace el cruce (R8) |
| Reintento con la misma `operationKey` | Devuelve el mismo resultado y el mismo recibo. **Sin cambios** |
| Conjunto `suspended` / `expired` | Solo lectura: se ven los anticipos, no se opera |

## 6. Estados y transiciones

### El anticipo

| Estado | Qué significa | Quién transiciona | Salida |
|---|---|---|---|
| **`open`** | Tiene saldo por aplicar | Administración, al cruzar | → `applied` o `cancelled` |
| **`applied`** | Saldo agotado | Sistema, cuando el remanente llega a cero | → `open`, si se deshace un cruce |
| **`cancelled`** | Anulado con motivo | Administración · Superadmin | **Terminal** |

**Todo anticipo tiene salida y dueño.** Un anticipo `open` que nadie cruza es dinero del
residente parado: la vista de anticipos es la herramienta de §15 G5.

### El cargo

**No cambia.** Sigue con `pending → paid` / `overdue`, calculado por `calcularSaldo`, que **no
se modifica**.

## 7. Contrato de datos y multi-tenancy

### 7.1 Colección nueva: `advances`

| Campo | Tipo | Obligatorio | Quién escribe |
|---|---|---|---|
| `tenantId` | `string` | **Sí** | Servidor |
| `unitId` / `unitLabel` | `string` | Sí | Servidor |
| `personId` | `string` | No | Servidor — quién pagó |
| `amount` | `number` | Sí | Servidor — importe original |
| `remaining` | `number` | Sí | Servidor — saldo por aplicar |
| `origin` | `"overpayment" \| "manual"` | Sí | Servidor |
| `sourceOperationKey` | `string` | Sí | Servidor — puente al pago que lo creó |
| `ledgerEntryId` | `string` | Sí | Servidor — el asiento de su entrada de dinero |
| `date` | `string` | Sí | Servidor |
| `status` | `"open" \| "applied" \| "cancelled"` | Sí | Servidor |
| `cancelledAt` / `cancelledBy` / `cancellationReason` | — | Solo si `cancelled` | El motivo es **obligatorio** |

### 7.2 Colección nueva: `advanceApplications`

Un documento por cruce: `tenantId`, `advanceId`, `statementId`, `amount`, `date`,
`operationKey`, `createdBy`, y `reversedAt` cuando se deshace.

**Existe para que un cruce se pueda deshacer sin adivinar cuánto se aplicó a qué.**

### 7.3 Cambios en lo que ya existe

| Dónde | Cambio | Nota |
|---|---|---|
| `AplicarPagoInput` | `statementId` → **`allocations: { statementId, amount }[]`** | **Cambio de firma.** Ver §13 |
| `AplicarPagoInput` | `+ bankAccountId?: string` | Corrige D-C |
| Asiento del pago | `bankAccountId: null` → **el recibido** | `functions/src/payments.ts:267` |
| `LedgerCategory` | `+ "anticipo"` | `src/types/domain.ts:435` |
| `PaymentReceipt` | `+ bankAccountId?: string` | El residente indica a qué cuenta pagó |
| `BillingStatement` | Sin cambios | |
| `calcularSaldo` | **Sin cambios** | Sigue siendo la verdad del saldo de un cargo |

### 7.4 La integración que hay que hacer bien

`src/features/finanzas/use-ledger.ts:220` **excluye la categoría `alicuota`** del ingreso del
libro, porque ese ingreso se cuenta aparte vía `cuotaIncome`. La categoría **`anticipo` no debe
excluirse**: es dinero que entró y **no** está contado en ningún cargo.

**Si se copia el tratamiento de `alicuota`, el anticipo desaparece del estado financiero** — que
es exactamente el defecto D-A trasladado a otro sitio. Lo mismo en
`src/features/finanzas/financial-statement.ts:16` y en su gemelo de `functions/`.

### 7.5 Multi-tenancy y ciclo de vida

- `advances` y `advanceApplications` llevan **`tenantId`**; toda consulta de lista lo filtra.
- **`suspended` / `expired`** → solo lectura, por `tenantOperable`. Sin excepción.
- **`trial`** → Cartera está en `preview`. Los anticipos **se ven con datos de ejemplo y no se
  operan**. Sin excepción.

### 7.6 Retención y borrado

El anticipo es un registro contable del conjunto: **no caduca con la retención de 12 meses**.
`personId` sí apunta a una persona: al anonimizarla, el anticipo conserva importe, fecha y
unidad, y pierde el vínculo personal — igual que ya hace `anonymizeExpiredVouchersDaily`.

## 8. Reglas de negocio

| # | Regla |
|---|---|
| **R1** | **Lo aplicado a cargos más el anticipo generado es exactamente igual al importe pagado.** Ni un céntimo se pierde ni se inventa |
| **R2** | Si el pago supera el total de los cargos seleccionados, el sobrante **se convierte en anticipo de esa unidad**, siempre |
| **R3** | Un anticipo de importe cero **no se crea** |
| **R4** | **Cruzar un anticipo no crea asiento de libro.** El ingreso se registró al recibirlo |
| **R5** | El asiento de entrada de un anticipo lleva `category: "anticipo"` y **cuenta como ingreso del período** |
| **R6** | Un anticipo solo se cruza contra cargos de **su misma unidad** |
| **R7** | El reparto por defecto va del cargo **más antiguo por vencimiento** al más nuevo; el administrador puede cambiarlo, y la suma debe cuadrar con el importe |
| **R8** | **No se revierte un pago cuyo anticipo tenga cruces vigentes.** Primero se deshacen los cruces |
| **R9** | Anular un anticipo exige motivo y **solo es posible si su remanente está intacto** |
| **R10** | La idempotencia por `operationKey` se conserva sin cambios, y **cubre también el anticipo generado**: un reintento no crea un segundo anticipo |
| **R12** | Si `PRD-V-PLAT-003` ya está construida, el anticipo usa **su cuenta del plan**, no un valor de enum. Ver la secuencia declarada en el encabezado |
| **R11** | Todo pago registra la cuenta bancaria a la que entró, salvo efectivo |

**R10 es la que evita el peor fallo posible:** que un reintento de red duplique el saldo a favor
de un residente.

## 9. Notificaciones y correo

Se reutiliza el aviso de pago recibido, por `functions/src/email.ts` con el remitente
verificado. **Dos cambios de contenido:**

1. El aviso dice **qué cargos cubrió** el pago, no solo el importe.
2. Si quedó saldo a favor, **lo dice y lo nombra**. Un residente que paga de más y no recibe
   confirmación del sobrante llama al administrador. Es la llamada más barata de evitar.

**No se promete ningún plazo de respuesta.**

## 10. Criterios de aceptación

### Deben pasar

| # | Criterio |
|---|---|
| CA1 | Pagar 200 sobre un cargo de 140 deja el cargo `paid` y crea un anticipo de **60** |
| CA2 | El residente ve su saldo a favor de 60 en su portal |
| CA3 | Un pago repartido entre tres cargos los deja con los saldos correctos en **una sola operación** |
| CA4 | La suma de lo aplicado más el anticipo es **exactamente** el importe pagado |
| CA5 | Cruzar un anticipo de 60 contra un cargo de 140 lo deja con saldo 80 y el anticipo en cero, en `applied` |
| CA6 | Cruzar **no** crea ningún asiento nuevo en el libro |
| CA7 | El asiento de entrada del anticipo tiene `category: "anticipo"` y **aparece en el ingreso del período** |
| CA8 | Un pago sin cargos pendientes se convierte **íntegro** en anticipo |
| CA9 | Reintentar con la misma `operationKey` devuelve el mismo recibo y **no crea un segundo anticipo** |
| CA10 | El asiento del pago guarda el `bankAccountId` recibido, no `null` |
| CA11 | El residente elige la cuenta bancaria al subir su comprobante, y el pago aprobado la conserva |
| CA12 | Deshacer un cruce devuelve el anticipo a `open` con su remanente |
| CA13 | El aviso al residente nombra los cargos cubiertos y el saldo a favor si lo hubo |

### Deben fallar

| # | Criterio |
|---|---|
| CF1 | Cruzar un anticipo contra un cargo de **otra unidad** → **denegado** |
| CF2 | Revertir un pago cuyo anticipo ya fue cruzado → **bloqueado**, indicando qué cruce deshacer |
| CF3 | Anular un anticipo parcialmente cruzado → **bloqueado** |
| CF4 | Anular sin motivo → **rechazado** |
| CF5 | Un reparto manual cuya suma ≠ importe pagado → **rechazado** |
| CF6 | Un residente intenta cruzar su anticipo → **denegado** |
| CF7 | Un residente ve el anticipo de otra unidad → **denegado** |
| CF8 | Operar anticipos en un conjunto `suspended` → **denegado** |
| CF9 | Operar anticipos en `trial` → **bloqueado por la matriz de prueba** |
| CF10 | Una consulta de `advances` sin `where("tenantId")` → **denegada entera** |

## 11. Arquitectura y dependencias

### 11.1 La decisión obligatoria: cliente directo o callable

**Callable, y no hay debate:** ya lo es. `aplicarPago` es una Cloud Function que escribe en
varias colecciones dentro de una transacción y emite el recibo. Esta PRD **amplía** esa función;
no cambia dónde vive la lógica.

| Operación | Decisión | Por qué |
|---|---|---|
| Aplicar un pago a varios cargos | **Callable — la misma, ampliada** | Transacción multi-documento, recibo, idempotencia y aritmética que el cliente no puede falsificar |
| Crear un anticipo | **Callable — dentro de la misma transacción del pago** | Si el anticipo se creara aparte, un fallo entre las dos operaciones dejaría dinero sin registrar |
| Cruzar un anticipo | **Callable nueva** | Toca `advances`, `advanceApplications` y `billingStatements` a la vez |
| Deshacer un cruce | **Callable nueva** | Lo mismo, en sentido inverso |
| Leer anticipos | **Cliente directo** | Consulta con `tenantId`; las reglas la protegen |

### 11.2 Reglas de Firestore

Bloques nuevos para `advances` y `advanceApplications`:

- **Lectura**: miembros del conjunto. Un residente **solo los de su unidad** — se apoya en
  `residentOwnUnit()`, que ya existe en `firestore.rules:27`.
- **Escritura**: **nadie desde el cliente.** Solo el servidor. Es dinero, y toda su creación
  pasa por callable.

**No pueden caer en `relaxedTenantCollection`** (`firestore.rules:80`).

### 11.3 El espejo que hay que respetar

`calcularSaldo` (servidor) y `computeBalanceStatus` (cliente) están duplicados a propósito
porque `src/` no puede importar de `functions/`. **Esta PRD no los modifica**, pero sí añade
lógica de reparto: si esa lógica se duplica, se duplica el riesgo. **Recomendación: el reparto
vive solo en el servidor; el cliente pide la vista previa a la callable en vez de calcularla.**

### 11.4 Índices, jobs y banderas

- **Índices:** `advances` por `tenantId` + `unitId` + `status`; `advanceApplications` por
  `tenantId` + `advanceId`.
- **Jobs:** ninguno. **Un anticipo no caduca solo** (§4).
- **Banderas:** `advances` (anticipo y cruce) y `multi-statement-payment` (reparto). Separadas
  a propósito: el reparto puede salir sin los anticipos, pero **no al revés** — sin anticipo, el
  sobrante volvería a evaporarse.

## 12. Riesgos y mitigaciones

| Riesgo | Señal | Mitigación |
|---|---|---|
| **Duplicar el ingreso** contando el anticipo al recibirlo y al cruzarlo | Ingresos del período inflados | R4 y CA6 |
| **Hacer desaparecer el anticipo** del estado financiero al copiar el tratamiento de `alicuota` | El estado financiero no cuadra con el banco | §7.4 lo advierte; CA7 lo prueba |
| Un reintento crea un segundo anticipo | Saldo a favor duplicado | R10 y CA9 |
| Se toca `aplicarPago`, que está en producción | Un pago falla o se aplica mal | Cambio de firma **compatible hacia atrás** (§13); pruebas de la ruta de un solo cargo antes de exponer nada |
| Anticipos que nadie cruza | Dinero parado y residentes que reclaman | Vista de anticipos abiertos; es la herramienta de G5 |
| Revertir deja el anticipo inconsistente | Descuadre | R8 lo bloquea; CF2 lo prueba |
| Coste | — | **Nulo.** Dos colecciones y aritmética |

## 13. Despliegue, rollback y Story Map

### El cambio de firma, y cómo no romper producción

`aplicarPago` está **en producción**. Pasar de `statementId` a `allocations[]` se hace
**compatible hacia atrás**: la función acepta las dos formas y, si recibe `statementId`, lo
trata como una asignación de una sola línea. **Así el front actual sigue funcionando sin
cambios** mientras se despliega.

### Orden

1. **Reglas** — `advances` y `advanceApplications`, sin escritura desde cliente.
2. **Functions** — `aplicarPago` compatible con las dos formas; callables de cruce; categoría
   `anticipo`; `bankAccountId` en el asiento.
3. **Front** — reparto, vista de anticipos, saldo del residente, cuenta en el comprobante. Con
   ambas banderas apagadas.

### Rollback

| Parte | Reversible |
|---|---|
| Reparto y vista de anticipos | **Sí**, por bandera |
| Categoría `anticipo` en el libro | **Sí** mientras no se cree ninguno |
| **Firma ampliada de `aplicarPago`** | **No con bandera**, pero **es aditiva**: aceptar dos formas no rompe la vieja |
| **Anticipos ya creados** | **No se borran.** Se anulan con motivo (R9), que es parte del MVP |

### Validación

| Dónde | Qué |
|---|---|
| **Staging** | Todo: sobrepago, reparto, cruce, reversión, idempotencia con reintento forzado, permisos |
| **Producción** | Que **la ruta de un solo cargo siga comportándose igual**. Es lo único que producción aporta y es lo que más importa |

### Story Map

**MVP** — anticipo automático por sobrepago · vista de anticipos · cruce y deshacer cruce ·
saldo a favor visible para el residente · `bankAccountId` en el pago.

**Fase 2** — reparto de un pago entre varios cargos con ajuste manual · el residente indica la
cuenta en su comprobante · aviso con detalle de cargos cubiertos.

**Fase 3** — anticipo manual sin cargo · exportación de anticipos para el consejo.

## 14. Decisiones abiertas

### D1 · ¿El anticipo es ingreso del mes en que entra?

**Recomendación: sí.** El libro de Vivaru es de caja, no de partida doble: registra el dinero
cuando se mueve. Tratar el anticipo como pasivo exigiría un modelo contable que el producto no
tiene, y el beneficio —presentar el ingreso diferido— no lo pide nadie todavía.

**Consecuencia que hay que aceptar y decir:** un mes con muchos anticipos muestra más ingreso
del que corresponde a sus cuotas. **Se mitiga presentándolo en su propia línea**, no
escondiéndolo (§7.4).

> **CERRADA el 21 ago 2026 — aceptada.** El anticipo es ingreso del mes en que entra, en su
> propia línea del estado financiero. **Nunca excluido como `alicuota`** (§7.4).

### D2 · ¿Puede el residente elegir a qué cargos se aplica su pago?

**Recomendación: no en el MVP.** El residente indica cuánto y a qué cuenta pagó; **quién decide
la imputación es la administración**, que es quien responde de la cartera. Dejarlo elegir
invita a pagar lo nuevo y dejar lo viejo vencido, que es justo lo que R7 evita.

> **CERRADA el 21 ago 2026 — aceptada.** El residente indica **cuánto** y **a qué cuenta**
> pagó; la **imputación la decide la administración**, con el reparto de R7 por defecto.

**Ninguna decisión abierta.**

## 15. Puertas

| Puerta | Estado |
|---|---|
| **G0 Necesidad** | ✅ Los tres defectos están medidos en el código, con archivo y línea |
| **G1 Valor** | ✅ Baseline y métrica en §2 |
| **G2 Datos y permisos** | ✅ Colecciones, roles y prohibiciones definidos; escritura solo por servidor |
| **G3 Riesgo** | ✅ Cambio de firma aditivo, idempotencia conservada, banderas separadas, anulación en el MVP |
| **G4 Aceptación** | ✅ 13 que pasan, 10 que deben fallar |
| **G5 Operación** | ✅ Lo opera el administrador. **La herramienta es la vista de anticipos abiertos**: sin ella, el dinero se queda parado y nadie se entera |
| **G6 Escala** | ✅ Dos colecciones por conjunto y aritmética. Sin coste externo |

**Lista para desarrollo.** Las siete puertas superadas y las dos decisiones cerradas.
