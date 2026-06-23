# Etapa 1 — Scale-readiness (alcance detallado)

> Meta: que el **costo y la experiencia dejen de crecer con el tamaño/antigüedad del
> conjunto**. Ataca R1 (front carga todo), R2 (sin agregación), R3 (crons globales) y R8
> (costo por tenant). Reutiliza el patrón de **archivado + ventana** ya construido en
> cartera. Acompaña a `reporte-escalabilidad-vivaru.md` y `plan-prueba-carga-vivaru.md`.

## Principio de diseño

Hoy: el front **lee datos crudos completos** y agrega en el navegador.
Etapa 1: el front lee **(a) agregados** para análisis y **(b) ventanas acotadas** para
operación. Lo crudo histórico solo se toca bajo demanda (un período, una unidad).

---

## Pilar A — Rollups pre-agregados (ataca R1/R2)

**Idea:** mantener resúmenes por período que los gráficos/reportes leen en vez de escanear
todo.

- **`billingPeriodSummaries`** (por `tenantId`+`period`): facturado, recaudado, pendiente,
  #pagadas/#pendientes/#mora. Mantenido por un **trigger** `onWrite` sobre
  `billingStatements` (recalcula/incrementa el doc del período) — idempotente.
- **`financialPeriodSummaries`** (por `tenantId`+`period`): ingresos, egresos, neto del
  libro; alimenta el gráfico de cartera, los tableros y el Reporte de Comité.
- **Consumidores a migrar:** el `chartTrend` de `/admin/billing` y `useCommitteeReport`
  (que hoy hacen `fetchTenantCollection` histórico completo de `billingStatements` y
  `ledgerEntries`) → pasan a leer los summaries (decenas de docs, no decenas de miles).
- **Backfill:** función única que construye los summaries desde los datos existentes.

**Contrato de seguridad (igual que en cartera):** la vista del residente, y cualquier
cálculo que necesite el detalle, siguen pudiendo leer lo crudo; los summaries son una capa
de lectura, no reemplazan la fuente.

## Pilar B — Paginación / ventana del lado servidor (ataca R1)

- **`useBillingStatements`**: dejar de "cargar todo + paginar en cliente". Suscribir solo
  una **ventana** (período vigente + meses recientes + saldos pendientes) y paginar con
  cursor (`startAfter`) para el resto. El flag `archived` ya saca lo cerrado de la ventana.
- **Generalizar** el patrón a las otras listas pesadas (histórico de reservas, tickets,
  visitantes) con un helper reutilizable de consulta acotada + cursor.
- Índices compuestos nuevos según las ventanas (p. ej. `(tenantId, archived, period)`).

## Pilar C — Crons acotados por tenant / fecha (ataca R3)

- `updateOverdueStatements`, `publishScheduledCharges`, `sendScheduledReminders`: el
  escaneo global `where(status==...)` crece con toda la plataforma. Opciones:
  1. **Acotar por fecha** (índice `(status, dueDate)` ya existe para mora) para no leer de
     más.
  2. **Fan-out por tenant** con Cloud Tasks: un dispatcher encola una tarea por tenant con
     consultas acotadas → cada ejecución es pequeña y aislada.
- Resultado: el tiempo/costo de cada corrida deja de depender del total global.

## Pilar D — Observabilidad de costo por tenant (ataca R8, comercial)

- Contadores por tenant (docs por colección, lecturas estimadas por sesión) en un panel de
  superadmin. Habilita **precio por unidades**, cuotas de "fair use" y detección temprana
  de ballenas.

---

## Fases de ejecución

- **E1.1 — Rollups + migrar análisis** (mayor ROI): `billingPeriodSummaries` y
  `financialPeriodSummaries` + trigger + backfill; migrar el gráfico de cartera y el
  Reporte de Comité a leer agregados. *(Esfuerzo: L.)*
- **E1.2 — Ventana/paginación servidor en cartera** + helper reutilizable + generalizar
  archivado a otros módulos. *(Esfuerzo: M–L.)*
- **E1.3 — Crons acotados/por tenant** (Cloud Tasks o filtro por fecha). *(Esfuerzo: M.)*
- **E1.4 — Observabilidad de costo por tenant.** *(Esfuerzo: S–M.)*

## Guardrails

- Mantener el **contrato de seguridad** validado en cartera (residente, comité y tableros
  no pierden datos).
- Triggers de rollup **idempotentes** y con backfill verificable (comparar agregados vs
  conteo crudo en un tenant de prueba).
- Cada fase con su gate (typecheck app+functions, lint) y, para los rollups, una
  verificación de consistencia antes de migrar los consumidores.

## Disparador (cuándo se ejecuta)

No todo por adelantado. Se financia cuando se cumpla **lo primero de**: (a) pipeline de un
conjunto > ~300–500 unidades, o (b) cruzar ~100 conjuntos activos, o (c) la prueba de carga
marque que un escenario realista ya cae bajo los criterios de aceptación.
