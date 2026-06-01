---
tags: [indice, navegacion]
tipo: concepto
fuentes: ["PRODUCT.md", "DESIGN.md", "domain.ts", "middleware.ts", "gtm-tecnico", "consolidacion-landing-2026"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-31
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

---

## Arquitectura

| Página | Descripción |
|---|---|
| [[estructura-app-router]] | Rutas Next.js 15: portales SaaS + route group (marketing) público |
| [[landing-marketing]] | 🆕 Route group (marketing): rutas, componentes, lib y assets del landing |
| [[autenticacion-roles]] | Firebase Auth, Custom Claims, RBAC y flujo de sesión |
| [[multi-tenancy]] | Modelo multi-tenant lógico sobre Firestore, aislamiento y planes |
| [[stack-tecnico]] | Stack: Next.js 15 / React 19 / Tailwind v4 / Firebase App Hosting |

---

## Módulos SaaS

| Página | Descripción |
|---|---|
| [[dashboard-admin]] | Vista principal del administrador: KPIs, accesos rápidos, widgets |
| [[billing]] | Cartera y cobros: estados de cuenta, recibos, flujo de pago |
| [[pqrs]] | Peticiones, quejas, reclamos y sugerencias: tickets, radicados, historial |
| [[reservaciones]] | Reserva de amenidades y mudanzas: slots, aprobación, depósitos |
| [[visitantes]] | Registro de visitas, QR, check-in/out, guardas |
| [[paquetes]] | Paquetería: recepción, notificación y entrega a residente |
| [[comunicaciones]] | Comunicados del administrador a propietarios e inquilinos |
| [[encuestas]] | Encuestas internas del conjunto residencial |
| [[reglamento]] | Documentos del conjunto: reglamento, actas, circulares |
| [[reportes]] | Reportes operativos y financieros del administrador |
| [[usuarios]] | Gestión de usuarios del tenant: roles, acceso, contraseñas temporales |
| [[configuracion]] | Configuración del tenant: branding, datos generales |
| [[portal-residente]] | Portal mobile-first para propietarios e inquilinos |
| [[portal-guardia]] | Portal mobile-first para guardas: 4 funciones clave |
| [[superadmin]] | Consola global del equipo interno Vivaru |

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
| [[tailwind-v4-spacing-fix]] | 🆕 Bug --spacing-* vs max-w-* en Tailwind v4 y fix con .marketing-theme scoped |

---

## Patrones Técnicos

| Página | Descripción |
|---|---|
| [[mobile-first-ios]] | overflow clip, headers fixed, createPortal, Web Share API |
| [[data-table-pattern]] | DataTable con renderMobileRow, filas compactas 56px |
| [[drawer-pattern]] | Drawer right-anchored, 480px desktop, ease-drawer, flujos complejos |
| [[form-validation]] | Zod + React Hook Form, React.forwardRef, patrones de validación |
| [[firebase-firestore]] | Colecciones, reglas, Cloud Functions, auditoría |

---

## Decisiones

| Página | Descripción |
|---|---|
| [[absolute-bans]] | Prohibiciones absolutas de diseño y código (bugs si se violan) |
| [[estado-modulos]] | Estado de módulos SaaS + estado de secciones del landing marketing |
| [[roadmap-tecnico]] | Fases GTM 0–4: seguridad, branding, compliance, escalado |
| [[trampas-conocidas]] | Errores recurrentes + nuevas trampas Tailwind v4 (kebab-case, @utility) |
