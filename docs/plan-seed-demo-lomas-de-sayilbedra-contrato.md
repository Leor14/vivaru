# Contrato de datos — semilla de «Lomas de Sayilbedra» (fase 0, T0.1)

> **Qué es.** Lo que el producto escribe hoy, colección por colección, para que la semilla lo
> replique campo a campo. Así las pantallas lo pintan y una edición posterior desde la interfaz
> pasa las reglas.
>
> **Cómo se sacó.**
> - Leyendo el código el 12–13 sep 2026 (`develop` = `master` = `789e11b`).
> - Contrastándolo con la forma real de los documentos de producción: claves y tipos de los dos más
>   recientes de 42 colecciones.
> - Se citan **funciones, no líneas**.
>
> Acompaña a `docs/plan-seed-demo-lomas-de-sayilbedra.md` (§12). Lo que escriben los escritores del
> servidor está en el §12.2 del plan; aquí va lo que escribe el navegador y la forma que hay que
> imitar.

**Tipos.**

| Abreviatura | Qué es |
|---|---|
| `sTS` | `serverTimestamp()` del cliente (Timestamp) |
| `TS.now` | `Timestamp.now()` del Admin SDK |
| `D` | cadena `'YYYY-MM-DD'` |
| `H` | cadena `'HH:mm'` |
| `ISO` | `new Date().toISOString()`, con `Z` |

**Base común.** `createTenantDocument` (`src/lib/firebase/realtime-helpers.ts`) hace `addDoc` —id
automático— y añade, **después** del payload, `tenantId`, `createdBy`, `updatedBy`,
`createdAt: sTS` y `updatedAt: sTS`. En la semilla, `createdBy`/`updatedBy` es el uid de quien lo
habría hecho: la admin de hotmail, la portería o el residente.

**Ids.** Donde el producto usa id automático, la semilla usa `${tenantId}--<local>`, que sigue siendo
un id válido y único en toda la base. Los ids compuestos del producto se respetan tal cual.

---

## A. Padrón y ajustes

### `units` — `createUnit` / `updateUnit` (`src/features/admin/services.ts`)

