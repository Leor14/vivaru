# Plan — Semilla de historia para «Lomas de Sayilbedra»

> **Qué es.** El plan para cargar en **producción** tres meses de vida de un conjunto —junio, julio y
> agosto de 2026, más septiembre en curso y dos semanas por delante— en *Lomas de Sayilbedra*, de
> modo que **ninguna pantalla de los tres portales quede vacía** en una demo.
>
> **Estado: planeación, con la fase 0 cerrada (§12). No se ha escrito nada en ningún ambiente.**
> Cada paso que escribe datos o mueve una bandera en producción lleva su permiso aparte (§10).
>
> **Medido contra `hogaru-1` el 12 de septiembre de 2026 por la noche** (13 sep en UTC).
>
> **Gemelos que se reutilizan y se corrigen:** `docs/plan-seed-demo-las-playas.md` (junio) y
> `functions/scripts/sembrar-demo-finanzas.mjs` (10 sep).

---

## 0. En una página

- **El conjunto está vacío y activo.** Tiene 22 cuentas del plan de cuentas, sus ajustes y la
  membresía de admin de `david.macar.18@hotmail.com`. Se convirtió a cliente desde la consola a las
  01:23 UTC del 13 (`status: active`, `planId: completo`) y está marcado `isExample`.
- **Ningún script existente sirve tal cual.** `seed-tenant.mjs` apunta a producción por defecto y
  lleva ids fijos sin conjunto. `sembrar-demo-finanzas.mjs` usa ids `demo-*` globales que Las Playas
  ya ocupa en producción: sobre Lomas se saltaría pasos o reventaría.
- **Un script nuevo**, con la forma segura de `sembrar-demo-finanzas.mjs` (proyecto obligatorio,
  simulación por defecto, `--limpiar`), que **mueve el dinero por los mismos escritores que usa el
  producto** (`functions/lib`) y replica campo a campo lo que solo escribe el navegador.
- **La lección que más pesa sale de medir Las Playas:** su «historia» nació casi entera con
  `createdAt` del **1 de julio** —45 de 45 visitas, 28 de 28 paquetes, 12 de 12 comunicados, 50 de 51
  cobros, 127 de 137 avisos— y hoy no tiene nada «de hoy». Aquí **cada campo de fecha va en su
  momento**, y un modo `--refrescar` pone lo del día antes de cada demo.
- **Orden que evita el ruido:** primero toda la historia **sin membresías de residente ni de
  portería** —los disparadores que avisan a esos roles no encuentran a quién—; después las cuentas;
  al final, un lote «de hoy» que sí avisa, como un día real.
- **Cero correos por construcción**, y la puerta de buzones como red opcional.
- **Del orden de 3.000 documentos, unas 40 cuentas de Auth y 220 archivos pequeños**, en cuatro
  fases, con ensayo en el emulador y en staging antes de producción.
- **Trece decisiones, todas tomadas** (§10): con la recomendación el 12 sep; el 13, D11 sin asientos,
  D13 sí, y D9 la resuelvo yo.

---

## 1. Punto de partida (medido)

| Qué | Lomas de Sayilbedra | Las Playas (la demo que existe) |
|---|---|---|
| Id | `PoyiASYEYoPSMulCWPJa` | `conjunto-las-playas` |
| Estado | `active` desde 01:23 UTC del 13; `planId: completo`; `onboardingTrack: cliente`; `onboardingStatus: in_progress` | `active`, `plus`, `completed` |
| Marcas | `isExample: true`; **sin** `sinClienteDetras` | `isExample`, `sinClienteDetras` |
| Dónde | Puebla, MX, MXN; administra *Sayil* (`YGhiuJTkXPK3JBtSrIVQ`) | Cancún, MX, MXN |
| `tenantSettings` | solo `moduleVariants` (todas completas) | además `agrupaciones`, `residentModules`, `brandColor` |
| Onboarding | Caché escrita cuando era prueba: 0 de 7 y 0 de 8. **Como cliente, su checklist son 17 pasos** (10 + 7, §12.5) | — |
| Datos | `chartOfAccounts` 22 (con `1.11` de consumo medido), `auditLogs` 4, `tenantUsers` 1, `tenantOnboarding` 1 | contenido en **45 colecciones** |
| Banderas que difieren | presupuesto, medidor y tesorería **apagadas** (default del catálogo) | las tres **encendidas por override** |

- Las otras 30 banderas del catálogo resuelven igual en los dos, por el valor global (resueltas con
  `functions/lib/feature-flags.js`).
- `ai-gateway`, `ai-pqrs-shadow` e `ia-proveedor-real` están encendidas, pero **la sombra se salta
  los conjuntos marcados** (`sombra-pqrs.ts:197`, comprobado): sembrar tickets no llama a Vertex.
- **Ninguna pantalla acota la historia por la fecha de creación del conjunto** (11 sep). Solo la
  consola de superadmin enseña «Convertido». Sembrar desde junio no choca.
- `monthlyReports` tiene **un** documento en toda la base (`tenant-santa-maria_2026-08`), con id
  `{conjunto}_{mes}` y sin campo `tenantId`.

---

## 2. Qué se hereda y qué no

| Pieza | Se reutiliza | No se copia |
|---|---|---|
| `sembrar-demo-finanzas.mjs` | Proyecto obligatorio, simulación por defecto, `--limpiar`, importar `functions/lib` | Ids `demo-*` globales; `crearSiFalta` que no mira el `tenantId` del documento que ya existe |
| `trial-seed.ts` | `${tenantId}--…`, `claveDeUnidad`, `accountCode` con `cuentaParaConcepto` y `cuentaParaCategoriaDeEgreso`, saldo inicial en `bankAccountBalances` | `isExample` en cada fila (§3.4); cobros con `paymentAmount` sin asiento, operación ni recibo (rompe el invariante del pago a propósito, porque solo alimenta la vista previa del trial) |
| `seed-data-playas.mjs` | El guion: patrones de pago, PQRS por vencer, visitas de hoy, encuestas y acuerdos con firmas | `createdAt` = ahora; `unitId` = slug; `openingBalance` en la cuenta; filas de ingreso `alicuota` a mano (**doble conteo** con la cartera); contraseña fija en el repo; `CLEAR=true` |
| `plan-seed-demo-las-playas.md` §5 | `source: "import"` donde aplique; estados finales en un solo `create` | Correos `@demo.grupovivaru.com` para cuentas con login (no hay buzón para restablecer) |

---

## 3. Principios de diseño

Lo que no se vuelve a discutir en cada tarea.

1. **Un script nuevo, un solo punto de entrada.**
   `functions/scripts/sembrar-historia-demo.mjs <proyecto> <tenantId> [--escribir] [--limpiar] [--refrescar] [--fase=N] [--si-produccion]`,
   con el guion aparte en `functions/scripts/historias/lomas-de-sayilbedra.mjs`. El `tenantId` va
   por argumento para poder ensayar sobre otro conjunto con la misma historia.
2. **Sin proyecto por defecto; simula si no se dice `--escribir`; producción exige
   `--si-produccion`; y se niega si el conjunto no es `isExample`.** «La trampa no se evita
   recordándola: se evita quitando el default» (`seed-pqrs-piloto.mjs`).
3. **Ids con el conjunto delante, y un manifiesto.**
   - Todo id que elegimos es `${tenantId}--…`, y todo `operationKey` también: el de `payments.ts` es
     global y no lleva conjunto.
   - Lo que crean los escritores del producto (asientos, recibos, operaciones, casos) se apunta en un
     **manifiesto**, en el propio proyecto y en un fichero.
   - `--limpiar` borra **por id exacto del manifiesto, nunca por barrido de conjunto**
     (`vaciar-avisos-sembrados.mjs`).
   - Re-ejecutar no duplica: se comprueba el id **y** su `tenantId` antes de crear.
