---
tags: [log, historial]
tipo: decision
fuentes: ["PRODUCT.md", "DESIGN.md", "domain.ts", "middleware.ts", "gtm-tecnico", "consolidacion-landing-2026"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-08-01
---

# Log de operaciones — Vivaru Wiki Producto

---

## [2026-08-01] ingest | Trial, onboarding, soporte, PRD y programa de IA

Fuentes: 56 commits desde el 29 de julio, los dos documentos de IA de `/Users/david/Claude Coworker/Hogaru/GPT/`, y verificación directa contra `src/`, `functions/src/` y `firestore.rules`.

- **Páginas creadas: 9** → [[soporte]], [[ciclo-de-vida-tenant]], [[onboarding-guiado]], [[programa-ia]], [[estrategia-ia-minima-viable]], [[plan-general-ia]], [[portafolio-prd]], [[pruebas-reglas-emulador]], [[transiciones-navegacion]].
- **Páginas actualizadas: 5** → [[index]], [[trampas-conocidas]], [[estado-modulos]], [[multi-tenancy]], [[log|log]].
- **Entidades extraídas**: `tenantOperable()` (25 colecciones, 52 statements), `TenantStatus` (`trial`/`active`/`expired`/`suspended`), `moduleAccessFor`, matriz de módulos duplicada en `functions/src/trial-modules.ts`, `OnboardingTrack`, `ONBOARDING_STEPS` (18 pasos en 4 bloques: configura/prueba/cobrar/descubre), `OnboardingSignal`, filtro `isExample`, `SUPPORT_LIMITS`, `PENDING_SUPPORT_STATUSES`, subcolección `supportTickets/{id}/internal`, seis callables de soporte, `AttachmentPicker`/`AttachmentList`, velo de navegación, 20 tokens CSS declarados.
- **Trampas nuevas: 10** → reglas de Storage suman permisos; reglas de Firestore no filtran campos; callables v2 sin `invoker: "public"`; `getFirestore()` en top level; endurecer reglas rompe consolas internas; `PATCH` sin `updateMask`; `apphosting.yaml` de develop es staging; una prueba parada engaña; `tenants.status` no refresca la sesión; una señal de progreso debe ser legible por su rol.

### Verificado contra código, no asumido

Los dos documentos de IA describen el estado del repositorio. Se comprobó cada afirmación relevante:

- **App Check**: existe en cliente (`src/lib/firebase/app-check/index.ts`), **sin enforcement en servidor**. La brecha que declara el plan es real.
- **IA**: cero. No hay `aiUsage`, ni gateway, ni Gemini, ni Document AI en `src/` ni en `functions/src/`. El programa está al 0%.
- `auditLogs` y `featureFlags` existen en `firestore.rules`. 59 funciones exportadas en `functions/src/index.ts`.
- Los pasos de onboarding son **18**, no 15: el bloque `descubre` se añadió después.

### Deuda que la wiki no resuelve

Los dos documentos de IA y las cinco PRD de IA viven fuera de git —carpeta local y Google Drive— y por tanto **sin historial de versiones**. Registrado en [[portafolio-prd]].

## [2026-08-01] lint | post-ingest agosto 2026

- **Fantasmas introducidos: 0.** Preexistentes ajenos, no tocados: `consolidacion-landing-2026` (7 páginas), `globals-css` (3), `analytics`, `pain-section`, `wikilinks` en index.
- **Densidad** (mín. 8): todas entre 8 y 14. onboarding-guiado 14, plan-general-ia 11, programa-ia 10.
- **Entrantes** (mín. 5): todas entre 5 y 14. soporte 14, ciclo-de-vida-tenant 12, onboarding-guiado 12.
- **Frontmatter**: 9/9 páginas con los 5 campos exactos y en orden. Idioma es-CO: OK.
- **Huérfanas en toda la wiki: 0.**
- Tres páginas necesitaron enlaces entrantes adicionales tras el primer lint; se añadieron desde [[roadmap-tecnico]], [[animaciones]] y [[layout-patterns]], que además ganaron contenido propio en vez de una lista de enlaces suelta.
- **66 páginas** en total (57 antes).

---

## [2026-06-27] update | Explicación de opciones de variante (VariantOptionPicker)

- Páginas actualizadas: 1 ([[modulos-variantes]] — sección "Dónde se configura").
- Entidades: `VariantOptionPicker`, campos `bestFor`/`highlights`/`helpText`/`changeNote`, banda de
  irreversibilidad + checkbox de confirmación para variantes `locked` al crear el conjunto.

---

## [2026-06-27] ingest | Sesión Módulos con variantes (junio 2026)

Fuente: implementación del piloto de `moduleVariants` (los 6 módulos: Visitas, Paquetería, PQRS, Comunicaciones, Gobernanza y Finanzas).
- Páginas creadas: 1 ([[modulos-variantes]] en arquitectura).
- Páginas actualizadas: 9 ([[index]], [[visitantes]], [[paquetes]], [[pqrs]], [[comunicaciones]], [[reglamento]], [[billing]], [[configuracion]], [[estado-modulos]]).
- Entidades extraídas: moduleVariants, getModuleVariant, useModuleVariant, VARIANT_EDITABILITY (locked/warn/free), variantes `qr_full`/`registro_simple`, `con_evidencia`/`aviso_simple`, `con_sla`/`buzon_simple`, `canal_oficial`/`tablon_simple`, `formal`/`informativo` y `completa`/`solo_consulta`, Cloud Functions `registerWalkInVisit`, `assertFinanceManagementEnabled`, `buildAdminSidebarGroups`.
- Finanzas `solo_consulta` (estructural, ~40–50 archivos) se hizo en 3 fases: navegación, acciones en página, guards de funciones.

---

## [2026-06-23] ingest | Sesión Cartera CRM (junio 2026)

Fuente: trabajo de la sesión de reconversión de Cartera en CRM de cobros (comprobantes
semi-ágil, tipos de cobro, lote/programación, campañas, trazabilidad, cierre/archivado,
recordatorios, fusión de unidades duplicadas, notificaciones a residentes).

- Páginas creadas: 3 → [[cartera-campanas]], [[notificaciones-residentes]], [[fusion-unidades]]
- Páginas actualizadas: 5 → [[billing]], [[correos-mensajeria]], [[estado-modulos]], [[trampas-conocidas]], [[index|index]]
- Entidades extraídas: BillingCampaign, BillingSchedule, BillingReminderJob, concept (Mantenimiento y Administración), campaignId/archived/reminderCount, callable mergeUnits + mapa de referencias unitId, crons publishScheduledCharges/sendScheduledReminders/updateOverdueStatements, catálogo de notificaciones (billing_reminder, payment_adjusted, payment_rejected), carpetas de sistema (Comprobantes de pago, Cierres de cartera), contrato de seguridad de `archived`.
- Trampas nuevas: subscribeTenantCollection no serializa Timestamps; `archived` se filtra solo en tablas vivas; desplegar reglas antes del front para colecciones nuevas.

## [2026-06-23] lint | post-ingest Cartera CRM

- Fantasmas introducidos por el ingest: 0. (Preexistentes ajenos: `consolidacion-landing-2026`, `wikilinks` en index — no tocados.)
- Densidad: billing 29, cartera-campanas 19, notificaciones-residentes 19, fusion-unidades 19 (todas ≥ 8).
- Frontmatter: 5/5 campos en las 3 páginas nuevas. Idioma es-CO: OK.

---

## [2026-06-09] UPDATE | Remediación de autenticación y mensajería (go-live)

- **Operación**: UPDATE post-sesión de trabajo
- **Páginas creadas**: 1
  - `wiki/arquitectura/correos-mensajeria.md` — sistema híbrido Resend (onboarding) + Firebase nativo (forgot-password), plantillas welcome/reset, dominio notificaciones.grupovivaru.com, página /restablecer, URL de acción
- **Páginas actualizadas**: 3
  - `wiki/arquitectura/autenticacion-roles.md` — onboarding por enlace (cédula deja de ser credencial), recuperación self-service, cambio de contraseña + política unificada, página /restablecer (A6), CORS de callables; roles a `tenant_admin`/`security_guard`
  - `wiki/decisiones/trampas-conocidas.md` — 5 trampas nuevas: CORS de callables, unitId doc-id vs slug, recompilar+secret antes de deploy functions, URL de acción (dominio autorizado + Owner), no importar functions/ desde src/tests
  - `wiki/index.md` — registrada `correos-mensajeria` (🆕), actualizadas descripciones de auth, usuarios y trampas
- **Trabajo técnico de la sesión (incrementos A0–A6 + fixes)**:
  - A0 política de contraseña unificada server-side; A1 recuperación self-service; A2 onboarding por enlace; A3 cambio de contraseña + complejidad; A4 endurecimiento (documentNumber, seed, marca); A5 correos por Resend; A6 página `/restablecer`
  - Fixes: CORS `www.grupovivaru.com` en callables; `unitId` por doc id; unidades duplicadas bloqueadas; borrado de persona robusto; logo en correo
- **Pendientes del usuario**: guardar la URL de acción en Firebase Console (requiere Owner); commits/deploys desde su terminal
- ⚠️ **LINT pendiente**: verificar enlaces entrantes (≥5) hacia `correos-mensajeria` y frontmatter

---

## [2026-05-31] UPDATE | Consolidación landing + fix Tailwind v4

- **Operación**: UPDATE post-sesión de trabajo
- **Páginas creadas**: 3
  - `wiki/arquitectura/landing-marketing.md` — route group (marketing), rutas, componentes, lib, assets, HITLs, restricciones de negocio
  - `wiki/diseno-sistema/tailwind-v4-spacing-fix.md` — bug --spacing-* vs max-w-*, intento fallido con @utility, fix correcto con .marketing-theme scoped
  - `wiki/modulos/diagnostico.md` — lead magnet /diagnostico, scoring, notificación, HITL H11
- **Páginas actualizadas**: 6
  - `wiki/arquitectura/estructura-app-router.md` — añadido route group (marketing), actualizado Next.js 14 → 15
  - `wiki/arquitectura/stack-tecnico.md` — actualizado Next.js 14/React 18 → 15/React 19, Tailwind v3 → v4, nuevas deps (@base-ui/react, framer-motion, posthog-js, Firebase App Hosting)
  - `wiki/diseno-sistema/tokens-color.md` — añadida paleta de brand tokens del landing + tokens de espaciado con advertencia de colisión Tailwind v4
  - `wiki/decisiones/estado-modulos.md` — añadida tabla de estado del landing marketing con HITLs pendientes
  - `wiki/decisiones/trampas-conocidas.md` — añadidas dos trampas Tailwind v4: @utility fusionado y camelCase de clases de color
  - `wiki/index.md` — registradas 3 páginas nuevas (🆕), actualizadas descripciones de stack y decisiones
- **Entidades extraídas**:
  - 17 componentes de sección del landing
  - 8 componentes UI de `components/marketing/ui/`
  - 8 archivos de `lib/marketing/`
  - 6 assets de `public/product/`
  - 2 commits clave (`c586740` intento fallido, `dcac2ce` fix correcto)
  - 3 HITLs documentados (H7, H11, H14)
  - 2 nuevas trampas Tailwind v4 en `trampas-conocidas`
- **Trabajo técnico de la sesión**:
  - Consolidación `vivaru-landing/` → `vivaru/` route group (marketing)
  - Diagnóstico y fix de bug crítico CSS: `--spacing-*` colisiona con `max-w-*` en Tailwind v4
  - Fix camelCase → kebab-case en clases de color (5 componentes)
  - ⚠️ **Acción pendiente del usuario**: `git push origin master` (commit `dcac2ce`)

---

Historial cronológico de ingestas, actualizaciones y operaciones de mantenimiento.

---

## [2026-05-20] setup + ingest inicial | Dominio PRODUCTO/DESARROLLO

- **Operación**: SETUP + INGEST batch
- **Páginas creadas**: 40
  - 1 CLAUDE.md (raíz)
  - 1 raw/README.md
  - 2 wiki/ (index.md, log.md)
  - 6 wiki/fuentes/
  - 4 wiki/arquitectura/
  - 15 wiki/modulos/
  - 5 wiki/diseno-sistema/
  - 5 wiki/patrones-tecnicos/
  - 4 wiki/decisiones/
- **Páginas actualizadas**: 0 (ingesta inicial)
- **Fuentes procesadas**:
  - PRODUCT.md — visión, portales, principios, brand, tono de voz
  - DESIGN.md — tokens CSS, tipografía, componentes, animaciones, layout
  - domain.ts — tipos Tenant, SessionUser, Communication, Reservation, Ticket, PackageItem, VisitorPass, BillingStatement, PaymentReceipt, TenantDocument
  - BACKLOG.md — estado de módulos admin, resident, guard
  - middleware.ts — rutas públicas, session cookie, routeByRole, canAccessPath, mustChangePassword
  - GTM técnico — fases 0–4, seguridad, compliance, escalado
- **Entidades extraídas**:
  - 4 portales (admin, resident, guard, superadmin)
  - 15 módulos documentados
  - 12 tipos de dominio
  - 5 patrones técnicos establecidos
  - 12 absolute bans activos
  - 4 fases de roadmap GTM
  - 8 trampas conocidas documentadas

---

## [2026-07-03] ingest | Auditoría UX/UI jul-2026 + sesión de remediación

Fuente: `vivaru_ux_audit.html` (42 hallazgos VIV-###) y la sesión de ejecución completa.

- **Páginas creadas: 8**
  - `fuentes/auditoria-ux-jul-2026` — la fuente y sus tres tesis
  - `decisiones/triaje-auditoria-ux` — metodología de verificación (aplica / ya resuelto / data demo / negocio)
  - `decisiones/torres-canonicas` — normalizeTower, lista por tenant, migración one-off
  - `decisiones/integridad-financiera` — reversos, confirmación de cobros, mora real
  - `patrones-tecnicos/resolucion-unit-id` — resolver único unitId→nombre
  - `patrones-tecnicos/kpis-formula-unica` — % recaudo, PQRS pendientes, firma
  - `patrones-tecnicos/acciones-de-fila` — patrón único de acciones destructivas
  - `arquitectura/dominios-app-hosting` — topología y runbook del 403
- **Páginas actualizadas: 2** — `index.md` (8 entradas nuevas), `trampas-conocidas` (4 trampas: transform de zod con getValues, códigos auth/* sin mapear, fallbacks que incrustan IDs, dominio 403 en verde)
- **Entidades extraídas:** normalizeTower, resolveUnitName, computeCollectionSummary, isTicketPending, reverseLedgerEntry, detectAmountAnomaly, findReservationConflict, RowActionsMenu, remindPackagePickup, migrate-towers.mjs

---

## Próximas operaciones sugeridas

- **LINT post-batch**: verificar frontmatter, fantasmas, densidad de links
- **INGEST**: cuando se actualice PRODUCT.md, DESIGN.md o se complete un módulo pendiente
- **UPDATE estado-modulos**: cuando Reservaciones, Paquetes, Comunicaciones, Encuestas, Reglamento o Reportes pasen a ✅
- **INGEST pendientes del Grupo 3**: al ejecutar el split de Cartera en sub-rutas (VIV-1102) y el rich text en comunicados (VIV-402)
- **DECISIONES de negocio abiertas**: Panamá en el selector fiscal (VIV-1801) y roles de comité + firma digital (VIV-1503/1601)

---

## [2026-07-03] lint | Post-batch auditoría UX

- **Frontmatter**: 8/8 páginas nuevas con los 5 campos exactos ✅
- **Idioma**: 100% es-CO ✅
- **Fantasmas introducidos**: 0 ✅ (persisten preexistentes: `consolidacion-landing-2026`, `globals-css`, `analytics`, `pain-section` — fuentes citadas sin página propia)
- **Densidad**: todas las nuevas ≥8 wikilinks (rango 8–17) ✅
- **Entrantes**: mínimo 4 por página nueva tras añadir backlinks desde `stack-tecnico`, `estructura-app-router`, `componentes` y `data-table-pattern`
- **Total wiki**: 57 páginas

---

## [2026-08-09] ingest | Paso 1.1 del programa de IA — banderas de funcionalidad

- **Páginas creadas**: 1 — [[banderas-funcionalidad]]
- **Páginas actualizadas**: 2 — `index.md`, [[programa-ia]] (la brecha «`featureFlags` sin lector» pasa a resuelta)
- **Entidades extraídas**: colecciones `featureFlags` y `featureFlagOverrides`, documento `_global`, precedencia de cinco niveles, kill switch maestro y por bandera, `assertFeatureEnabled` en Cloud Functions, consola `/superadmin/flags`, script de siembra idempotente
- **Nota**: el mecanismo se construyó genérico. No pertenece al programa de IA — este es solo su primer cliente
