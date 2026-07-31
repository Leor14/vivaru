---
tags: [patron, kpis, finanzas, consistencia]
tipo: tecnica
fuentes: ["sesion-auditoria-ux-2026-07"]
fecha_creacion: 2026-07-03
fecha_actualizacion: 2026-07-03
---

# KPIs de Fórmula Única

Regla de arquitectura: **cada indicador tiene UNA definición en un módulo puro compartido; las pantallas solo eligen rango y redondeo.** Nació porque el mismo KPI mostraba tres valores distintos entre [[dashboard-admin|Panel de Control]], el módulo y el [[reportes|Reporte de Comité]] — la [[auditoria-ux-jul-2026]] lo llamó "el comité no sabe cuál cifra creer".

## % recaudo — `src/features/billing/collection.ts`

`statementChargedAmount()` define el facturado con **fallback legado** (`amount` o, si falta, `balance + paymentAmount`) y `computeCollectionSummary()` la tasa sin redondear. La divergencia real: el Reporte usaba `amount ?? 0` **sin** el fallback, y con registros viejos daba 0% mientras [[billing|Cartera]] daba 2.7%. Hoy lo consumen: la gráfica de tendencia de Cartera, el `monthRate` del Panel, y en el Reporte el período actual, el anterior, la tendencia de 12 meses y el denominador de morosidad.

## PQRS pendientes — `src/features/pqrs/ticket-status.ts`

**Pendiente = `open` + `in_progress`.** Una "respondida" ya fue atendida y NO cuenta. Antes el Panel y el badge del sidebar contaban `responded` como abierta (5 vs 3 del módulo [[pqrs]]).

## Cumplimiento de firma — regla del widget

El módulo [[reglamento]] contaba `signatures.length` crudo — incluía firmas huérfanas y podía dar pendientes **negativos** (6% vs 11%). Ahora usa la misma regla que el widget del Panel: **firmas ∩ unidades activas**. Ojo: el "% de firma" del Reporte de Comité mide **acuerdos**, otro indicador — no confundirlos.

## Regla para KPIs futuros

Definición en `src/features/<dominio>/` como función pura con test (ver `tests/kpi-definitions.test.ts`); prohibido calcular inline en una página lo que otra pantalla también muestra. Aplica junto a [[torres-canonicas]] (la data limpia es la otra mitad de un KPI creíble).

## Relaciones

- Véase también: [[integridad-financiera]], [[resolucion-unit-id]]
- Se conecta con: [[form-validation]], [[triaje-auditoria-ux]], [[trampas-conocidas]]

## Fuentes

- Commit `e3514cf`
