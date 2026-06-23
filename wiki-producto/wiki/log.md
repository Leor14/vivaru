---
tags: [log, historial]
tipo: decision
fuentes: ["PRODUCT.md", "DESIGN.md", "domain.ts", "middleware.ts", "gtm-tecnico", "consolidacion-landing-2026"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-06-23
---

# Log de operaciones — Vivaru Wiki Producto

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

## Próximas operaciones sugeridas

- **LINT post-batch**: verificar frontmatter, fantasmas, densidad de links
- **INGEST**: cuando se actualice PRODUCT.md, DESIGN.md o se complete un módulo pendiente
- **UPDATE estado-modulos**: cuando Reservaciones, Paquetes, Comunicaciones, Encuestas, Reglamento o Reportes pasen a ✅
