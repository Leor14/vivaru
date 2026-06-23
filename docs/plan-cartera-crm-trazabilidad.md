# Cartera como CRM de cobros — trazabilidad, listados y control de crecimiento

> Planteamiento de consultor. Estado: análisis y definición (sin ejecutar).

## 1. Diagnóstico de la estructura actual

- **Crear cobro** soporta destinatario (una unidad / lote) × tiempo (inmediato / programado)
  × concepto. Bien.
- **El lote no es una entidad.** Al crear un lote inmediato, se crean N `billingStatements`
  sueltos (source "import") sin un id que los agrupe. La corrida se "disuelve" → no hay
  manera de rastrear *"el cobro de Mantenimiento de junio"* como un todo.
- **Una sola tabla plana** (`billingStatements`) con todo: cobros de mantenimiento, multas,
  ajustes, meses viejos… todo mezclado. La columna prioritaria (Mantenimiento) no se prioriza.
- **Paginación solo visual.** `usePagination` pagina en el navegador sobre **todos** los
  statements suscritos en tiempo real → se cargan en memoria todos los cobros históricos.
  El peso crece sin límite mes a mes.
- **Sin archivado/cierre.** Nada saca períodos liquidados del listado vivo.
- **Trazabilidad de "push" inexistente.** Se notifica al residente, pero no se registra el
  estado del envío (cuándo, a cuántos, cuántos pagaron después). No hay vista tipo CRM.
- **Copy ambiguo:** "Aparecen en la tabla de abajo" no dice cuál.

## 2. Principio rector

Tratar cada **envío de cobro** como una **campaña** (igual que un CRM trata un envío). La
campaña es la unidad de trazabilidad: se emite, se notifica, se cobra, se cierra. Los listados
son **fijos y pocos** (no se crean listados nuevos); el crecimiento se controla **archivando
períodos cerrados** a un repositorio de documentos.

## 3. Modelo de datos propuesto

- **`billingCampaigns`** (nueva entidad): 1 doc por corrida de lote (inmediata o programada al
  publicarse). Campos: `tenantId, concept, period, unitAmount, dueDate, sentAt/scheduledFor,
  unitCount, source (immediate|scheduled), status (vigente|cerrada), createdBy`. Totales
  (emitido, recaudado, pendiente, #pagados/#mora) se calculan de sus statements (o se cachean).
- **`billingStatements.campaignId`**: liga cada cobro de lote a su campaña. Los cobros
  **individuales** quedan con `campaignId = null`.
- **`billingStatements.archived: boolean`** (default false): los períodos cerrados se marcan
  archived y **salen de las queries vivas**.

## 4. Listados (FIJOS — no se crean nuevos)

Tabs/secciones, en este orden de prioridad:

### A. Campañas de cobro (prioriza Mantenimiento/Administración)
Una fila = una campaña (lote). **Las de Mantenimiento van primero.**
Columnas: **Concepto · Período · Enviado/Programado · # unidades · Valor · Recaudado /
Pendiente · % recaudo · Estado (Vigente/Cerrada/Programada)**.
Acciones: **Ver detalle**, **Recordar a pendientes**, **Cerrar y archivar**.

### B. Cobros individuales
Una fila = un cobro suelto (multa, reparación, ajuste puntual; `campaignId = null`).
Columnas: **Unidad · Concepto · Período · Monto · Abono · Saldo · Estado · Comprobante · Acciones**.

### C. Detalle de campaña / Estado de cuenta por unidad (drill-down)
Al abrir una campaña, o como vista por unidad.
Columnas: **Unidad · Monto · Abono · Saldo · Estado · Notificado (✓/fecha) · Recordatorios (#)
· Comprobante · Acciones (Editar / Registrar cobro / Recordar)**.

### D. Cobros programados (ya existe)
Se mantiene; al publicarse, la campaña pasa a A.

## 5. Trazabilidad tipo CRM (lo que pides)

Por **campaña**, un embudo de cobro:
**Emitidos N → Notificados N → (Vistos N*) → Pagados N (% recaudo)**.
\*"Vistos" = lecturas de la notificación; opcional (requiere leer el estado de lectura).
A nivel **unidad** (detalle): estado del cobro + notificado (fecha) + nº de recordatorios +
comprobante. Así el admin rastrea un push, varios push y el estado de cada residente.

## 6. Control de crecimiento (clave)

Para que el listado vivo no crezca infinito ni pese:

1. **Scoping por defecto a lo activo.** La tabla viva muestra solo el **período vigente +
   saldos pendientes** de meses anteriores (query acotada server-side `where archived == false`
   y por período/estado), no toda la historia.
2. **Cerrar y archivar período/campaña.** Acción del admin: genera un **reporte de cierre**
   (Excel/PDF consolidado) y lo guarda en una **carpeta de sistema "Cierres de cartera"** en
   Documentos; marca los statements como `archived` (salen del listado vivo). El admin puede
   **archivar** (reconsultable) o **eliminar** dejando el reporte como evidencia.
3. **Listados fijos.** No existe "crear nuevo listado": solo A–D. Esto evita la proliferación.

Resultado: el listado vivo es siempre liviano (mes actual + morosos); la historia vive como
documentos de cierre consultables, sin cargar memoria.

## 7. Naming y copy

- Renombrar la etiqueta del concepto por defecto a **"Mantenimiento (Administración)"** y
  priorizarlo en los listados.
- Reemplazar "Aparecen en la tabla de abajo" por algo explícito: *"Quedaron en la campaña de
  {concepto} de {período}, en 'Campañas de cobro'."*

## 8. Fases de ejecución

- **C1 — Campaña como entidad:** `billingCampaigns` + `campaignId` en statements (lote inmediato
  y cron) + **Listado A** con drill-down (C). Naming Mantenimiento + fix de copy.
- **C2 — Trazabilidad CRM:** embudo por campaña + columnas Notificado/Recordatorios en el detalle.
- **C3 — Cobros individuales:** **Listado B** separado de las campañas.
- **C4 — Control de crecimiento:** scoping por período activo (query acotada) + **cierre/archivado**
  de períodos a carpeta de sistema "Cierres de cartera" (reporte + archived).

## 9. Decisiones a confirmar

1. **Campaña como entidad** (`billingCampaigns`) que agrupa cada lote. ¿De acuerdo?
2. **Naming**: ¿"Mantenimiento (Administración)" como etiqueta por defecto?
3. **Archivado**: al cerrar, ¿**archivar** (reconsultable) + reporte en Documentos (recomendado),
   con eliminar como opción extra? ¿O cierre = eliminar dejando solo el reporte?
4. **Scoping vivo**: ¿por defecto **mes vigente + saldos pendientes anteriores** (recomendado)?
5. **"Vistos"**: ¿trackeamos lectura de la notificación, o basta Notificado/Pagado por ahora?
6. **Orden de fases**: C1 → C2 → C3 → C4.