4. **Sin `isExample` en las filas.**
   - El checklist de onboarding descarta las filas marcadas (`use-onboarding-progress.ts:193`), y su
     visibilidad no depende del `onboardingStatus` del conjunto. Con filas marcadas, la demo diría
     «configura tu conjunto» con tres meses de historia encima.
   - La marca del conjunto basta para lo que importa: que la sombra de IA no clasifique datos
     inventados.
   - Tampoco se añade un campo propio de semilla. El manifiesto lo sustituye, y un campo desconocido
     podría chocar con una regla que cierre los campos de una edición (se verifica en la fase 0).
5. **El dinero, por los escritores del producto.** Salen de `functions/lib`, nunca de `lib/index.js`
   (que inicializa y registra todas las functions):
   - pagos, anticipos, cruces y reversiones: `aplicarPago`, `cruzarAnticipo`, `revertirPago`;
   - corridas: `generarCorridaPorCoeficiente`, `repartirEgreso`, `generarCorridaDeConsumo`;
   - egresos en cuotas: `guardarPlan`, `pagarCuota`;
   - lecturas: `registrarLectura`, `cerrarPeriodo`;
   - conciliación: `asegurarCasos`, `aplicarCaso`;
   - informe mensual: `guardarBorrador`, `sellarEmision`, `firmarInforme`;
   - constancia de no adeudo: `emitirPazYSalvo`.

   Lo que solo escribe el navegador se replica **campo a campo** según el contrato de datos de la
   fase 0: egresos y su asiento, proveedores, cuentas, traspasos, cajas, presupuesto, líneas del
   banco y toda la operación.
6. **Cada fecha en su momento, en la hora de Puebla** (`America/Mexico_City`, UTC−6 todo el año).
   - Días de negocio con la fecha local, nunca `toISOString().slice(0, 10)`.
   - Meses con `new Date(año, mes − n, 1)`, nunca `setMonth`.
   - Donde un escritor sella `createdAt` o `sentAt` con «ahora», se reescribe al momento histórico
     **después**, por id del manifiesto, y solo en colecciones sin disparador de `update`.
7. **Estados finales en un solo `create`.** Un PQRS nace resuelto con su respuesta; una reserva,
   aprobada o cancelada; un acuerdo, `enviado`; una encuesta, publicada; un pase, `completed`; un
   paquete, entregado. Así no corren `onTicketUpdated`, `onReservationUpdated`,
   `onCommitteeAgreementUpdated` ni `onSurveyUpdated`.
8. **Historia sin membresías → membresías → «hoy».**
   - Los avisos a residentes y portería se resuelven por `tenantUsers`. Si las membresías de las
     cuentas demo se escriben al final, la historia no avisa a nadie de esos roles.
   - Las cuentas de Auth sí se crean al principio, sin membresía, para conocer su `uid`: un ticket
     guarda `residentId` = uid, y lo mismo las firmas y las reservas.
9. **Cero correos por construcción.**
   - Ningún callable que envíe (altas, invitaciones).
   - Durante la historia, ninguna unidad tiene residente con cuenta que avisar.
   - `tenantSettings` **sin** `notificationTemplates`.
   - Nada que active `sendScheduledReminders`, salvo que se decida (D7).
   - **Hoy la puerta de buzones no protege a Lomas:** con su bandera apagada admite cualquier
     dirección (`email.ts:218`). Por eso se propone encenderla solo ahí (D5). Aun encendida,
     **deja pasar los dominios inertes** (§12.6): lo que evita el rebote sigue siendo no abrir
     ningún camino de correo.
10. **Historia fija, «hoy» renovable.** El dinero y los informes emitidos no se recalculan cada día.
    Lo operativo del día sí: `--refrescar` cierra lo de días anteriores y siembra el día.
11. **Nada de código de producto ni despliegues.** Si la fase 0 encuentra un escritor que no acepta
    una fecha histórica, se anota y se decide. No se parchea el producto para la demo.

---

## 4. La historia

### 4.1 El conjunto (propuesta — D1)

- **Fraccionamiento de 48 casas en tres secciones** (`agrupaciones`): *Encinos*, *Fresnos* y
  *Jacarandas*, de 16 casas cada una.
- **Indiviso por superficie de lote** (150–260 m²), repartido con resto mayor para que sume
  **100,000000 %**: lo exige `repartirPorCoeficiente`, que bloquea sin él.
- **Cuota de mantenimiento** de unos $1.700–$2.600 MXN al mes según el indiviso (≈ $100.000 al mes
  el conjunto).
- **Padrón de unas 120 personas** (propietarios, inquilinos, familiares):
  - nombres ficticios;
  - correo en `@ejemplo.vivaru.app` (dominio inerte, `DOMINIOS_INERTES`);
  - **sin teléfono**, porque un número inventado puede ser de alguien.
- **Amenidades** con su política (aprobación automática o no, bloqueo por adeudo, anticipación): casa
  club / salón de eventos, alberca, palapa con asadores, gimnasio y cancha de pádel.
- **Cuentas:** operativa y fondo de reserva, más la caja chica de caseta. La CLABE no puede ser la de
  una cuenta real (ver riesgos).
- **Unos 12 proveedores:** vigilancia, jardinería, limpieza, mantenimiento de alberca, CFE, pipas,
  fumigación, impermeabilización, bombas, administración (*Sayil*), seguro y papelería.
- **Servicio medido:** agua del pozo propio, por casa y en $/m³.

### 4.2 Cohortes de pago

| Cohorte | Casas | Conducta |
|---|---|---|
| Puntuales | ~34 | Pagan cada mes antes del 10, por SPEI |
| Tardíos | ~7 | Pagan entre el 15 y el 30 |
| Morosos | ~4 | Dos o tres meses vencidos: llenan las franjas 0-30, 31-60 y 61-90 |
| Adelantado | 1 | Tres meses de golpe: anticipo y cruces |
| Pago múltiple | 1 | Salda dos meses en un solo pago |
| Revertido | 1 | Un pago duplicado se revierte |

Recaudo de ≈ 90 % en los meses cerrados y de ≈ 60 % al 12 de septiembre, porque se vence el 10.

### 4.3 Mes a mes

| Mes | Cartera y dinero | Operación | Gobierno |
|---|---|---|---|
| **Junio** | Corrida de junio por indiviso (vence el 10); lectura base del agua (31 may); egresos del mes; póliza anual del seguro | «Estrenamos Vivaru», corte de agua, fumigación; encuesta «horario de alberca» (cierra el 30); PQRS de fugas y alumbrado | Sesión del consejo (18 jun), acuerdo informativo; **informe de junio emitido el 8 jul y firmado** |
| **Julio** | Cuotas + consumo de junio; **cuota extraordinaria** (impermeabilizar la casa club) prorrateada por indiviso en dos parcialidades; 2 multas; anticipo; pago múltiple; reversión; traspaso mensual al fondo de reserva; apertura de caja chica; **egreso en 3 cuotas** (bomba sumergible) | Vacaciones y alberca; jornada de limpieza; encuesta «cámaras en accesos» | Acuerdo **con firma por unidad** («aprobación de la extraordinaria»); informe de julio emitido y firmado |
| **Agosto** | Cuotas + consumo + 2.ª parcialidad; 2.ª cuota de la bomba; reposición de caja | Mantenimiento de alberca, simulacro; PQRS con **SLA vencido** | Informe de agosto emitido **con una firma pendiente**, la del consejero demo; **constancia de no adeudo** de una casa en venta |
| **Septiembre** (1–12 y dos semanas por delante) | Cuotas de septiembre (vencen el 10: pendientes y vencidas de verdad); consumo de agosto; 3.ª cuota de la bomba pendiente (vence el 30); 2 comprobantes de residente por revisar; líneas de la última semana sin conciliar y 2 propuestas | «Fiestas patrias: horario de caseta 15 y 16», vigente; reservas próximas (noche mexicana el 15, palapa el 16); encuesta abierta; PQRS abiertos, uno por vencer hoy; visitas de hoy, dos «dentro»; paquetes pendientes | — |

