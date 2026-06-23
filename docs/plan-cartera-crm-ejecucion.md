# Cartera CRM — veredicto de impacto + especificación de ejecución

> Validación de dependencias y spec detallada para ejecutar. Acompaña a
> `plan-cartera-crm-trazabilidad.md`.

## A. Veredicto de impacto: ¿rompe otra parte de la experiencia?

Se auditaron TODOS los consumidores de `billingStatements`. **La propuesta es segura SI y solo
si** respetamos un contrato de guardas. Los campos nuevos (`campaignId`, `archived`) son
**aditivos** (no rompen lecturas existentes). El riesgo está en *filtrar* o *archivar* mal.

| Consumidor | Qué lee | ¿Necesita historia? | Riesgo | Cómo se protege |
|---|---|---|---|---|
| Vista del **residente** (`/resident/account`) | sus statements | Sí (comprobante de pagos) | Perdería su historia si filtramos archived | **Nunca** se filtra archived en la vista del residente. Su hook queda igual. |
| **Gráfico histórico** + `cuotaIncome` (admin) | todos los statements | Sí (tendencia) | Se descuadra si la tabla scopeada alimenta el gráfico | El gráfico/`cuotaIncome` siguen leyendo el set completo, NO la tabla scopeada. |
| **FlujoCajaTablero** | statements pendientes | Solo pendientes | Se rompe si archivamos pendientes | Solo se archivan **períodos liquidados** (sin saldo). |
| **CuentasPorPagarTablero** | gastos | — | Ninguno | — |
| **Reporte de comité** | todos los statements | Sí (mora/recaudo) | Inexacto si filtra archived | No filtra archived (lee completo). |
| **Cron `updateOverdueStatements`** | pendientes + dueDate | — | No marcaría mora si excluye archived | No se filtra; además archived = liquidado → no hay pendientes que marcar. |
| **Export CSV / Imprimir mora** | filas filtradas | Según filtro | Huecos si archived desaparece | Export sobre el set elegido; el cierre genera su propio reporte. |
| Triggers `onBillingStatementCreated`, `publishScheduledCharges`, `mergeUnits` | doc puntual / otra colección | — | Ninguno | Campos nuevos son ignorados por ellos. |

**Conclusión:** ejecutable sin romper nada, bajo el contrato siguiente.

## B. Contrato de seguridad (no negociable)

- **G1.** `useBillingStatements` conserva su firma y comportamiento actuales. El scope
  "activo" se aplica con un parámetro **opcional** que SOLO usa la tabla viva del admin.
  Residente y gráfico llaman sin el parámetro → ven todo.
- **G2.** `archived` se setea **solo** por la acción explícita "Cerrar y archivar"; nunca
  automático.
- **G3.** Solo se puede archivar un **período totalmente liquidado** (sin saldo pendiente). Si
  el admin fuerza con saldo, se advierte; esos quedan fuera de mora/flujo por estar archivados.
- **G4.** El **gráfico histórico**, `cuotaIncome`, **tableros** y **reporte de comité** leen el
  set completo (o agregados), **nunca** la tabla scopeada. Su comportamiento no cambia en C1–C4a.
- **G5.** La **vista del residente** no filtra `archived` jamás.
- **G6.** El cron de mora **no** filtra `archived` (y por G3 no hace falta).

## C. Reglas de negocio (refinadas)

- **Campaña** = una corrida de lote (inmediata o programada al publicarse). Agrupa N cobros.
- Cobro **individual** = `campaignId = null` (multa, reparación, ajuste, cobro a 1 unidad).
- **Mantenimiento (Administración)** se prioriza arriba en todos los listados.
- **Cerrar y archivar** un período: requiere período liquidado (regla G3); genera **reporte de
  cierre** (Excel/PDF) en carpeta de sistema **"Cierres de cartera"** y marca `archived=true`.
  Es **reversible** (desarchivar) mientras los docs existan; eliminar definitivo = opción extra.

## D. Modelo de datos

**`billingCampaigns`** (nueva):
```
id, tenantId, concept, period (YYYY-MM), unitAmount, dueDate|null,
source: "immediate" | "scheduled", unitCount,
sentAt (Timestamp), createdBy,
status: "vigente" | "cerrada",
// totales cacheados (se refrescan al cerrar; en vivo se calculan de los statements):
totalEmitido?, totalRecaudado?, totalPendiente?, paidCount?, overdueCount?
```

**`billingStatements`** (campos nuevos, aditivos):
```
campaignId?: string | null   // liga al lote; null = individual
archived?: boolean           // default false; true = fuera de la tabla viva
```

**Índices** (composite):
- `billingCampaigns`: (tenantId, sentAt desc) y (tenantId, status, sentAt desc).
- `billingStatements` filtro por campaña: (tenantId, campaignId) — equality/equality, sin
  índice compuesto.
- `billingStatements` tabla viva (C4): (tenantId, archived, period desc).

## E. Especificación por fase

### C1 — Campaña como entidad + Listado A + naming/copy  (riesgo: bajo)
**Objetivo:** que cada lote sea rastreable como un todo; priorizar Mantenimiento; corregir copy.

- **Servicio** `createBillingCampaign(...)` → crea el doc de campaña y devuelve su id.
- **Lote inmediato** (front `handleCreate`, modo batch): crear la campaña primero, luego los N
  `createBillingStatement({..., campaignId, source:"import"})`. El banner: *"Se creó la campaña
  de {concepto} de {período} (N unidades). Míralas en 'Campañas de cobro'."*
