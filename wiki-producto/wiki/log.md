---
tags: [log, historial]
tipo: decision
fuentes: ["PRODUCT.md", "DESIGN.md", "domain.ts", "middleware.ts", "gtm-tecnico", "consolidacion-landing-2026"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-31
---

# Log de operaciones — Vivaru Wiki Producto

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