**Presupuesto 2026** aprobado en asamblea el 25 de enero, con el acta en Documentos (ver D11).

### 4.4 Volúmenes aproximados

| Módulo | Documentos |
|---|---|
| Unidades / personas / amenidades / proveedores | 48 / ~120 / 5 / ~12 |
| Cobros (4 × 48 cuotas, 3 × 48 consumo, 2 × 48 extraordinaria, multas) y sus corridas | ~435 y ~10 |
| Pagos: operación, recibo y un asiento por cargo cubierto | ~170 · ~170 · ~420 |
| Anticipos, comprobantes de residente, constancias | ~3 · ~12 · 1 |
| Egresos (con su asiento), traspasos, caja | ~50 · ~8 · 1 |
| Líneas del banco y casos de conciliación | ~240 y ~240 |
| Lecturas (con foto) · informes (+ cuentas por cobrar) · presupuesto | 192 · 3 + 3 · 1 |
| Pases de visita · invitaciones QR · autorizaciones recurrentes | ~280 · ~60 · ~6 |
| Paquetes (sin foto: el producto no la guarda) · PQRS · reservas | ~180 · ~36 · ~65 |
| Comunicados · encuestas (+ respuestas) · acuerdos (+ firmas) | ~18 · 4 (+ ~110) · 5 (+ ~60) |
| Documentos y carpetas · firmas del reglamento · servicios · soporte | ~16 y ~6 · ~30 · ~6 · 1 |
| Avisos históricos de las cuentas demo | ~60 |

**Archivos:** ~190 fotos de lectura, ~12 comprobantes, 3 PDF del informe mensual y ~15 PDF más
(reglamento, actas, acuerdos, póliza, contratos, planos). Unos 220, pequeños y generados; ninguno es
un documento real. Los paquetes no llevan foto, porque el producto no la guarda.

**Cuentas de Auth:** las 4 con acceso (D3: dos residentes, el consejero y la portería) y unas 36 sin
acceso (D13).

---

## 5. Cobertura pantalla por pantalla — el criterio de «nada falte»

Salen de las 71 rutas de `src/app`. Superadmin, legales y autenticación quedan fuera (§11).

### Administración (`/admin`)

| Ruta | Lo que debe verse |
|---|---|
| `/admin` | Recaudo del mes y del mes pasado; cartera vencida; PQRS abiertos y por vencer; visitas de hoy; paquetes pendientes; reservas próximas; tendencia de cuatro meses |
| `/admin/billing` | Cuatro periodos de cuotas, la extraordinaria en dos parcialidades, consumo de agua y multas; morosos por antigüedad; anticipos; comprobantes por revisar; corridas; estado de cuenta; constancias |
| `/admin/finanzas` | Libro de junio a septiembre, ingresos y egresos por cuenta |
| `/admin/finanzas/egresos` | ~50 egresos, uno en cuotas, proveedores, cuentas por pagar |
| `/admin/finanzas/conciliacion` | Líneas del banco; casos aplicados, propuestos y detectados |
| `/admin/finanzas/medidores` | Agua potable: base y tres periodos cerrados con foto; uno cobrado |
| `/admin/finanzas/presupuesto` | 2026 aprobado contra lo ejecutado (D11) |
| `/admin/finanzas/tesoreria` | Cuenta operativa y fondo de reserva; traspasos; caja chica abierta y repuesta |
| `/admin/reports` | Informes de junio, julio y agosto emitidos, con sus firmas; reporte de comité |
| `/admin/communications` · `/admin/surveys` | Comunicados con uno vigente · encuestas cerradas con resultados y una abierta |
| `/admin/regulations` · `/admin/documents` | Reglamento con firmas por unidad · carpetas con actas, póliza y estados financieros |
| `/admin/pqrs` · `/admin/reservations` | Estados variados, SLA vencido y por vencer · historial y próximas |
| `/admin/visitors` · `/admin/packages` | Historial de tres meses y lo de hoy |
| `/admin/residents` | 48 casas en tres secciones, indivisos, propietarios e inquilinos |
| `/admin/services` · `/admin/users` · `/admin/soporte` | Servicios · portería y consejo · un caso resuelto |
| `/admin/settings` | Variantes, módulos del residente, política de reservas, marca |

### Residente (`/resident`) — con las cuentas demo (D3)

| Ruta | Lo que debe verse |
|---|---|
| `/resident` | Saldo, avisos, lo próximo |
| `/resident/account` | Estado de cuenta, pagos, recibos, saldo a favor y constancia (residente al corriente) o cargos vencidos (residente moroso) |
| `/resident/agreements` · `/resident/regulations` | Acuerdos, uno por firmar · reglamento por firmar o firmado |
| `/resident/informes` | Informes del conjunto, con la firma pendiente de agosto (consejero) |
| `/resident/communications` · `/resident/documents` · `/resident/surveys` | Lo del conjunto y la encuesta abierta |
| `/resident/pqrs` · `/resident/reservations` · `/resident/packages` · `/resident/services` | Sus propios casos, reservas y paquetes |
| `/resident/visitors` (+ `new`, `[id]`, `qr`) | Invitaciones pasadas y próximas, con QR |

### Portería (`/guard`)

| Ruta | Lo que debe verse |
|---|---|
| `/guard` · `/guard/visitors` | Visitas de hoy, dos «dentro»; historial |
| `/guard/packages` (+ `new`) | Paquetes pendientes de hoy |
| `/guard/reservations` | Reservas del día |

**Criterio de salida de toda la semilla:** recorrer cada fila de las tres tablas con su sesión y no
encontrar ni una pantalla vacía ni un número que no cuadre con otro (§7).

---

## 6. Disparadores y trabajos programados

Todos en `functions/src/index.ts`. Se disparan con cualquier escritura, también con el Admin SDK.

| Pieza | Qué haría con la semilla | Cómo se neutraliza |
|---|---|---|
| `onCommunicationCreated` | Aviso a todos los residentes activos | Sin membresías de residente durante la historia |
| `onPackageCreated` | Residentes de la unidad; portería si está pendiente | Sin membresías; los históricos nacen entregados |
| `onVisitorPassCreated` | Portería, y un segundo aviso si la fecha es hoy | Sin membresía de portería durante la historia |
| `onBillingStatementCreated` | Aviso de cobro (y correo si una plantilla lo enciende) | Sin residentes con cuenta durante la historia; sin plantillas |
| `onPaymentVoucherCreated` | Aviso del recibo a los residentes de la unidad | Sin residentes con cuenta durante la historia |
| `onRegulationDocumentCreated` | Aviso a todos los residentes | Sin membresías de residente durante la historia |
| **`onTicketCreated`** | **Admins del conjunto y TODOS los superadmin** | **No se puede evitar sin tocar código:** se limpian al acabar (D6) |
| **`onReservationCreated`** | **Admins, TODOS los superadmin**, y el residente si nace aprobada automáticamente | Igual que el anterior (D6) |
| `sombraPqrsAlCrearTicket` | Llamaría a Vertex | Ya se salta: el conjunto es `isExample` (comprobado) |
| Disparadores de `update` | Avisos de cambio de estado | Estados finales en el `create` (§3.7) |
| `updateOverdueStatements` (07:00 UTC, todos los conjuntos) | Pasa a `overdue` lo pendiente vencido y avisa | Lo vencido nace `overdue`; lo de septiembre vence en vivo, como en un conjunto real |
| `publishScheduledCharges` (08:00 UTC) | Publica cobros **reales** de un programado vencido | Programados solo en estado final (D10) |
| `sendScheduledReminders` (09:00 UTC) | Recordatorios si hay `billingCalendar` | Sin `billingCalendar` (D7) |
| `notifyPendingVisitorExits` (08:00 UTC) | Alerta por visitas que siguen «dentro» | Solo las de hoy quedan dentro; `--refrescar` las cierra |
| `monthlyFinancialArchive` (día 1, 06:00 UTC) | Archivo de cartera y borrador del informe **del mes anterior**; no rellena hacia atrás | El 1 oct hará septiembre él solo; junio a agosto los hace la semilla |

