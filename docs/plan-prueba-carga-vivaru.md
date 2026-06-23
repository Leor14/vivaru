# Plan de prueba de carga — Vivaru

> Objetivo: fijar con **datos** (no estimación) a partir de qué tamaño/antigüedad de
> conjunto se degrada la experiencia, para poner un umbral comercial defendible y priorizar
> la Etapa 1. Acompaña a `reporte-escalabilidad-vivaru.md`.

## 1. Qué queremos responder

1. ¿A partir de cuántas **unidades × meses de historia** la página de **Cartera**
   (`/admin/billing`) y el **Reporte de Comité** (`/admin/reports`) dejan de cargar en
   tiempo aceptable o consumen memoria excesiva en el navegador? (Riesgo R1/R2.)
2. ¿Cuánto crecen los **crons globales** (mora, programados, recordatorios) con K tenants?
   (Riesgo R3.)

## 2. Caminos críticos a medir

- `useBillingStatements` (carga **todos** los `billingStatements` del tenant) → alimenta la
  tabla, el gráfico histórico y los tableros de la página de Cartera.
- `useCommitteeReport` (`fetchTenantCollection` sobre `billingStatements` y `ledgerEntries`
  **históricos completos**, + tickets/visitors/reservations/agreements).
- Crons en `functions/src/index.ts`: `updateOverdueStatements`, `publishScheduledCharges`,
  `sendScheduledReminders` (escaneo global por estado).

## 3. Dataset sintético (seeder)

Script Node con Admin SDK (en `functions/scripts/`, fuera del deploy) que genera un tenant
con datos realistas en lote (batches de 400–500):
- **Unidades**: N ∈ {100, 150, 500, 1.000, 2.000}.
- **Cartera**: 1 `billingStatement`/unidad/mes durante M ∈ {12, 36, 60} meses + ~10% de
  cobros individuales (multas/extras). Mezcla de estados (pagado/pendiente/vencido).
- **Libro**: `ledgerEntries` proporcionales (ingresos/egresos por mes).
- **Operación**: tickets, visitorPasses, reservations, packages, acuerdos en volumen
  proporcional al período.
- **Platform-wide**: replicar K tenants ∈ {100, 500, 1.000} con datos mínimos para medir
  los crons (no hace falta full data en cada uno; basta el volumen de docs por colección).

## 4. Métricas e instrumentación

| Capa | Métrica | Cómo |
|---|---|---|
| Front | Tiempo a interactivo de `/admin/billing` y `/admin/reports`; pico de heap; nº de docs cargados; jank al filtrar/paginar | Chrome DevTools (Performance + Memory), Lighthouse; opcional Playwright con trazas |
| Firestore | Lecturas por carga; latencia de query; índices usados | Consola de uso / export de facturación; logs `console.info` de los hooks |
| Functions | Duración del cron; docs escaneados; memoria | Cloud Functions logs / métricas |

## 5. Escenarios (matriz)

| Escenario | Unidades × meses | Qué valida |
|---|---|---|
| Típico | 150 × 36 | Línea base "vendible hoy" |
| Grande | 500 × 36 | Primer muro por conjunto |
| Ballena | 1.000 × 36 y 1.000 × 60 | Punto de quiebre por antigüedad |
| Extremo | 2.000 × 36 | Margen de seguridad |
| Plataforma | K=100 / 500 / 1.000 tenants | Crons globales (R3) |

## 6. Criterios de aceptación (propuestos, ajustar tras la 1ª corrida)

- Cartera y Reporte: **interactivo < 3 s** y **heap < 300 MB**.
- Crons: **duración < 60 s** y dentro de límites de memoria con K=1.000.
- Si un escenario falla → ese es el umbral comercial; se documenta "a partir de X
  unidades / Y años se requiere Etapa 1".

## 7. Entregable

Tabla **"umbral real"** (a partir de qué tamaño/antigüedad se degrada cada camino) + el
costo estimado de lecturas por sesión a cada escala. Alimenta el precio por unidades y la
decisión de cuándo financiar la Etapa 1. Ver `plan-etapa1-scale-readiness.md`.
