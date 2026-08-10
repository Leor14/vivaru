---
tags: [indice, navegacion]
tipo: concepto
fuentes: ["PRODUCT.md", "DESIGN.md", "domain.ts", "middleware.ts", "gtm-tecnico", "consolidacion-landing-2026", "sesion-cartera-crm-2026-06", "estrategia-ia-minima-viable", "plan-general-ia"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-08-01
---

# Índice — Vivaru Wiki Producto

Catálogo maestro del vault. Cada entrada tiene un enlace y una línea de descripción. Para navegar, empieza aquí y sigue los `[[wikilinks]]`.

---

## Fuentes

| Página | Descripción |
|---|---|
| [[product-md]] | Visión de producto, portales, principios de diseño y tono de voz |
| [[design-md]] | Tokens CSS, tipografía, componentes, animaciones y patrones de layout |
| [[domain-types]] | Tipos TypeScript del dominio: Tenant, SessionUser, módulos principales |
| [[backlog-md]] | Estado actual de módulos: completados, en progreso y pendientes |
| [[middleware-ts]] | Lógica de autenticación, RBAC y routing por rol |
| [[gtm-tecnico]] | Roadmap técnico go-to-market, fases 0 a 4+ |
| [[auditoria-ux-jul-2026]] | Auditoría UX/UI externa de julio 2026: 42 hallazgos VIV-### sobre el portal admin |
| [[estrategia-ia-minima-viable]] | 🆕 Decisión ejecutiva de IA: dos capacidades externas, techo de costo y correcciones a supuestos |
| [[plan-general-ia]] | 🆕 Plan maestro de IA: fases 0–6, puertas G0–G7, datasets, seguridad y decisiones pendientes |

---

## Arquitectura

| Página | Descripción |
|---|---|
| [[estructura-app-router]] | Rutas Next.js 15: portales SaaS + route group (marketing) público |
| [[landing-marketing]] | 🆕 Route group (marketing): rutas, componentes, lib y assets del landing |
| [[autenticacion-roles]] | Firebase Auth, Custom Claims, RBAC, onboarding por enlace y recuperación |
| [[correos-mensajeria]] | 🆕 Mensajería híbrida: Resend (onboarding) + Firebase nativo, página /restablecer |
| [[notificaciones-residentes]] | 🆕 Avisos in-app + email a residentes: catálogo editable, triggers y crons |
| [[multi-tenancy]] | Modelo multi-tenant lógico sobre Firestore, aislamiento y planes |
| [[modulos-variantes]] | 🆕 moduleVariants: modos de operación por módulo (Visitas/Paquetería simple vs completo) |
| [[stack-tecnico]] | Stack: Next.js 15 / React 19 / Tailwind v4 / Firebase App Hosting |
| [[dominios-app-hosting]] | Topología prod/staging, dominios custom y runbook del incidente 403 |
| [[ciclo-de-vida-tenant]] | 🆕 `tenants.status`: prueba → cliente, `tenantOperable()` y el candado de módulos en tres capas |
| [[programa-ia]] | 🆕 IA decidida y no construida: dos capacidades, principios, orden de fases y brechas verificadas |
| [[banderas-funcionalidad]] | 🆕 Encender y apagar capacidades sin desplegar: precedencia, kill switch maestro y aislamiento de overrides |

---

## Módulos SaaS

| Página | Descripción |
|---|---|
| [[dashboard-admin]] | Vista principal del administrador: KPIs, accesos rápidos, widgets |
| [[billing]] | Cartera y cobros: CRM de cobros, comprobantes, tipos de cobro, lote/programación |
| [[cartera-campanas]] | 🆕 Campañas, listados por pestaña, embudo CRM, recordatorios y cierre de períodos |
| [[pqrs]] | Peticiones, quejas, reclamos y sugerencias: tickets, radicados, historial |
| [[reservaciones]] | Reserva de amenidades y mudanzas: slots, aprobación, depósitos |
| [[visitantes]] | Registro de visitas, QR, check-in/out, guardas |
| [[paquetes]] | Paquetería: recepción, notificación y entrega a residente |
| [[comunicaciones]] | Comunicados del administrador a propietarios e inquilinos |
| [[encuestas]] | Encuestas internas del conjunto residencial |
| [[reglamento]] | Documentos del conjunto: reglamento, actas, circulares |
| [[reportes]] | Reportes operativos y financieros del administrador |
| [[usuarios]] | Gestión de usuarios del tenant: roles, acceso, onboarding por enlace |
| [[configuracion]] | Configuración del tenant: branding, datos generales |
| [[portal-residente]] | Portal mobile-first para propietarios e inquilinos |
| [[portal-guardia]] | Portal mobile-first para guardas: 4 funciones clave |
| [[superadmin]] | Consola global del equipo interno Vivaru |
| [[soporte]] | 🆕 Tickets del administrador hacia Vivaru: estados, notas internas, adjuntos y la excepción a `tenantOperable` |
| [[onboarding-guiado]] | 🆕 Guía de puesta en marcha: 18 pasos en 4 bloques, dos recorridos y señales de completado |

## Módulos Marketing

| Página | Descripción |
|---|---|
| [[diagnostico]] | 🆕 Lead magnet /diagnostico: cuestionario de madurez digital, scoring y notificación |

---

## Sistema de Diseño

| Página | Descripción |
|---|---|
| [[tokens-color]] | Paleta SaaS + tokens brand del landing, colores semánticos y espaciado |
| [[tipografia]] | Manrope y Fraunces, escala tipográfica, KPI fluid |
| [[componentes]] | Button, Card, Dialog, Drawer, DataTable, StatusBadge y más |
| [[animaciones]] | Easing, duraciones, keyframes, collapsible-grid, prefers-reduced-motion |
| [[layout-patterns]] | Admin page layout, resident page layout, grids KPI, dashboard widgets |
| [[tailwind-v4-spacing-fix]] | Bug --spacing-* vs max-w-* en Tailwind v4 y fix con .marketing-theme scoped |
| [[transiciones-navegacion]] | 🆕 Velo con logo al navegar, dónde SÍ y dónde no, y el barrido de 20 tokens sin declarar |

---

## Patrones Técnicos

| Página | Descripción |
|---|---|
| [[mobile-first-ios]] | overflow clip, headers fixed, createPortal, Web Share API |
| [[data-table-pattern]] | DataTable con renderMobileRow, filas compactas 56px |
| [[drawer-pattern]] | Drawer right-anchored, 480px desktop, ease-drawer, flujos complejos |
| [[form-validation]] | Zod + React Hook Form, React.forwardRef, patrones de validación |
| [[firebase-firestore]] | Colecciones, reglas, Cloud Functions, auditoría |
| [[fusion-unidades]] | 🆕 Fusionar unidades duplicadas: callable mergeUnits y mapa de referencias |
| [[resolucion-unit-id]] | 🆕 Resolver único unitId→nombre: índice por doc-id y slug, jamás un ID crudo en la UI |
| [[kpis-formula-unica]] | 🆕 Un indicador, una definición compartida: % recaudo, PQRS pendientes, cumplimiento de firma |
| [[acciones-de-fila]] | Patrón único de acciones: inline lo frecuente, destructivas al menú contextual |
| [[pruebas-reglas-emulador]] | 🆕 Correr el emulador de Firestore, sus dos trampas, y por qué una prueba parada engaña |

---

## Decisiones

| Página | Descripción |
|---|---|
| [[absolute-bans]] | Prohibiciones absolutas de diseño y código (bugs si se violan) |
| [[estado-modulos]] | Estado de módulos SaaS + estado de secciones del landing marketing |
| [[roadmap-tecnico]] | Fases GTM 0–4: seguridad, branding, compliance, escalado |
| [[trampas-conocidas]] | Errores recurrentes: Tailwind v4, CORS de callables, unitId doc-id, deploy de functions |
| [[triaje-auditoria-ux]] | 🆕 Cómo se verifica un reporte externo contra código antes de ejecutarlo |
| [[torres-canonicas]] | 🆕 Agrupaciones canónicas: normalizeTower, lista por tenant y migración one-off |
| [[integridad-financiera]] | Reversar en vez de borrar, confirmar cobros y mora real |
| [[portafolio-prd]] | 🆕 Dónde viven las PRD y por qué: `docs/prd/funcionales/` y `docs/prd/ia/`, dos skills, una regla |