**Correo:** `deliverResidentNotifications` solo envía con `notificationTemplates[clave].emailEnabled`,
y las 13 claves del catálogo traen `emailDefault: false`. **Push:** apagado en Lomas
(`producto-notificaciones-push`).

---

## 7. Invariantes del dinero, y cómo se comprueban

Un verificador de **solo lectura** (`verificar-historia-demo.mjs`) los recalcula con las funciones
puras del producto, no con una copia.

1. **Cada cargo:** `balance` y `status` coinciden con `calcularSaldo` (`payments.ts`).
2. **Cada pago:** su operación, un asiento por cargo cubierto con la fecha del pago y la cuenta del
   concepto, su recibo, y la suma de repartos más el sobrante igual al importe.
3. **Sin doble conteo:** ningún ingreso de cuota escrito a mano; el recaudado es `paymentAmount` por
   periodo (`esRecaudoDeCartera`).
4. **Anticipos:** `remaining` = importe − cruces, y `advanceAppliedAmount` cuadra en los cargos.
5. **Egresos:** cada egreso pagado apunta a su asiento; en cuotas, `paidAmount` = cuotas pagadas y un
   asiento por cuota.
6. **Conciliación:** cada línea conciliada ↔ su asiento (o traspaso) ↔ su caso `aplicado`.
7. **Indivisos:** suman 100 %, y cada corrida por indiviso cuadra con ellos.
8. **Lecturas:** la anterior de un periodo es la actual del periodo previo; la primera es la base.
9. **Informes:** la instantánea guardada es igual a `construirInstantanea` recalculada; los emitidos
   no cambian.
10. **Plan de cuentas:** todo `accountCode` usado existe; la constancia se emitió con saldo 0.
11. **Ids:** todo lo que no está en el manifiesto lleva `${tenantId}--`; nada fuera del conjunto se
    tocó.

---

## 8. Fases y tareas

El ensayo va por ambientes: **emulador → staging → producción**. El script se construye por
dominios, y cada dominio pasa por el emulador antes de sumarse.

### Fase 0 — Contrato de datos y verificaciones (solo lectura)

**Cerrada el 13 sep.** Los resultados están en §12; el contrato, en su propio fichero.

**T0.1 · Contrato de datos del navegador.** Por cada colección que solo escribe el cliente, los
campos exactos, sus tipos y su origen: unidades, personas, amenidades, proveedores, cuentas y saldos,
egresos y su asiento espejo, traspasos, cajas, presupuesto, líneas del banco (`idDeLinea`), servicio
medido, comunicados, encuestas y respuestas, acuerdos y firmas, documentos, carpetas y firmas del
reglamento, pases, invitaciones y autorizaciones, paquetes, tickets, servicios y soporte.
- **Sale:** una tabla por colección anexa a este plan, citando la función, no la línea.
- **Ojo:** `communications.publishedAt` tiene **dos tipos** según quién escribe (Timestamp en
  `admin/services.ts`, cadena ISO en `use-communications.ts`). Hay que ver cuál usa la pantalla hoy y
  sembrar solo ese: mezclados, se ordenan por separado.

**T0.2 · Propiedades de los escritores.**
- Si `aplicarPago` es idempotente por `operationKey` o hay que comprobar antes.
- Qué fechas acepta cada escritor, y cuáles sella con «ahora» (`issueDate` del recibo, `sentAt` de
  la corrida, `createdAt` de los asientos).
- Dónde se genera el PDF del informe: si solo en el callable (`index.ts`), la emisión y las firmas de
  junio a agosto se deciden aparte.
- Qué exige `registrarLectura` de la foto.
- Qué campo liga un aviso con su documento de origen, para poder limpiarlo por id.
- **Sale:** una lista de sí/no con su prueba.

**T0.3 · Onboarding.** Qué pide cada paso del checklist y qué parte de la semilla lo cumple. Aquí
decía «15 pasos, 7 + 8»: para un cliente son 17, 10 + 7 (§12.5).
- **Sale:** todos cumplidos por construcción, o la lista de lo que falta sembrar.

**T0.4 · Mediciones.**
- Cuántos superadmin recibirán avisos (`users.role == superadmin`).
- Qué valida el producto de una CLABE.
- Si tus alias están en `config/correosDelEquipo` (para D5).
- Si alguna regla cierra los campos de una edición.
- Qué pide `producto-rol-consejo` para que el consejero vea los informes.

**Checkpoint 0:** contrato y verificaciones escritos; tus decisiones D1–D12 contestadas.

### Fase 1 — La herramienta y el guion (código, sin datos reales)

Cada tarea corre contra el emulador (Firestore + Storage) y deja el verificador en verde en su
dominio.

| Tarea | Qué | Criterio de salida | Depende de |
|---|---|---|---|
| **T1.1** Esqueleto y seguridad | Argumentos, negativas (sin proyecto, sin `isExample`, producción sin `--si-produccion`), simulación que imprime el plan de escritura, manifiesto, `crearSiFalta` que mira el `tenantId`, reloj de Puebla | La simulación imprime conteos por colección y no escribe; las negativas se falsan una a una | T0.1 |
| **T1.2** El guion | `historias/lomas-de-sayilbedra.mjs`: casas, indivisos, padrón, cohortes, calendario; generador determinista con semilla fija | Pruebas puras: indivisos = 100 %, fechas locales, sin `setMonth`, ids con prefijo, correos inertes salvo los alias de D3 | D1, D2, D3, D12 |
| **T1.3** El verificador | `verificar-historia-demo.mjs`, los 11 invariantes de §7 | **Falsado:** romper a propósito un asiento, un saldo y un indiviso, y ver enrojecer exactamente esas comprobaciones | T1.1 |
| **T1.4** Padrón y configuración | Ajustes, unidades, personas, amenidades, proveedores, cuentas y saldo de apertura (31 may), servicio medido, cuentas de Auth sin membresía | Conteos del guion; `claveDeUnidad` en todo `unitId` | T1.2 |
| **T1.5** Cartera y pagos | Corridas por indiviso, prorrateo de la extraordinaria, multas, pagos por cohorte, anticipo y cruces, reversión, comprobantes | Invariantes 1–4 en verde; recaudo por mes igual al del guion | T1.4, T0.2 |
| **T1.6** Egresos, tesorería y banco | Egresos y asientos, la bomba en cuotas, traspasos, caja, líneas del banco y conciliación | Invariantes 5 y 6; la última semana queda sin conciliar | T1.5 |
| **T1.7** Medidor, presupuesto, informes, constancia | Lecturas con foto y corrida de consumo; presupuesto; informes de junio a agosto con firmas; constancia | Invariantes 8–10; cada informe igual a su instantánea recalculada | T1.6 |
| **T1.8** Operación | Comunicados, encuestas, acuerdos, documentos y reglamento, reservas, visitas, paquetes, PQRS, servicios, soporte, con archivos | Estados finales en el `create`; conteos del guion | T1.4 |
| **T1.9** Cuentas, «hoy», avisos y refresco | Membresías al final; avisos históricos de las cuentas demo; `tenantOnboarding.seen` de los dos portales; lote de hoy; limpieza de avisos por captura (§12.1); `--refrescar` | Tras la corrida, cero avisos de la historia en los buzones de admin y superadmin (si D6 = limpiar) | T1.5–T1.8 |

**Las nueve, hechas el 13 sep.** Lo construido, lo medido y lo que cambió del diseño, en §13.

**Checkpoint 1 (emulador):** la corrida completa pasa **dos veces** sin duplicar (idempotencia);
`--limpiar` deja el conjunto como estaba; el verificador sale en verde. Pruebas y typecheck de
functions en 0, con `npm --prefix functions run typecheck`. **Cumplido el 13 sep (§13.2).**

