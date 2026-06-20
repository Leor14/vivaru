# Plan — Backfill de fecha canónica (`eventDate`)

**Objetivo:** habilitar consultas por rango de fecha server-side seguras en las
colecciones operativas que más crecen (`visitorPasses`, `tickets`), para acelerar
el Reporte de Comité (y otras vistas) sin subcontar registros.

**Contexto:** hoy el reporte limita por rango solo `reservations` (campo `date`
requerido + índice existente). El resto se lee completo porque sus campos de fecha
son opcionales/inconsistentes, y filtrar por rango sobre un campo no poblado en
todos los documentos **omitiría registros**.

## Estado de los campos de fecha

| Colección | Fecha usada hoy | Problema |
|---|---|---|
| visitorPasses | `date \|\| dateKey(visitDate)`; a veces `checkInAt` | `date` no siempre poblado; conviven `date`/`visitDate`/`checkInAt` |
| tickets | `radicationDate ?? createdAt ?? updatedAt` | `radicationDate` y `createdAt` opcionales |
| packages | `arrivedAt` (recibido) / `deliveredAt` (entregado) | dos eventos + KPI "pendientes" histórico |
| reservations | `date` (requerido) | ✅ ya normalizado |
| billing / ledger | — | se leen completos: saldo de fondos y mora histórica |

## Diseño: campo canónico `eventDate`

Un campo `eventDate: string` (YYYY-MM-DD), escrito **siempre**, indexado, con la
fecha del evento relevante para reportes:

- **visitorPasses** → fecha de la visita: `date || dateKey(visitDate) || dateKey(checkInAt) || dateKey(createdAt)`
- **tickets** → fecha de radicación: `radicationDate || dateKey(createdAt)`
- **packages** → fuera de este backfill (dos eventos + pendientes histórico). Se queda en lectura completa.

## Fases (el orden = seguridad)

No cambiar las consultas a rango hasta que **todos** los docs tengan `eventDate` y el
índice exista; de lo contrario se subcontaría.

- **Fase 0 — Tipos y helper.** `eventDate?` en `VisitorPass` y `Ticket` (`domain.ts`);
  helper puro `resolveEventDate(doc)` por colección, con tests.
- **Fase 1 — Write-path.** Escribir `eventDate` en cada creación:
  visitorPasses (`features/visitors/invitations.ts`, `features/visitors/use-visitor-passes.ts`)
  y tickets (`features/pqrs/use-tickets.ts`). Verificar que `firestore.rules` permita el campo.
- **Fase 2 — Backfill.** `functions/scripts/backfill-event-date.mjs` (admin SDK):
  itera por tenant, calcula `eventDate` con la misma lógica, escribe en lote.
  Idempotente (omite si ya existe), `--dry-run` por defecto, `--apply` para ejecutar.
- **Fase 3 — Índices.** `(tenantId, eventDate)` para `visitorPasses` y `tickets` en
  `firestore.indexes.json`; `firebase deploy --only firestore:indexes` (tarda minutos).
- **Fase 4 — Switch de consultas.** En `useCommitteeReport`, limitar `visitorPasses` y
  `tickets` por `range.field: "eventDate"` (efecto propio que re-consulta al cambiar
  período). KPIs de "todo el tiempo" que queden fuera del rango (p. ej.
  `visitors.insideNow`, status `inside`) → consulta de igualdad aparte.
- **Fase 5 — Validación.** Script read-only que compare conteos viejo (lectura completa
  + filtro cliente) vs nuevo (rango) por tenant; exigir 0 diferencias antes de dar por
  bueno el switch.

## Riesgos / notas

- **Reglas Firestore:** confirmar que el write-path puede escribir `eventDate` (allowlist de campos).
- **Timezone:** `dateKey()` debe ser consistente (local vs UTC); reusar `toDateKeyLocal` para no desfasar un día.
- **Solo agrega un campo** (no destructivo); aún así, dry-run + validación obligatorios.
- **packages / billing / ledger** se quedan en lectura completa por diseño.

## Estado de ejecución

- [x] Fase 0 — tipos + `resolveEventDate` + tests
- [x] Fase 1 — write-path
- [ ] Fase 2 — backfill script
- [ ] Fase 3 — índices
- [ ] Fase 4 — switch de consultas
- [ ] Fase 5 — validación