| Campo | Tipo | Nota |
|---|---|---|
| `displayName` | string | «Casa 101». La pantalla ordena por él en memoria |
| `unitId` | string | **Slug exacto** de `displayName`: `toLowerCase().replace(/[^a-z0-9]+/g, "-")`. No es la clave: la clave es el id del documento |
| `tower` | string | Salida de `normalizeTower`, y tiene que estar en `tenantSettings.agrupaciones` |
| `type` | `house` | Los valores son `apartment · house · office · parking · storage · other` |
| `status` | `active` | |
| `coefficient` | number | **Porcentaje de 0 a 100**, hasta 6 decimales. La suma del conjunto debe dar 100,000000 |
| `areaSqm` | number | Superficie del lote |
| `ownerIds` / `residentIds` | string[] | Ids de `people`. La corrida por indiviso exige `ownerIds` (o `billingResponsiblePersonId`) |
| `reservationExempt` | boolean | Opcional. Exime **de la mora para reservar**, no de la cuota |
| base | | `tenantId`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt` |

### `people` — `createPerson` (misma fuente)

| Campo | Tipo | Nota |
|---|---|---|
| `fullName` | string | ≥3 caracteres |
| `email` | string | En minúsculas; dominio inerte `@ejemplo.vivaru.app` |
| `phone` | string | **El formulario lo exige (≥7)**, pero el documento vive sin él: la semilla lo omite (D12) y editar desde la interfaz pedirá teclear uno |
| `documentNumber` | string | Opcional |
| `roleType` = `occupancyType` | `owner_occupant · tenant · investor · other` | La interfaz escribe los dos iguales. Familiar = `other` |
| `unitId` | string | **Id del documento de la unidad** (`claveDeUnidad`) |
| `tower` | string | Torre canónica |
| `status` | `active` | |
| `authUid` | string | Solo si tiene cuenta (G) |
| base | | |

### `tenantSettings/{tenantId}` — varias tarjetas de ajustes

| Clave | Forma |
|---|---|
| `agrupaciones` | `string[]` canónicas: `["Encinos", "Fresnos", "Jacarandas"]` |
| `residentModules` | `{reservations, services, surveys, regulations}: boolean`, todo `true` |
| `moduleVariants` | Ya está: todas completas |
| `reservationPolicy` | `{blockOnDebt: boolean}` |
| `brandColor`, `tenantName`, `logoUrl` (null), `logoPath` (null) | Lo de la marca (`saveTenantSettings`) |
| `fiscalProfile` | `{taxId: null, legalName, address, country: "MX", voucherSeriesPrefix: null, dataRetentionMonths: 12}`. **Sin RFC inventado.** Aparece en los recibos manuales |
| `activeRegulationId` | Id del documento del reglamento |
| `notificationTemplates`, `billingCalendar` | **No se escriben** (§3.9 y D7 del plan) |

`tenants/{id}` no lo escribe la página de ajustes: solo `onboardingStatus` (a `completed`), y
**solo** si T0.3 lo pide.

### `amenities` — `createAmenity`

| Campo | Tipo | Nota |
|---|---|---|
| `name` | string | |
| `category` | `social · sports · wellness · business · other` | |
| `status` | `active` | |
| `availableWeekdays` | number[] | 0 = domingo |
| `operatingHoursStart` / `operatingHoursEnd` | H | |
| `slotDurationMinutes` | number | |
| `reservationSlots` | string[] | `"HH:mm - HH:mm"` |
| `maxReservationsPerSlot` | number | Es el aforo |
| `maxReservationDurationMinutes`, `maxReservationsPerUnitPerMonth` | number | |
| `usageRules` | string | |
| `blockOnDebt` | boolean | |
| `autoApprove` | boolean | |
| `minAdvanceMinutes` | entero | |
| `createdAt` | sTS | **Obligatorio**: la lista del admin hace `orderBy createdAt desc` |

- **No escribir `isReservable: false`**: si falta, el área es reservable.
- **Los tipos de la política, exactos:** `blockOnDebt` null o booleano, `autoApprove` booleano y
  `minAdvanceMinutes` entero de 0 a 10080. Un tipo malo bloquea toda edición del área desde la
  interfaz.
- Fotos: no hay escritor que las añada; se omiten.

---

## B. Cartera y pagos

### `billingStatements` creados por el navegador — `createBillingStatement` (`use-billing-statements.ts`)

Solo para lo suelto (multas). Las cuotas, la extraordinaria y el consumo los escriben las corridas
del servidor.

| Campo | Valor para una multa |
|---|---|
| `unitId` / `unitLabel` | id del documento / `displayName` |
| `period` | `YYYY-MM` |
| `concept` | `multa` |
| `accountCode` | `1.3` |
| `campaignId` | null |
| `amount` | el importe |
| `paymentAmount` | 0 |
| `balance` | = `amount` |
| `dueDate` | D |
| `source` | `manual` |
| `status` | según `calcularSaldo` |
| `lastPaymentAt` | null |

- **Nunca un cobro con `paymentAmount > 0` escrito a mano:** el recaudo sin asiento rompe el libro.
  Los pagos van por `aplicarPago`.

### `billingCampaigns`

Las crean las corridas del servidor (`coef_…`, `exp_…`, `consumo_…`). Se reescribe su `sentAt` al
momento histórico: la lista hace `orderBy sentAt desc`.

### `paymentReceipts` — `confirmUpload` (`src/app/(resident)/resident/account/page.tsx`)

| Campo | Tipo / valor |
|---|---|
| `unitId` | el de la membresía |
| `uploadedBy` | **uid del residente** |
| `uploadedAt` | Timestamp. **Obligatorio**: se ordena por él |
| `fileUrl` | URL con token |
| `fileName` | |
| `storagePath` | `tenants/{t}/payment-receipts/{uid}/{ms}-{nombre}` |
| `amount` | > 0 |
| `status` | `pending · approved · rejected` |
| `statementId?`, `bankAccountId?` | Ausentes si no se eligieron |

- **Aprobar:** `aplicarPago` con `operationKey: "receipt:<id>"` y `source: "receipt"`. Deja el
  comprobante con `{status: "approved", registeredAmount, reviewedAt, reviewedBy, reviewedByName?, rejectedReason: null}`.
- **Un comprobante aprobado no emite recibo:** solo el cobro manual lo hace.
- **Rechazar:** `status: "rejected"` y `rejectedReason`.

---

## C. Egresos y libro

### `expenses` — `createExpense` (`src/features/finanzas/use-expenses.ts`, `normalizeExpensePayload`)

| Campo | Tipo / valor |
|---|---|
| `category` | `nomina · servicios_publicos · mantenimiento · proveedores · administracion · seguros · impuestos · vigilancia · otros`. **Nunca `seguridad` ni `servicios`** |
| `accountCode` | `codigoDeCategoriaDeEgreso`: 2.1 nómina · 2.2 servicios · 2.3 mantenimiento · 2.4 proveedores · 2.5 administración · 2.6 seguros · 2.7 impuestos · 2.9 vigilancia · 2.8 otros |
| `description` | ≥3 caracteres |
| `vendorName`, `vendorTaxId` | Copia del proveedor. **`vendorId` no lo escribe el navegador** |
| `amount` | > 0 |
| `issueDate` | D |
| `dueDate` | D o null |
| `status` | `registrado · pagado · anulado` |
| `paymentMethod` | `transferencia · cheque · efectivo · otro` |
| `checkNumber` | Solo con cheque |
| `bankAccountId` | Id de `bankAccounts` **o de `pettyCashFunds`** |
| `paidAt` | D. **La fecha histórica del pago.** El producto pone «hoy» al marcarlo, y hoy era ese día |
| `ledgerEntryId` | **Obligatorio si está `pagado`.** Sin él, la primera edición crea otro asiento |
| `supportFileUrl` / `supportFileName` / `supportFileStoragePath` | null |

**Asiento espejo** (`createExpenseLedgerEntry`, `use-ledger.ts`):

| Campo | Valor |
|---|---|
| `type` | `egreso` |
| `date` | `paidAt` |
| `amount` | positivo |
| `concept` | la descripción |
| `category` / `accountCode` | los del egreso |
| `bankAccountId` | el del egreso |
| `sourceType` | `expense` |
| `sourceId` | id del egreso |
| `reconciled` | false |

- **Egreso en cuotas:** `guardarPlan` y `pagarCuota` escriben las cuotas y un asiento por cuota.
  Queda por comprobar en T1.6 qué asiento escribe el cliente al dar de alta un egreso con plan, para
  no contar el gasto dos veces.

### Asientos manuales — `createManualLedgerEntry`

| Campo | Valor |
|---|---|
| `type` | `ingreso · egreso` |
| `date` | D |
| `amount` | > 0 |
| `concept` | ≥3 caracteres |
| `category` | null |
| `bankAccountId` | null |
| `sourceType` | `manual` |
| `sourceId` | null |
| `reconciled` | false |

- Sin `accountCode`: la interfaz nunca produce otra forma.
- **`esRecaudoDeCartera`** excluye del ingreso del libro los asientos con
  `sourceType == "billingStatement"`, con `reversedSourceType == "billingStatement"` o con
  `category == "alicuota"`. Las tres copias son idénticas.
- Un ingreso manual con `category: "alicuota"` **se cuenta cero veces**. Con `category: null` va a
  «Otros ingresos».

### `vendors` — `createVendor` (`use-vendors.ts`)

| Campo | Nota |
|---|---|
| `type: "proveedor"` | |
| `legalName` | ≥3 caracteres |
| `status: "active"` | |
| `taxId`, `tradeName`, `defaultCategory`, `bankName`, `accountNumber` | Opcionales, **ausentes si están vacíos** (no null) |

- `accountNumber` es la CLABE: el formulario solo mira que tenga 18 caracteres.
- Sin RFC inventado: `taxId` se omite.

---

## D. Bancos y tesorería

### `bankAccounts` — `createBankAccount` (`use-bank-accounts.ts`)

| Campo | Valor |
|---|---|
| `label` | «Operativa» / «Fondo de reserva» |
| `bankName` | |
| `accountNumber` | **CLABE de 18 dígitos con dígito de control INVÁLIDO según Banxico**: no puede ser una cuenta real, y el producto no la valida. Lo comprueba una prueba en T1.2 |
| `accountType` | `corriente` |
| `currency` | **`MXN` escrito explícitamente**: el formulario trae `COP` por defecto |
| `active` | true |

- **El residente lee el documento entero** de las cuentas activas: ve ese número.

### `bankAccountBalances/{idDeLaCuenta}`

- `{tenantId, openingBalance, updatedBy, updatedAt}`, **sin fecha**.
- Es el saldo al 31 de mayo, antes de la primera operación en Vivaru.
- El informe mensual abre **todos** los meses con la suma de estos saldos (hallazgo §12.3.3 del plan).

### `treasuryTransfers` y `pettyCashFunds`

| Operación | Escritura |
|---|---|
| `registrarTraspaso` | `{fromAccountId, toAccountId, amount, date: D, reference?, detail?, kind: "traspaso", status: "registrado"}`. **Las dos cuentas tienen que ser bancarias** |
| `abrirCaja` | En el mismo lote: `pettyCashFunds {name, limit, sourceAccountId, status: "abierta"}` y el traspaso `{kind: "apertura", fromAccountId: banco, toAccountId: idDeLaCaja, amount: limit}` |
| `reponerCaja` | `{kind: "reposicion", from: banco, to: caja}` |

- **Un gasto de caja es un egreso pagado con `bankAccountId` = id de la caja.**
- Orden: por `date` y luego por `createdAt.seconds`.

### `bankStatementLines` — `importBankStatementLines` (`use-reconciliation.ts`)

| Campo | Valor |
|---|---|
| id | **`idDeLinea(linea)`**: `"bsl_"` + 32 hex del SHA-256 de `claveNatural`, que es `[tenantId, bankAccountId, date, amount.toFixed(2), normalizarDescripcion(description)].join("|")`. Importar `lib/conciliacion.js`, no copiarlo |
| `date` | D |
| `amount` | **positivo = entrada, negativo = salida** |
| `description` | texto del banco |
| `naturalKey` | |
| `reconciled` | false |
| `matchedLedgerEntryId` | null |
| `importBatchId` | `"imp-<ms>"` |
| base | |

- **Los casos** (`reconciliationCases`) los crea el servidor con `asegurarCasos` y los aplica
  `aplicarCaso`. Un asiento es candidato si coinciden efecto e importe (tolerancia 0,005), su fecha
  está a 3 días o menos y su cuenta es la de la línea o no tiene cuenta.

---

## E. Presupuesto y medidor

### `budgets/{tenantId}_{year}` — `guardarBorrador` / `aprobarPresupuesto` (`use-presupuesto.ts`)

| Campo | Valor |
|---|---|
| `year` | 2026 (entero) |
| `lines` | `[{accountCode, amount ≥ 0}]`, 2 decimales, ordenadas por código, 200 como mucho |
| `status` | `aprobado` |
| `approvedAt` | D = **la fecha del acta que teclea la administración** (asamblea del 25 ene 2026) |
| `approvedBy` | uid |
| `approvedRecordedAt` | Timestamp del momento en que se cargó en Vivaru (junio) |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | |

- **Ejecución** (`compararPresupuesto`): toma el libro y la cartera del año, cada importe en la fila
  de su `accountCode`.
- **La desviación se mide contra el importe ANUAL:** un egreso se marca solo si se pasa
  (`sobre_ejecucion`), y un ingreso por debajo del anual sale `faltante`. **No hay marca de
  subejecución.** Esto invalida la premisa de D11 (§12.4 del plan).

### `meteredServices` — `createMeteredService` (`src/features/medidores/services.ts`)

- `{tenantId, name, unit: "m3", rate > 0, accountCode: "1.11", active: true}`, **sin firmas**.

### `meterReadings`

- Las escribe `registrarLectura` (§12.2 del plan).
- Foto en `tenants/{t}/meter-readings/{servicio}/{unidad}-{periodo}.jpg`, con token.
- Patrón de subida: el de `sembrar-demo-finanzas.mjs`, con `sharp`, que se resuelve desde el
  `node_modules` de la raíz.

---

## F. Operación

### `reservations` — la forma de `crearReserva` (`functions/src/reservations.ts`)

La semilla la escribe directamente, porque el escritor rechaza fechas pasadas.

| Campo | Tipo / valor |
|---|---|
| `createdBy`, `updatedBy` | uid del residente |
| `createdByName` = `residentName` = `reservedBy` | nombre |
| `unitId`, `unitLabel` | |
| `amenityId` | id del área |
| `amenity` = `amenityName` | nombre del área. **La portería pinta `amenity`** |
| `date` | D |
| `startTime`, `endTime` | H |
| `startAt` | Timestamp del instante en `America/Mexico_City` (`instanteEnZona`) |
| `slot` | `"HH:mm - HH:mm"` |
| `exclusiveUse` | boolean |
| `status` | `approved · pending · cancelled`. **`rejected` no tiene escritor**: el rechazo de la interfaz se guarda como `cancelled` |
| `autoApproved` | true, solo si nació aprobada |
| `createdVia` | `"callable"` |
| `createdAt`, `updatedAt` | |
| cancelada | además `cancellationReason` y `cancelledAt` |

- **Mudanza:** `amenityId: "mudanza"`, `amenity` = `amenityName` = «Mudanza», `kind: "mudanza"` y
  `mudanza: {requiresElevator, depositPaid, depositAmount?, additionalNotes?}`. **Sin `reservedBy`.**
- Validar cada una con `evaluarReglasDeReserva` y un «ahora» inyectado: aforo, horario y cupo
  mensual.
- **Los nueve campos que compara la cancelación del residente van siempre:** `tenantId`, `unitId`,
  `createdBy`, `amenityId`, `amenity`, `date`, `startTime`, `endTime` y `slot`. La regla los lee sin
  `.get()`: si falta uno, el residente no puede cancelar.

### Visitas — el flujo real de `qr_full` es la invitación del residente

`createResidentInvitation` (`src/features/visitors/invitations.ts`) escribe **dos** documentos.

**1. `visitorInvitations`:**

| Campo | Tipo / valor |
|---|---|
| `unitId` | |
| `residentUserId` | uid |
| `authorizedByName` | |
| `visitorName` | |
| `visitorIdentification` | |
| `plate` | `""` por defecto |
| `visitReason` | |
| `adultsCount`, `childrenCount` | number |
| `allowedUses` | 1 |
| `startAt`, `endAt` | Timestamp |
| `status` | `active · cancelled`. **`expired` y `used_up` no tienen escritor** |
| `qrToken` | UUID |
| `invitationCode` | 6 caracteres base36 en mayúsculas |
| `createdAt`, `updatedAt` | sTS |

**2. `visitorPasses`** (con la base de `createTenantDocument`):

| Campo | Tipo / valor |
|---|---|
| `unitId`, `unitLabel` | |
| `visitorName` | |
| `documentNumber` | |
| `qrCodeValue` | = `qrToken` |
| `hostResidentName`, `residentName`, `createdByName` | |
| `tower`, `unit` | |
| `date` = `eventDate` | D local |
| `scheduledTime` | **ISO con `Z`** del `startAt` |
| `status` | `scheduled` |
| `checkInAt`, `checkOutAt` | null |

- **Histórico:** el pase nace `completed`, con `checkInAt` y `checkOutAt` como Timestamp.
- **Hoy:** alguno `inside`, solo con `checkInAt`.
- **Un pase `scheduled` lleva `checkInAt: null` y `checkOutAt: null` escritos.** La regla de la
  portería los compara sin `.get()`: sin ellos no puede dar ingreso.

**Autorizaciones del admin** (`visitorAuthorizations`, `createVisitor`):

| Campo | Tipo / valor |
|---|---|
| `visitorName`, `visitorDocument` | |
| `qrCode` | ≥5 caracteres |
| `authorizationType` | `puntual · larga_duracion` |
| `visitorCategory` | `familiar · servicio · otro` |
| `unitId` | |
| `authorizedBy` | nombre |
| `startDate`, `endDate` | D |
| `startTime`, `endTime?` | H |
| `notes?` | |
| `status` | `active · expired · cancelled` |

- Con su pase: `scheduledTime: "YYYY-MM-DDTHH:mm:00"`, `validFrom`/`validUntil` (D),
  `sourceAuthorizationId`, **sin `eventDate`**.
- Para la empleada doméstica o el jardinero: larga duración.

### `packages` — `createGuardPackage` (`src/features/packages/use-packages.ts`)

**Al llegar:**

| Campo | Tipo / valor |
|---|---|
| `towerId`, `tower`, `unit` | |
| `unitId`, `unitLabel` | |
| `residentId`, `residentName` | |
| `recipientName` | |
| `description` | |
| `reference` | `PK-<ms>` |
| `status` | `pending` |
| `arrivedAt` | **ISO** |
| `registeredBy`, `registeredByName` | uid y nombre de la portería |
| `receivedByGuardId`, `receivedByGuardName` | |

**Al entregar** (`confirmPackageReceived`):

| Campo | Tipo / valor |
|---|---|
| `status` | `delivered` |
| `deliveredToId` = `receivedBy` | id de la persona elegida |
| `deliveredToName` | |
| `deliveredBy` | uid |
| `receivedAt`, `deliveredAt` | Timestamp |

**Foto de evidencia: no existe en el producto.** `con_evidencia` solo obliga a elegir quién recibe.
La semilla no genera fotos de paquetes.

### `tickets` (PQRS) — `createTicket` (`src/features/pqrs/use-tickets.ts`)

**Al crear:**

| Campo | Tipo / valor |
|---|---|
| `unitId`, `unitLabel` | |
| `residentId` | **uid** |
| `residentName` | |
| `category` | `pqrs` |
| `type` | `petition · complaint · claim · suggestion · other` |
| `subject`, `message` | |
| `status` | `open` |
| `radicado` | `PQRS-<últimos 6 dígitos de ms>` |
| `radicationDate` | **ISO** |
| `eventDate` | `radicationDate.slice(0,10)` (día UTC). La semilla fecha los PQRS antes de las 18:00 locales para que coincida con el día local |

**Clasificación:** `priority` (`low · medium · high`), `classifiedAt` (ISO) y `classifiedBy`.

**Respuesta, que la semilla escribe en el mismo `create`:**

| Campo | Tipo / valor |
|---|---|
| `response` | |
| `status` | `in_progress · resolved · responded · closed` |
| `respondedBy`, `respondedByName` | |
| `respondedAt` | Timestamp |
| `updatedAt` | **ISO**, como tras responder |
| `responseHistory` | `[{id: "rsp-<ms>", message, status, createdAt: ISO, createdBy, createdByName}]` |

**SLA (`con_sla`):** no se guarda. `getTicketSla` suma 15 días hábiles, de lunes a viernes, a
`radicationDate`: amarillo con ≤5 días restantes y rojo con ≤0. «Por vencer» y «vencido» se
consiguen eligiendo la fecha de radicación.

### `communications` — `createCommunication` de `src/features/admin/services.ts`

Es el escritor vivo: el de `use-communications.ts` no tiene llamadores.

| Campo | Tipo / valor |
|---|---|
| `title` | ≥4 caracteres |
| `message` | ≥8 caracteres |
| `notificationSummary` | ≤280 caracteres |
| `status` | `published · scheduled · expired · draft · archived` |
| `startsAt`, `endsAt` | D |
| `attachmentUrl`, `attachmentName` | `""` |
| `attachments` | `[]` |
| `audience` | `"all"` |
| `audienceTowers`, `audienceUnitIds` | `[]` |
| `publishedAt`, `createdAt`, `updatedAt` | **Timestamp** |

- `status` se calcula: `startsAt` futuro da `scheduled`; `endsAt` pasado da `expired`; si no,
  `published`.

### `surveys` y `survey_responses` (`src/features/surveys/services.ts`)

**`surveys`:**

| Campo | Tipo / valor |
|---|---|
| `title` | |
| `description` | |
| `targetAudience` | `{type: "all"}` |
| `minResponsesForResults` | 5 |
| `questions` | `[{id: "q1"…, type: single_choice · multiple_choice · likert · text, text, options?, required}]`. Sin `options` en `likert` y `text` |
| `status` | `published · closed` |
| `publishedAt`, `closedAt` | Timestamp |
| `closingDate` | Timestamp a **medianoche UTC** de la fecha, como el producto |
| `responseCount` | = respuestas sembradas |
| `createdBy`, `createdAt`, `updatedAt` | |

**`survey_responses/{surveyId}_{unitId}`:**

| Campo | Tipo / valor |
|---|---|
| `id`, `surveyId`, `unitId` | |
| `answers` | `[{questionId, value}]` |
| `respondedAt` | Timestamp |

- **Sin uid.**

### `committee_agreements` y firmas (`src/features/committee-agreements/services.ts`)

**`committee_agreements`:**

| Campo | Tipo / valor |
|---|---|
| `title` | |
| `sessionDate` = `eventDate` | D |
| `description` | null |
| `signatureMode` | `obligatoria · parcial · informativo` |
| `signerScope` | `all` |
| `signerUnitIds` | null |
| `quorum` | null |
| `status` | `enviado` |
| `sentAt` | **ISO** |
| `fileUrl`, `storagePath`, `fileName` | PDF en `tenants/{t}/agreements/{ms}-{nombre}` |

- Con su `documents` de categoría `acuerdo`.

**`committee_agreement_signatures/{agreementId}_{unitId}`:**

| Campo | Tipo / valor |
|---|---|
| `id`, `agreementId`, `unitId` | |
| `signedBy` | **uid** |
| `signedAt` | Timestamp |
| `agreementTitle`, `agreementSessionDate` | |

### `documents`, `documentFolders`, reglamento

**`documents`:**

| Campo | Tipo / valor |
|---|---|
| `fileName`, `description` | |
| `fileUrl` | con token |
| `storagePath` | `tenants/{t}/documents/{ms}-{nombre-saneado}` |
| `uploadedBy`, `uploadedByName` | |
| `category` | `asamblea · contrato · plano · memoria · financiero · legal · comunicado · acuerdo · reglamento · otro…` |
| `folderId` | |
| `fileSize` | |
| `contentType` | |
| `source`, `sourceId` | null |
| base | |

- **El residente solo ve** `asamblea · comunicado · acuerdo · reglamento · plano · memoria · otro`.

**`documentFolders`:**

- Solo los crean callables; la semilla escribe la forma de `ensureSystemFolderImpl`:
  `{name, description, parentId: null, path, depth: 0, color: "system", system: true, systemKey, createdBy, createdByName, createdAt, updatedAt}`.
- Claves de sistema: `communications · regulations · committee_agreements · payment_receipts · billing_closures · committee_reports · cartera_history · monthly_reports · ledger_history`.

**Reglamento:**

- Es un `documents` con `category: "reglamento"`, `title`, `audience: "all"` y `uploadedAt` (ISO),
  más `tenantSettings.activeRegulationId`.
- **`regulation_signatures/{regulationId}_{unitId}`:** `{id, regulationId, unitId, signedBy: uid, signedAt: Timestamp, regulationVersion: el título}`.

### `services`, `supportTickets`, `notifications`

**`services`** (directorio de servicios):

| Campo | Tipo / valor |
|---|---|
| `title`, `description` | |
| `category` | `resident_offer · third_party` |
| `serviceType` | |
| `providerName`, `providerContact` | |
| `status` | `active` |
| `unitId` | solo en `resident_offer` |

**`supportTickets`:**

- **Escritura directa**: el callable `createSupportTicket` manda correo al equipo, y la semilla no
  lo llama.

| Campo | Tipo / valor |
|---|---|
| `tenantName` | |
| `createdBy`, `createdByName`, `createdByEmail` | |
| `category` | |
| `subject`, `description` | |
| `priority` | |
| `status` | `resuelto` |
| `createdAtIso`, `lastActivityAt` | ISO |
| `thread` | `[{id, role: cliente · vivaru, authorUid?, authorName, message, createdAt: ISO}]` |
| `resolvedAt` | ISO |
| `createdAt`, `updatedAt` | |

**`notifications`** (forma de `createNotifications`, para el buzón histórico de las cuentas demo):

| Campo | Tipo / valor |
|---|---|
| `userId` | |
| `tenantId` | |
| `type` | `package · communication · reservation · visitor · ticket · system · billing · regulation · survey` |
| `title`, `description` | los textos fijos de cada disparador |
| `read` | |
| `createdAt` | Timestamp |
| `link` | ruta de pantalla |

- **No hay campo que apunte al documento de origen.**
- **Van todos los campos, `description` y `link` incluidos** (`null` vale en `link`). La regla de
  «marcar como leída» los compara sin `.get()`.

---

## G. Cuentas

Las altas del producto no se pueden importar y **mandan correo**. La semilla escribe la forma
equivalente, sin correo:

1. Auth `createUser({email, displayName, emailVerified: true})`, **sin contraseña**.
2. `setCustomUserClaims(uid, {role, tenantId})`.
3. `users/{uid}`: `{uid, email, fullName, role, tenantId, status: "active", unitId?, unitLabel?, mustChangePassword: false, passwordStatus: "updated", createdAt, updatedAt}`.
   **Sin `isDemoAccount`:** el checklist de onboarding no contaría la cuenta.
4. `tenantUsers/{tenantId}_{uid}`, con los mismos campos. En el residente, `unitId` = id del documento
   de la unidad, porque de ahí salen sus avisos y su acceso (`residentOwnUnit`). **Se escribe al
   final** (§3.8 del plan).
   - **Las reglas comparan sin `.get()`** `uid`, `role` y `tenantId` en `users`, y `uid`, `tenantId`,
     `role`, `status`, `email`, `unitId` y `unitLabel` en `tenantUsers`. Tienen que estar todos, o
     el propio usuario no podrá editar su perfil.
   - Las cuentas **sin acceso** (D13) llevan correo inerte y ninguna contraseña. Las cuatro **con
     acceso** llevan un alias `+lomas-…`, y la contraseña la pone David con «¿Olvidaste tu
     contraseña?», que es nativo de Firebase y no pasa por la puerta de buzones.
5. `people/{id}.authUid = uid`.
6. Consejero: además, `aplicarMarcaDeConsejo` (`lib/rol-consejo.js`), que pone `isCommittee`,
   `committeeSince` y `committeeGrantedBy`.

---

## H. Rarezas del producto encontradas por el camino

Leídas en el código, **no probadas**. No se arreglan con la semilla; quedan para decidir aparte.

1. Los pases que crea una autorización del admin **no llevan `eventDate`**, y el informe del comité
   filtra por él: no los cuenta.
2. Las reservas que crea el admin desde el cliente **no llevan `amenity`**, y la portería pinta ese
   campo: sale vacío.
3. **Estados sin escritor:** `rejected` en reservas, `cerrado` en acuerdos, y `expired` y `used_up`
   en invitaciones. `allowedUses` no lo consume nadie.
4. `unitChangeRequests` no tiene pantalla ni escritor que las apruebe.
5. La variante `con_evidencia` de paquetes no guarda ninguna evidencia.
6. **Fechas:**
   - El `eventDate` de un PQRS es el día UTC, así que desde las 18:00 de México cae en el día
     siguiente.
   - El `closingDate` de una encuesta es medianoche UTC, que en México son las 18:00 del día
     anterior.
7. `tenantSettings.createdAt` se reescribe cada vez que se guarda la marca.
8. La regla de portería no admite volver de `inside` a `scheduled`, que es el reingreso de una
   visita de larga duración.
9. El saldo de apertura del informe mensual no se arrastra de un mes al siguiente (§12.3.3 del
   plan).
10. **La puerta de buzones deja pasar los dominios inertes**, y no hay otro filtro que evite
    escribirles. Si se abre un camino de correo hacia una persona con correo `@ejemplo.vivaru.app`,
    el envío se intenta y rebota.
11. «¿Olvidaste tu contraseña?» es nativo de Firebase (`sendPasswordResetEmail`) y no pasa por la
    puerta.

**Encontradas al construir la fase 1** (13 sep). Las 12–15 salieron al sembrar y mirar lo sembrado;
las 16–20, leídas en el código al replicar sus escritores. Tampoco se arreglan con la semilla.

12. **La conciliación empareja una línea del banco con UN asiento.** Un pago repartido (un depósito,
    varios cargos, un asiento por cargo) no tiene caso posible y su línea se queda pendiente. La
    semilla parte los pagos en uno por cargo y deja repartidos solo los tres que la historia necesita.
13. **La importación del extracto deduplica por clave natural** (`idDeLinea`): dos movimientos
    iguales el mismo día —dos transferencias del mismo importe y concepto— se funden en una línea. La
    semilla les pone un número de rastreo; un extracto real puede traerlos así.
14. **El informe mensual toma la cartera del momento en que se emite, no la del cierre del mes.** El
    de junio, emitido el 7 de julio, cuenta como cartera las cuotas de julio, que aún no vencían
    ($121,737 en el emulador).
15. **El PDF del informe parte una fila entre dos páginas** y deja la segunda casi en blanco cuando la
    tabla pasa de unas 35 filas.
16. **El aviso de cobro nuevo llama «Mantenimiento y Administración» a un cargo de consumo.**
    `BILLING_CONCEPT_LABELS` (`functions/src/index.ts`) no tiene `consumo_medido` y cae a la etiqueta
    por defecto.
17. **El reparto por antigüedad desempata por el id del cargo** (`ordenarPorAntiguedad`,
    `functions/src/payments.ts`). La cuota del mes y el consumo del mes anterior vencen los dos el 10,
    y un pago parcial paga primero el de id menor, que el producto genera al azar: es estable para esos
    cargos, pero nadie lo eligió. En la semilla se ve así: dos siembras desde cero reparten el pago
    equivocado en 4 o en 5 líneas, con los mismos totales (medido con una huella del dinero).
18. **El vencido del cron y el de `calcularSaldo` no coinciden el día del vencimiento.**
    `updateOverdueStatements` (07:00 UTC, la 01:00 de Puebla) marca `overdue` lo que vence ese mismo
    día (`dueDate <= hoy`) y avisa «Tu unidad quedó en mora»; `calcularSaldo` solo lo da por vencido
    al día siguiente (`vencimiento < hoy`). Emparentado con el «vencido del servidor en UTC» que ya
    está en `docs/pendientes.md`; no se abre aquí.
19. **«Visitante programado para hoy» compara con el día UTC del servidor** (`isTodayDateString`): una
    invitación creada después de las 18:00 de Puebla para el día siguiente le avisa a la portería
    «hoy» la víspera.
20. **Visitas y paquetes sacan torre y unidad partiendo `unitLabel` por el guion** («Torre 1 - 301»). En
    una casa sin guion («Encinos 03») las dos quedan con la etiqueta entera.