### Fase 2 — Ensayo en staging

| Tarea | Qué | Criterio de salida |
|---|---|---|
| **T2.1** Conjunto de ensayo | «Lomas de Sayilbedra (ensayo)» en `vivaru-staging-02`, `isExample`, activo, con las mismas banderas (D9) | Existe y resuelve las banderas como Lomas en producción. **Hecho el 13 sep: `fnBFuQe2p8h5fwy3jpeB`** (§12.8) |
| **T2.2** Corrida con disparadores reales | `--escribir` en staging, con las functions desplegadas | Los únicos avisos nacidos son los de tickets y reservas previstos en §6, y la captura D6 llega a los esperados (§13.4); **cero** correos; cero llamadas a IA (`aiUsage` sin cambio) y una fila `omitida · sembrado` por PQRS en `aiAssistance` |
| **T2.3** Recorrido | Las tres tablas de §5, con la sesión de admin, dos de residente, la de consejero y la de portería (tú abres cada sesión, yo recorro) | Ninguna pantalla vacía; los números cuadran entre Cartera, Libro, Conciliación, Informe y Panel |
| **T2.4** Limpieza y resiembra | `--limpiar` y otra corrida | Queda como estaba antes, y la segunda corrida da lo mismo que la primera: los mismos conteos y los mismos totales. El reparto de un pago parcial entre cargos que vencen el mismo día puede cambiar (contrato, H.17) |

**Checkpoint 2:** revisión contigo de lo visto en staging antes de tocar producción.

### Fase 3 — Producción

Cada paso lleva su permiso.

| Tarea | Qué | Criterio de salida |
|---|---|---|
| **T3.1** Banderas | Overrides en Lomas (D4) con `mover-bandera-de-conjunto.mjs` | Resueltas conjunto por conjunto con `functions/lib/feature-flags.js` |
| **T3.2** Puerta de buzones | `sinClienteDetras` y la bandera solo en Lomas (D5) | Un correo real desconocido, rechazado al editar una persona; los inertes y los del equipo, admitidos (§12.6) |
| **T3.3** Simulación | Sin `--escribir`, contra `hogaru-1` | El plan de escritura coincide con el de staging |
| **T3.4** Corrida | `--escribir --si-produccion` | Manifiesto completo; verificador en verde |
| **T3.5** Recorrido y limpieza de avisos | §5 con las sesiones reales; limpieza de avisos (D6) | Nada vacío; buzones de admin y superadmin sin el ruido de la historia |

### Fase 4 — Cierre

- **T4.1** Commit del script, el guion, el verificador y este plan, **con tu sí en el chat**.
  No hay despliegue: el script no se despliega.
- **T4.2** Runbook corto de `--refrescar` antes de una demo.
- **T4.3** `docs/pendientes.md`, roadmap, bitácora de Notion, wiki y memoria.

---

## 9. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Un correo sale a una dirección inerte o ajena | Alto: rebote contra la reputación del dominio | Cero caminos de correo por construcción (§3.9). La puerta en Lomas (D5) bloquea las direcciones ajenas, pero **deja pasar las inertes** (§12.6). En staging se comprueba que no nazca ningún envío |
| Ruido en la campana del superadmin y del admin | Medio | Captura durante la corrida y borrado por id (D6, §12.1); en `--refrescar`, solo visitas y paquetes |
| Dinero incoherente (libro contra cartera, doble conteo) | Alto: la demo se desmiente sola | Escritores del producto; verificador falsado; nada de ingresos de cuota a mano |
| Ids que pisan otro conjunto | Alto: ya costó cinco unidades de El Nogal | Prefijo `${tenantId}--` y comprobación del `tenantId` del documento que ya existe |
| Corrida cortada a medias (credenciales que caducan, red) | Medio | Idempotente y reanudable por fase (`--fase=N`); manifiesto por lotes |
| La demo envejece | Medio: a las dos semanas no hay nada «de hoy» | `--refrescar`; reservas próximas sembradas con dos semanas de margen |
| Una CLABE inventada es de alguien | Medio | El producto no valida la CLABE: se usa una con dígito de control inválido, que no puede ser una cuenta real. Una prueba de T1.2 lo comprueba |
| Un escritor sella «ahora» donde la pantalla enseña la fecha | Bajo–medio | La lista está en §12.2; se reescribe después por id, solo en colecciones sin disparador de `update` |
| El PDF del informe solo lo genera el callable | Medio | Confirmado (§12.2): se pinta con `buildInformeMensualPdf` y se archiva a mano. La firma pendiente de agosto se hace en vivo desde la interfaz |
| La auditoría queda vacía para lo sembrado | Bajo: ninguna pantalla de conjunto la lee | Aceptado y dicho (§11) |
| Los datos de la demo se citan como uso real | Alto para decisiones | Esto es escaparate, no evidencia: ninguna cifra se cita como frecuencia (lección de datos inventados) |

---

## 10. Decisiones tuyas

> **Decididas el 12 sep por la noche: todas con la recomendación, salvo D9, que queda abierta**
> (no llevaba una sola recomendación). **El 13 sep, tras la fase 0, se cerraron las que quedaban:**
> D11 sin asientos de apertura, D13 sí, y D9 la resuelvo yo. Decidir no es autorizar: las banderas,
> la puerta y el borrado de avisos en producción se vuelven a pedir en el momento de hacerlos.

| # | Decisión | Recomendación |
|---|---|---|
| **D1** | Tamaño y forma del conjunto | **48 casas en tres secciones** |
| **D2** | Ventana | **1 jun → 12 sep, más dos semanas**; tres informes emitidos |
| **D3** | Cuentas con login y sus correos | **Residente al corriente, residente moroso, consejero y portería**, con alias `+lomas-…` de tu hotmail: llegan a tu buzón y tú pones la contraseña con «¿Olvidaste tu contraseña?». Con correos inertes no habría forma de entrar |
| **D4** | Banderas en Lomas (override) | **Presupuesto, medidor, tesorería y `producto-rol-consejo`**. La última la necesita el consejero para ver y firmar informes (§12.6) |
| **D5** | Puerta de buzones solo en Lomas | **Sí**, como red: `sinClienteDetras` y la bandera por override (es la mitad de Lomas del punto 8 del menú). Deja pasar los dominios inertes y bloquea las direcciones reales desconocidas; no hace falta añadir los alias `+lomas-…` (§12.6) |
| **D6** | Avisos que la siembra dispara «hoy» en tu buzón y en el del superadmin (uno por ticket y reserva de la historia) | **Borrarlos al acabar, capturados durante la corrida**: los avisos no guardan el id de su origen (§12.1). Alternativas: dejarlos marcados como leídos, o dejarlos |
| **D7** | Calendario de cobranza (`billingCalendar`) | **No**: con él, el cron avisa cada mes a las cuentas demo |
| **D8** | Modo `--refrescar` antes de cada demo | **Sí** |
| **D9** | Conjunto de ensayo en staging | **Lo creo yo** (decidido el 13 sep): «Lomas de Sayilbedra (ensayo)» en `vivaru-staging-02` |
| **D10** | Un cobro programado para octubre | **No**: el cron publicaría cobros reales el 1 oct sin que nadie lo mire |
| **D11** | Presupuesto 2026 con ejecución solo desde junio | **Cambio propuesto (§12.7): sin asientos de apertura.** Recomendé sembrar enero–mayo, y la premisa era falsa: el presupuesto no marca la subejecución, y esos asientos se contarían dos veces en la posición de fondos. **Pendiente de tu sí** |
| **D12** | Identidad | **Nombres ficticios, sin teléfonos y una CLABE con dígito de control inválido**: no puede ser una cuenta real, y el producto no la valida |
| **D13** | Cuentas de residente sin acceso para las ~36 casas que interactúan | **Sí** (§12.7): correo inerte, sin contraseña, membresía escrita al final. **Pendiente de tu sí** |

