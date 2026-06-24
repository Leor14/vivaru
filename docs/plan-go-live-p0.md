# Plan de ejecución — P0 Go-Live (bloqueantes para cargar el primer cliente)

> Orden: G1 (carga inicial) primero — es lo que más fricción quita para onboardear.
> Acompaña a `checklist-go-live-vivaru.md`.

## Estado (avance)

- **G1.1 Import de residentes — ✅ HECHO y desplegado** (`cfe1a1a`).
- **G1.2 Saldos iniciales de cartera — ✅ HECHO y desplegado** (`4cd5060`).
- **G1.3 Saldo inicial del libro — ya posible hoy** (movimiento manual); atajo opcional no construido.
- **G2 Legal/privacidad — fuera de alcance por ahora** (decisión del usuario: contenido legal aparte).
- **G3 Auth URL branded — pendiente del Owner** (config en Firebase Console).
- **G4 Monitoreo de errores — ✅ HECHO y desplegado** (`b851045`; función `logClientError` + panel superadmin "Errores").
- **G4 Backups — pendiente:** requiere `gcloud auth login` del usuario; luego se crea el schedule diario.

## G1 — Carga inicial de datos del conjunto

Estado base: **unidades** ya tienen import en lote (`UnitBulkImportWizard` + `bulkCreateUnits`).
**Residentes** se crean uno a uno (gap). **Cartera** tiene import por CSV (reutilizable para
saldos). **Libro** acepta movimientos manuales (saldo inicial posible).

### G1.1 — Import masivo de residentes  (BUILD · mayor valor)
- **Servicio** `bulkCreatePeople(tenantId, userId, rows)` espejando `bulkCreateUnits`: por
  fila (nombre, email, teléfono, documento, **unidad**, rol/ocupación) → crea `people`,
  **valida que la unidad exista** (por nombre) y enlaza `ownerIds`/`residentIds` de la unidad
  (cuidado: `unitId` = doc id, no slug — ver trampas conocidas).
- **UI** `ResidentBulkImportWizard` (clonar el de unidades): subir CSV/Excel → preview con
  validación (unidad inexistente, email/doc duplicado) → confirmar. Plantilla descargable.
- **Opción** "enviar onboarding por enlace" a los importados (reusa el alta de acceso).
- *Esfuerzo: M.*

### G1.2 — Saldos iniciales de cartera  (REUSAR + plantilla)
- Usar el **import de cartera existente** para cargar, por unidad, el saldo actual como un
  período de **apertura** (p. ej. `period` del mes de arranque, `amount`/`balance` = deuda).
- Entregable: **plantilla "saldos iniciales"** + guía de un párrafo. *Esfuerzo: S.*

### G1.3 — Saldo inicial del libro/fondos  (YA POSIBLE + atajo)
- Hoy se carga como **movimiento manual** (ingreso "saldo inicial"). Opcional: un atajo
  "Registrar saldo inicial" en el Libro para que no se confunda con un ingreso operativo.
  *Esfuerzo: S (opcional).*

**Resultado G1:** un conjunto nuevo se deja operativo en minutos (unidades → residentes →
saldos de cartera → saldo de fondos), sin scripts.

## G2 — Marco legal y de privacidad  (CONTENIDO + integración · HITL legal)

- **Contenido (HITL):** Términos de servicio, Política de privacidad y Aviso de tratamiento
  de datos (Habeas Data Ley 1581 CO / LFPDPPP MX). Requiere redacción/validación legal — no
  lo inventa el equipo técnico.
- **Integración (BUILD):** páginas públicas `/terminos` y `/privacidad`, enlace en el footer
  y en el onboarding, y **checkbox de aceptación** (con fecha/versión) al activar la cuenta.
  *Esfuerzo: S una vez exista el contenido.*

## G3 — URL de acción branded de Auth  (CONFIG · acción del usuario)

- En Firebase Console (cuenta **Owner**, `luisEOteroR@gmail.com`): Authentication → Templates
  → Personalizar URL de acción = `https://www.grupovivaru.com/restablecer`.
- Verificar dominios autorizados. Tras esto, onboarding/reset abren la página branded en
  español. *Esfuerzo: XS (config, no código).*

## G4 — Respaldos + monitoreo de errores  (CONFIG + algo de código)

- **Backups:** activar **Firestore scheduled backups** (gcloud/console) con retención; valida
  restauración una vez.
- **Monitoreo:** integrar **Sentry** (front + functions) o, mínimo, **alertas de errores de
  Cloud Functions** + un uptime check del dominio. *Esfuerzo: S–M.*

## Orden y naturaleza

| Fase | Tipo | Bloquea qué | Esfuerzo |
|---|---|---|---|
| G1.1 Residentes import | Código | Onboarding del cliente | M |
| G1.2 Saldos cartera | Reuso + doc | Arranque financiero | S |
| G1.3 Saldo libro | Ya posible | Arranque financiero | S |
| G2 Legal/privacidad | Contenido (HITL) + integración | Riesgo legal | S* |
| G3 Auth URL branded | Config (Owner) | Profesionalismo | XS |
| G4 Backups + monitoreo | Config + código | Confianza/operación | S–M |

\* depende de tener el contenido legal.

## Arranque sugerido

Empezar por **G1.1 (import de residentes)** — es código, alto valor y el que más fricción
quita. En paralelo: G3 (config del Owner) y arrancar el contenido legal de G2. G4 antes de
los primeros datos reales.

## Decisiones a confirmar

1. ¿Arranco construyendo **G1.1 (import masivo de residentes)** ya?
2. G1.2: ¿hago una **plantilla "saldos iniciales"** dedicada, o basta el import de cartera
   actual + guía?
3. G2: ¿quién provee el **contenido legal** (abogado)? Yo dejo la integración lista.
4. G4: ¿**Sentry** o solo alertas nativas de Functions + uptime, para empezar?