- **Lote programado**: `billingSchedules` ya existe; al publicar, el **cron**
  `publishScheduledCharges` crea la campaña y pone `campaignId` en cada statement.
- **Listado A "Campañas de cobro"** (nueva card/tab): filas = campañas; **Mantenimiento
  primero**, luego por `sentAt` desc. Columnas: **Concepto · Período · Enviado · # unidades ·
  Valor · Recaudado / Pendiente · % recaudo · Estado**. Totales en vivo = derivados de los
  statements con ese `campaignId` (ya cargados). Acción: **Ver detalle** (filtra la tabla por
  `campaignId`), **Recordar a pendientes** (reusa `sendBillingReminder` con las unidades con
  saldo de la campaña).
- **Naming:** etiqueta `administracion` → **"Mantenimiento (Administración)"**; ordenar
  `BILLING_CONCEPTS` con ese primero (ya lo está).
- **Copy:** banner y textos: reemplazar "tabla de abajo" por la campaña/período.
- **Toca:** `use-billing-statements.ts` (createBillingCampaign + tipo), `billing/page.tsx`
  (handleCreate, nuevo listado/tab), `functions/index.ts` (cron crea campaña), domain types.
- **No toca:** residente, gráfico, tableros, comité, cron de mora.
- **Gate:** typecheck app+functions, lint, build functions; deploy cron.

### C2 — Trazabilidad CRM (riesgo: bajo)
**Objetivo:** embudo por campaña + estado de push por unidad.
- Embudo en el detalle de campaña: **Emitidos N → Notificados N → Pagados N (% recaudo)**.
  "Notificados" = N (al crear el lote se notifica a todas; se registra `sentAt` en la campaña).
  "Pagados" = statements de la campaña con saldo 0.
- En el **detalle por unidad** (Listado C), columnas extra: **Notificado** (de la campaña) y
  **Recordatorios (#)** (contador `reminderCount` en el statement, +1 al usar "Recordar").
- **Toca:** `billingStatements.reminderCount?` (incrementa `sendBillingReminder`/acción
  Recordar), detalle de campaña en `billing/page.tsx`.
- **No toca:** resto.

### C3 — Listado B "Cobros individuales" (riesgo: bajo)
**Objetivo:** separar los cobros sueltos de las campañas.
- Tabs en Cartera: **Campañas (A) · Individuales (B) · Por unidad (C)**.
- B = la tabla actual filtrada a `campaignId == null`. C = la tabla actual completa (sin filtro
  de campaña) o el drill-down. Mantenimiento priorizado.
- **Toca:** `billing/page.tsx` (tabs + filtros derivados). Reusa la tabla existente.

### C4a — Cierre y archivado a Documentos (riesgo: medio)
**Objetivo:** sacar períodos liquidados de la tabla viva del admin, sin romper nada.
- Acción **"Cerrar y archivar período"** (o por campaña): valida liquidado (G3) → genera
  **reporte de cierre** (Excel/PDF) en carpeta de sistema **"Cierres de cartera"** (reusa
  `ensureSystemFolder` con nuevo `systemKey: "billing_closures"` + `createDocumentRecord`) →
  marca los statements del período `archived=true`.
- **Tabla viva del admin** usa `useBillingStatements(tenantId, undefined, { archived: false })`
  (param opcional nuevo — G1). El **gráfico/`cuotaIncome`** siguen sobre el set completo (G4):
  se separa la fuente del gráfico de la fuente de la tabla.
- **Desarchivar** disponible mientras existan los docs.
- **Toca:** `use-billing-statements.ts` (param opcional + filtro), `billing/page.tsx` (separar
  fuente tabla vs gráfico, acción cerrar), `functions/index.ts` (SYSTEM_FOLDERS +,
  callable de cierre que genera el reporte), `firestore.indexes.json` (índice archived).
- **No toca semántica de:** residente, comité, cron, tableros (siguen sobre el set completo).

### C4b — Optimización real de memoria (riesgo: alto · DIFERIDO)
**Tu preocupación por "peso" es correcta**, pero C4a aún suscribe todo para el gráfico. La
**única** forma de reducir memoria sin romper la historia es **pre-agregar**: un rollup
`billingPeriodSummaries` (por tenant/período: emitido, recaudado, mora) mantenido por un
trigger; el gráfico, `cuotaIncome`, tableros y comité leen el rollup (liviano), y la tabla viva
se suscribe solo a una **ventana** (período vigente + morosos). Es un cambio contenido pero
real, con su propia validación. **Recomendación de consultor: ejecutarlo aparte, después de
validar C1–C4a**, cuando el volumen lo justifique (hoy ~85 registros no lo exige).

## F. Lo que explícitamente NO se toca en C1–C4a
Hook del residente (firma intacta), fuente del gráfico histórico, `cuotaIncome`, los tres
tableros, el reporte de comité y el cron de mora. Todos siguen leyendo el set completo.

## G. Decisiones finales a confirmar
1. ¿Avalas el **contrato de seguridad** (B) y la regla **"solo se archiva período liquidado"** (G3)?
2. ¿Etiqueta **"Mantenimiento (Administración)"**?
3. **Archivado** reversible + reporte en Documentos (recomendado); ¿habilitamos también
   *eliminar definitivo* como opción extra?
4. ¿**C4b (memoria) diferido** hasta validar C1–C4a (recomendado), o lo incluimos ya?
5. Orden: **C1 → C2 → C3 → C4a** (→ C4b después).