---

## 11. Fuera de alcance

- **Código de producto, reglas, functions o despliegues.** La semilla usa lo que hay.
- **Medir con esto.** Es escaparate, no evidencia: contesta «¿se ve bien?», nunca «¿cómo es un
  conjunto real?».
- **IA** (`aiUsage`, `aiAssistance`), **push**, **visita no anunciada** (pide push) y **auditoría**:
  los escritores del producto llamados directamente no pasan por `writeAuditLog`, que es privado de
  `index.ts`.
- **Superadmin**, salvo lo que ya enseña la ficha del conjunto.
- **Las Playas**: no se toca.

---

## 12. Anexo — fase 0

Solo lectura: código del repositorio y producción (`hogaru-1`), la noche del 12 al 13 de septiembre.

### 12.1 Mediciones en producción (T0.4)

| Pregunta | Lo medido | Consecuencia |
|---|---|---|
| ¿Cuántos superadmin reciben los avisos de tickets y reservas? | **Uno**: `superadmin@hogaru.co` | Cada ticket y cada reserva de la historia deja **dos** avisos: uno a hotmail (admin de Lomas) y otro al superadmin |
| ¿Están los alias de las cuentas demo en `config/correosDelEquipo`? | **No.** Las direcciones son `+porteria`, `+res1`, `+res2` y `+res3` (ya usadas por Las Playas), gmail, hotmail y `luiseoteror@gmail.com`. Los dominios, `qintilab.com` y los cinco inventados por las semillas | **No hace falta añadirlas.** El restablecimiento de contraseña es nativo de Firebase y no pasa por la puerta, y la semilla no usa las altas del producto (§12.6). Solo harían falta para editar sus correos o reenviar invitaciones desde la interfaz |
| ¿Un aviso guarda el id de su documento de origen? | **No.** `link` es una ruta genérica (`/admin/pqrs`, `/admin/reservations`, `/superadmin/analytics`). El aviso del superadmin lleva `tenantId: null`, y su texto dice «Tenant PoyiASYEYoPSMulCWPJa registro un nuevo PQRS.» | **D6 cambia de mecanismo:** se capturan los avisos nacidos durante la corrida, de tipo `ticket` o `reservation`, dirigidos a esas dos cuentas y con el id de Lomas en `tenantId` o en `description`. Se apuntan en el manifiesto y se borran por id exacto |
| ¿Qué categorías de egreso hay en producción? | Fuera del tipo (`nomina`, `servicios_publicos`, `mantenimiento`, `proveedores`, `administracion`, `seguros`, `impuestos`, `vigilancia`, `otros`) solo aparecen **`seguridad` (8) y `servicios` (16)**, en Queretarock 229 y Residencial Qintilab, y los dos conjuntos los sembró el trial | Lomas usa solo categorías del tipo. De paso queda medido el punto 15 del menú: esas son las dos categorías fuera del tipo |
| ¿Qué forma tiene lo que escribe el producto? | Claves y tipos de los dos documentos más recientes de 42 colecciones | Las semillas viejas no son modelo: Las Playas tiene líneas de banco con id `bankline-playas-NNN` (no `idDeLinea`), cobros sin `accountCode` y paquetes sin foto |

### 12.2 Los escritores del producto (T0.2)

`functions/lib` está al día: `lib/index.js` es del 12 sep a las 17:08, y ningún `.ts` es más nuevo
que su `.js`. **Ninguno escribe `auditLogs`**: `writeAuditLog` es privado de `index.ts`.

| Escritor | ¿Sirve para historia? | Cómo |
|---|---|---|
| `aplicarPago` | **Sí** | `date` va al asiento, al recibo (`issueDate`) y a `lastPaymentAt`; el PDF del recibo lo pinta el cliente con esa fecha. Idempotente por `operationKey`, que es **global**: llevará el conjunto. Siempre con `bankAccountId`, para poder conciliar. En orden cronológico, porque reparte según la deuda de ese momento. `status` se calcula contra el día UTC real |
| `cruzarAnticipo` | **Sí** | `date` de entrada; comprueba `producto-anticipos` por dentro |
| `revertirPago` | **No acepta fecha** | La reversión va **al final** de la historia, el día de la corrida; el pago duplicado, la víspera |
| `generarCorridaPorCoeficiente`, `repartirEgreso`, `generarCorridaDeConsumo` | **Sí, reescribiendo `sentAt` y `createdAt`** | Dejan todo `pending` aunque haya vencido. El estado se recalcula con `calcularSaldo` al cerrar cada mes, para que el cron no avise en masa. Exigen indivisos al 100 % y `ownerIds` o `billingResponsiblePersonId` en cada unidad |
| `guardarPlan`, `pagarCuota` | **Sí** | `paidAt` de entrada; `pagarCuota` exige cuenta de salida activa y deriva `accountCode` de la categoría |
| `registrarLectura`, `cerrarPeriodo` | **Sí, reescribiendo `readAt` y `closedAt`** | La base (31 may) antes que junio. Guardar no exige foto; cerrar y cobrar sí. La foto va en `tenants/{t}/meter-readings/{servicio}/{unidad}-{periodo}.jpg`, con token (el patrón de `sembrar-demo-finanzas.mjs`) |
| `asegurarCasos`, `aplicarCaso` | **Sí, reescribiendo `reconciledAt` y el historial del caso** | Después de sembrar los asientos. Mismo signo, cuenta compatible y fechas a 3 días o menos |
| `guardarBorrador`, `sellarEmision`, `firmarInforme` | **Con trabajo** | La instantánea lee el estado **actual**: se construye en su punto cronológico. **El PDF no está en el módulo**: se pinta con `buildInformeMensualPdf` (`lib/pdf-resumen.js`, exportado) y se archiva a mano como `archiveBuffer` (no exportado), en `tenants/{t}/monthly-reports/informe_{t}_{periodo}.pdf` y `documents/informe_{t}_{periodo}`. `issuedAt` y `signedAt` se reescriben **antes** de pintar, porque salen impresos |
| `emitirPazYSalvo` | **Sí, en su punto** | `issueDate` de entrada; exige saldo 0 en el momento de llamarla. El PDF lo pinta el cliente |
| `crearReserva`, `crearMudanza` | **No: rechazan fechas pasadas** | Escritura directa con su forma, validada con `evaluarReglasDeReserva` y `construirMudanza`, que aceptan un «ahora» inyectado |
| Altas de cuenta | **No se pueden importar** | A mano: Auth sin contraseña, claims `{role, tenantId}`, `users`, `tenantUsers` y `people.authUid`. El consejero, con `aplicarMarcaDeConsejo` (`lib/rol-consejo.js`) |

### 12.3 Lo que cambia en el diseño

1. **Siembra cronológica, mes a mes.** Tres escritores leen el estado del momento: el informe, la
   constancia y el reparto de los pagos. Orden de cada mes:
   1. las corridas;
   2. las lecturas;
   3. los pagos, por fecha;
   4. los egresos y las cuotas;
   5. los traspasos;
   6. las líneas del banco y la conciliación;
   7. el estado de los cobros, con `calcularSaldo`;
   8. y, ya en el mes siguiente, la instantánea, la emisión y las firmas del informe.
2. **Reescritura de las marcas técnicas, por id del manifiesto,** solo en colecciones sin disparador
   de `update`: `billingCampaigns`, `billingStatements`, `meterReadings`, `ledgerEntries`,
   `reconciliationCases`, `monthlyReports` y `paymentOperations`. Los únicos disparadores de `update`
   están en reservas, acuerdos, tickets y encuestas.
3. **Hallazgo del producto, para mirar aparte:** el saldo de apertura del informe mensual es la suma
   de `bankAccountBalances.openingBalance` **y no se arrastra de un mes al siguiente**. Julio abre con
   la misma cifra que junio, no con el cierre de junio. Queda por ver si `PRD-V-FLOW-007` lo tiene
   escrito como límite conocido. La demo lo va a enseñar tal cual.

