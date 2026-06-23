# Plan — Reporte de Comité: de snapshot operativo a informe de gobernanza

> Análisis y propuesta. Estado: planeación, sin ejecutar.

## Diagnóstico del reporte actual

Es un buen **snapshot operativo**: por período (presets + personalizado) muestra cartera,
resumen financiero (ingresos/egresos/neto/fondos + egresos por categoría), visitantes (por
semana), PQRS (por estado/categoría), paquetería, reservas (por amenidad) y acuerdos (% de
firma), con export Excel y PDF imprimible. Buena base.

Limitaciones desde la óptica de un **comité que decide y rinde cuentas**:

1. **Sin comparativo.** Muestra un período aislado; el comité decide por **tendencia**
   (¿el recaudo mejora?, ¿la mora crece?). No hay deltas vs el período anterior.
2. **Métricas crudas, no ratios de gestión.** Cuenta cosas (pagadas, vencidas…) pero falta
   `% de recaudo`, `índice de morosidad`, `meses de fondo de reserva`, `tasa de resolución`.
3. **Sin resumen ejecutivo ni alertas.** Hay que leer todo para hallar lo importante.
4. **Cartera sin antigüedad (aging).** No distingue 1 mes de un moroso crónico — clave para
   autorizar gestión de cobranza / acción legal.
5. **Acuerdos sin accionable.** Muestra el % de firma, no **cuáles** faltan.
6. **PDF poco formal.** Sin nombre del conjunto/logo ni bloque de aprobación del comité.

## Propuesta (lo que agrega valor al comité)

### R1 — Tablero ejecutivo + comparativo vs período anterior (mayor valor)
- Fila de **KPIs ejecutivos (ratios)** arriba: **% de recaudo** (cobrado/facturado),
  **índice de morosidad**, **meses de fondo de reserva** (saldo de fondos ÷ egreso mensual
  promedio = "runway"), **resultado neto**, **tasa de resolución PQRS**, **% de firma**.
- **Delta vs período anterior** (▲▼ %) en los KPIs de cabecera. Factible sin duplicar
  consultas para cartera y finanzas (billing/ledger ya se cargan históricos); los deltas
  operativos (visitantes/PQRS) requerirían una segunda consulta del rango previo (opcional).

### R2 — Resumen ejecutivo (narrativa) + semáforos
- 4–6 viñetas auto-generadas: "lo más importante del período" (recaudo, mora, resultado,
  fondo, PQRS, firmas), al frente del informe.
- **Alertas/semáforo**: morosidad > umbral, fondo < N meses, PQRS abiertos, acuerdos sin
  firmar → "requiere atención del comité".

### R3 — Cartera con antigüedad (aging) + top deudores
- Buckets de antigüedad (1 período / 2–3 / 4+), monto por bucket (los datos de
  `overdueUnits.periods` ya existen).
- **Top deudores** resaltando los crónicos para autorizar gestión.

### R4 — Acuerdos accionables
- Lista de los acuerdos del período con su **estado de firma** (cuáles faltan), no solo el %.

### R5 — Informe formal (gobernanza)
- Encabezado del PDF con **nombre del conjunto** (+ logo), período, fecha y "preparado por",
  más un **bloque de aprobación del comité** (firmas/fecha). Opcional: portada + el resumen
  ejecutivo al frente.

### R6 (opcional, requiere construir antes) — Presupuesto vs real
- Hoy **no existe** módulo de presupuesto. Si el comité aprueba presupuestos por categoría,
  comparar real vs presupuesto es altísimo valor — pero implica crear primero la captura del
  presupuesto. Fase futura aparte.

## Orden recomendado

R1 → R2 → R3 → R4 → R5. (R6 como módulo separado si se decide.)

## Decisiones a confirmar

1. **Umbrales de alerta** (morosidad, meses de fondo, antigüedad PQRS): ¿defaults sensatos
   (p. ej. morosidad > 15%, fondo < 3 meses) o configurables por tenant?
2. **Comparativo** contra el período anterior equivalente (mes vs mes, trimestre vs
   trimestre): ¿de acuerdo? ¿Deltas solo en cartera/finanzas (sin doble consulta) o también
   en los operativos?
3. ¿Construimos **R1–R5** en ese orden? ¿Incluimos el bloque de aprobación en el PDF (R5)?
4. **Presupuesto vs real (R6)**: ¿se deja para después (recomendado) o se prioriza?