### 12.4 Contrato de datos (T0.1)

Está entero en `docs/plan-seed-demo-lomas-de-sayilbedra-contrato.md`, con las secciones A a H. Lo
que cambia el diseño:

1. **Casi toda interacción de un residente guarda su `uid`**: `residentId` del ticket, `createdBy`
   de la reserva, `residentUserId` de la invitación, `signedBy` de las firmas y `uploadedBy` de los
   comprobantes. La historia necesita cuentas de residente para las casas que interactúan → **D13**.
2. **Los paquetes no llevan foto:** el producto no la guarda. Salen ~180 archivos del plan.
3. **El flujo real de visitas con QR es la invitación del residente.** Escribe dos documentos: la
   invitación y el pase, con `scheduledTime` en ISO.
4. **Las reservas llevan la forma de `crearReserva`.** La del admin no trae `amenity`, y la portería
   lo pinta vacío. No existe el estado `rejected`.
5. **El SLA del PQRS sale de `radicationDate`** (15 días hábiles). «Por vencer» y «vencido» se
   consiguen eligiendo esa fecha.
6. **El presupuesto se mide contra el importe anual**, sin marca de subejecución. La premisa de D11
   era falsa (§12.7).
7. **Los egresos pagados llevan `paidAt` histórico y `ledgerEntryId`.** El proveedor va como copia
   del nombre: el navegador no escribe `vendorId`.
8. **Las cuentas bancarias llevan `MXN` escrito**, porque el formulario trae `COP`, y **una CLABE con
   dígito de control inválido**: el producto no valida la CLABE, y una inválida no puede ser de nadie.
9. **Dos colecciones se escriben directamente:**
   - las carpetas de documentos, con la forma de sistema, porque solo las crean callables;
   - el soporte, porque su callable manda correo al equipo.

### 12.5 Onboarding (T0.3)

- **Lomas tiene `onboardingTrack: "cliente"` desde la conversión, así que su checklist son 17 pasos**:
  10 de activación y 7 de descubrimiento. No son los 15 (7 + 8) de la caché de `tenantOnboarding`,
  escrita cuando era prueba.
- Desaparece cuando los 17 están hechos. No se puede descartar: «Ocultar» solo lo pliega en ese
  navegador.
- **La semilla los cumple por construcción** con:
  - las agrupaciones;
  - unidades, personas y áreas comunes sin `isExample`;
  - un `users` de portería y otro de residente sin `isDemoAccount`;
  - cobros, y un pago con `paymentAmount > 0`;
  - al menos un documento en pases, comunicados, tickets, paquetes, encuestas, servicios y documentos.
- **Lo único que se escribe aparte:** `tenantOnboarding/{t}.seen` con `portal-porteria` y
  `portal-residente` como **cadenas ISO** (un Timestamp se ignora). Es la marca de «ya lo recorrí».

### 12.6 Reglas y banderas (T0.4)

- **Un campo de más no rompe ninguna edición; uno que falta, sí**, allí donde la regla compara sin
  `.get()`:
  - `notifications`: `userId`, `tenantId`, `type`, `title`, `description` y `link` (`null` vale). Sin
    ellos falla «marcar como leída».
  - `reservations`: los nueve que compara la cancelación del residente (`tenantId`, `unitId`,
    `createdBy`, `amenityId`, `amenity`, `date`, `startTime`, `endTime`, `slot`).
  - `visitorPasses`: `checkInAt: null` y `checkOutAt: null` explícitos; si no, la portería no puede
    dar ingreso.
  - `users` (`uid`, `role`, `tenantId`) y `tenantUsers` (`uid`, `tenantId`, `role`, `status`,
    `email`, `unitId`, `unitLabel`).
- **Congelan un documento para la interfaz, a propósito:**
  - un cobro `cancelled`;
  - un asiento de cobro o de anticipo;
  - un presupuesto aprobado;
  - un traspaso con una línea casada.

  **Bloquea toda edición** un tipo malo en la política de un área común.
- **`producto-rol-consejo` hace falta** para que el consejero vea «Informes del conjunto» y firme
  desde la interfaz. También hacen falta `producto-informe-mensual`, que está encendida para todos, y
  un informe emitido. Firmar desde la interfaz rehace el PDF: **la firma pendiente de agosto se puede
  hacer en vivo durante la demo**.
- **Presupuesto, medidor y tesorería:** encenderlas por conjunto basta, porque no hay kill switch.
  Sus entradas de menú se pintan siempre.
- **La puerta de buzones, con matiz:**
  - Encendida, **admite los dominios inertes** (no hay filtro que evite escribirles) y bloquea las
    direcciones reales que no estén en la lista.
  - **El «¿Olvidaste tu contraseña?» es nativo de Firebase y no pasa por la puerta.** Las cuentas
    `+lomas-…` pueden restablecer su contraseña sin estar en `config/correosDelEquipo`.
  - Añadirlas a esa lista solo haría falta para editar sus correos o reenviar invitaciones desde la
    interfaz.

### 12.7 Estado de la fase 0, y lo que queda para ti

**Cerrada en la madrugada del 13 sep (UTC).** T0.1–T0.4 contestadas; no se ha escrito nada en ningún
ambiente. Antes de la fase 1 quedaban tres decisiones, **y las tres se tomaron el 13 sep: D11 sin
asientos, D13 sí, y D9 la resuelvo yo** (el conjunto de ensayo, en §12.8):

1. **D11: propongo cambiarla a «sin asientos de apertura».** La recomendé para que el presupuesto no
   saliera en rojo, y la premisa era falsa:
   - el presupuesto compara contra el importe anual;
   - no marca la subejecución de egresos;
   - los ingresos salen «faltante» a mitad de año, con o sin enero–mayo.

   Además, el saldo inicial del banco no tiene fecha y la posición de fondos lo suma a todo el libro:
   los asientos de enero a mayo **se contarían dos veces**. Y la interfaz nunca produce un asiento
   manual con cuenta contable.
2. **D13 (nueva): cuentas de residente sin acceso.** Para que tickets, reservas, invitaciones y firmas
   tengan dueño, unas 36 casas necesitan una cuenta, con estas condiciones:
   - correo inerte y sin contraseña: no se puede entrar con ellas;
   - membresía escrita al final;
   - `people.authUid` enlazado.

   Serían unas 40 cuentas de Auth en producción, que `--limpiar` borra. **Recomendación: sí.** La
   alternativa son solo las cuatro con acceso y una historia mucho más pobre: tres casas que firman,
   tres que reservan…
3. **D9: el conjunto de ensayo en staging**, que sigue abierto.

Dos cambios ya incorporados: D6 se hace **por captura** (§12.1), y D4 incluye `producto-rol-consejo`
(§12.6).

### 12.8 El conjunto de ensayo en staging (D9 y T2.1)

**Creado el 13 sep a las 02:40 UTC:** `fnBFuQe2p8h5fwy3jpeB`, «Lomas de Sayilbedra (ensayo)», en
`vivaru-staging-02`.

| Pieza | Cómo | Resultado |
|---|---|---|
| Conjunto y ajustes | Con los mismos campos que dejan `createTenantWorkspace` y `convertTenantToCustomer`: activo, `planId: completo`, `onboardingTrack: cliente`, Puebla, MX, MXN y variantes completas. Además, `isExample` y `sinClienteDetras`. Con un script de un solo uso, pasado primero en seco | Escrito. Sin `managementCompanyId`: staging no tiene administradoras |
| Plan de cuentas | `sembrarPlanDeCuentas` de `functions/lib`, la misma función que usa el alta | 22 cuentas |
| Banderas | 16 overrides con `mover-bandera-de-conjunto.mjs`. **Encendidas, 11:** las 6 que el global de staging deja apagadas (anticipos, concepto al libro, egresos en cuotas, informe mensual, pago múltiple y plan de cuentas), las 4 de D4 y la puerta de D5. **Apagadas, 5:** las cuatro de IA que en staging están encendidas y `producto-expediente-conciliacion` | **Resuelve igual que Lomas en producción tras D4 y D5**: 25 de 33 encendidas, ninguna diferencia, medido con `resolveFeatureFlag` |
| Admin | `sembrar-membresias-multiconjunto.mjs` para `david.macar.18@hotmail.com`, en seco y luego escrito | Esa cuenta tiene ahora 8 membresías de admin en staging. La del ensayo no lleva `compartida`, porque las que crea el script no la llevan |
| Todo lo demás | — | El conjunto tiene exactamente 22 `chartOfAccounts`, 1 `featureFlagOverrides`, 1 `tenantSettings` y 1 `tenantUsers` |

**Diferencias con producción que se dejan a propósito:**

- **Las banderas globales de staging no se tocaron.** Difieren de producción en 11 claves, y todo el
  ajuste va por override de este conjunto.
- **`config/correosDelEquipo`** en staging solo lista `qintilab.com`.
- **El único superadmin** de staging es otra cuenta, `bPfmiGdRgrSBbFvElu1OulU0MCs2`.

**Cómo deshacerlo:**

1. `sembrar-membresias-multiconjunto.mjs … --retirar`.
2. `mover-bandera-de-conjunto.mjs … quitar`, clave por clave.
3. Borrar por id exacto `tenants/`, `tenantSettings/`, `featureFlagOverrides/` y las 22
   `chartOfAccounts/{id}_{código}`.

---

## 13. Fase 1 — lo construido y lo encontrado (13 sep)

**Cerrada contra el emulador la noche del 12 al 13 sep.** No se escribió nada en staging ni en
producción.

### 13.1 Qué hay

| Pieza | Fichero |
|---|---|
| Punto de entrada: sembrar, `--refrescar` y `--limpiar` | `functions/scripts/sembrar-historia-demo.mjs` |
| Verificador (solo lee) | `functions/scripts/verificar-historia-demo.mjs` |
| El guion, puro y determinista | `historias/lomas-de-sayilbedra.mjs` (padrón, cartera, egresos, banco y gobierno) y `historias/lomas-operacion.mjs` (operación y el día en la portería) |
| Motor, reloj de Puebla, azar con semilla y archivos (fotos y PDF) | `historias/motor.mjs`, `reloj.mjs`, `azar.mjs` y `archivos.mjs` |
| Inventario del conjunto: línea base, completar el manifiesto y limpiar | `historias/barrido.mjs` |
| Escritores por dominio | `historias/escritores/`: padrón, cartera, egresos, banco, medidor, informes, operación, cuentas y avisos |
| Preparar el emulador | `historias/preparar-emulador.mjs` |
| Pruebas puras (15) | `functions/tests/semilla-historia.test.ts` |

### 13.2 Lo medido (emulador, `--hoy=2026-09-13`)

- **Una corrida desde cero tarda unos 31 s** y deja 4.468 documentos, 40 cuentas y 227 archivos:
  - 48 casas y 134 personas;
  - 435 cargos (recaudo: junio 100 %, julio 98 %, agosto 90 %, septiembre 77 %), 394 operaciones de
    pago y 448 asientos;
  - 434 líneas del banco, 400 conciliadas;
  - 192 lecturas y 3 informes con 5 firmas;
  - 154 reservas, 272 pases, 170 paquetes y 34 PQRS;
  - 4 encuestas con 87 respuestas, 5 acuerdos con 61 firmas y el reglamento con 29;
  - 253 avisos en los buzones de las cuatro cuentas con acceso.
- **La segunda corrida no crea nada.**
- **El verificador tiene 36 comprobaciones y salen en verde.** Todas las nuevas se falsaron rompiendo
  un dato por comprobación, O1–O7 (operación) y V1–V4 (cuentas, guía, avisos y manifiesto): enrojece
  exactamente la suya, y al reponer vuelve el verde.
- **`--limpiar` borra 4.468 documentos, 40 cuentas y 227 archivos** y devuelve los ajustes y la guía.
  El barrido final no encuentra nada fuera de la línea base, y una resiembra sobre lo limpiado da 36
  de 36.
- **`--refrescar` al día siguiente** cierra las 2 visitas «dentro» y entrega los 3 paquetes del día
  anterior, y siembra el día. Con `--hoy` de ese día, 36 de 36.
- Banco de functions en **1.030 de 1.030** y typecheck en 0.

### 13.3 Lo que cambió respecto al diseño

1. **`--limpiar` sigue borrando por id exacto, pero el manifiesto se completa con un barrido.**
   - La primera corrida guarda la **línea base**: lo que el conjunto ya tenía.
   - Al final de cada corrida se apunta todo documento del conjunto que no esté ni en la línea base
     ni en el manifiesto.
   - Los escritores del producto crean cosas que la semilla no apunta, como los asientos de la
     reversión (`revertirPago` no deja fecharlos) y la guía. El barrido las encontró: seis.
   - El verificador comprueba que todo está en uno de los dos (V4).
2. **Las reservas pasan por `evaluarReglasDeReserva`, con el «ahora» del momento en que se hicieron.**
   Si la casa propuesta debe o agotó su cupo, se prueba otra; si la regla dice que no por el horario
   o el aforo, esa reserva no existió (1 de 155).
3. **El buzón de las cuentas con acceso se deriva de los datos sembrados**, con los textos del
   catálogo del producto: leídos, salvo los de los tres últimos días. La portería, solo dos semanas.
4. **El lote de hoy solo siembra lo que ya pasó a la hora de correr** (`efecto` de cada evento). En
   el emulador, «ahora» es el mediodía.
5. **`--fase=N` no hizo falta:** la siembra es cronológica y cada corrida entera es idempotente.
6. **La sombra de PQRS no hay que apagarla.** Se exigió unas horas y se retiró: con el conjunto
   `isExample`, `planificarSombra` omite cada ticket **sin llamar al modelo** y deja una fila
   `omitida · sembrado` en `aiAssistance` (`functions/src/ai/sombra-pqrs.ts`). Lo que dice §3.4 es
   cierto.
7. **Una siembra desde cero no es idéntica a otra en el reparto de un pago parcial.** Los totales sí
   lo son, medidos con una huella del dinero. La causa es del producto (contrato, H.17).

### 13.4 Lo que el emulador no puede probar

- **La captura de avisos (D6).** En el emulador no corren las functions. El código espera hasta el
  número de avisos que la historia tiene que disparar y avisa si no llega:
  (PQRS + reservas) × (administradores + superadmin), más las reservas que nacen aprobadas, que avisan
  a su residente. Se ejercita en T2.2.
- **Las filas `omitida · sembrado` de la sombra**, por lo mismo: T2.2 tiene que encontrar una por
  PQRS, con `aiUsage` sin cambio.

### 13.5 Hallazgos del producto

Están en el contrato, §H.12–H.20:

- la conciliación empareja 1 a 1;
- el extracto se deduplica por clave natural;
- el informe toma la cartera del momento en que se emite;
- el PDF parte filas entre páginas;
- el aviso de cobro llama «Mantenimiento» al consumo;
- el reparto desempata por un id aleatorio;
- el cron da por vencido un día antes que `calcularSaldo`;
- «programado para hoy» se calcula en UTC;
- torre y unidad se parten por el guion.

**Ninguno se arregló aquí**, por el principio 11 de §3.

### 13.6 Lo siguiente

- **El commit de la fase 1**, con tu sí.
- **La fase 2, en staging**, sobre `fnBFuQe2p8h5fwy3jpeB`. Pide la ADC viva para
  `vivaru-staging-02`, y comprobar qué functions hay desplegadas allí: los disparadores de §6 son lo
  que se quiere ver.
