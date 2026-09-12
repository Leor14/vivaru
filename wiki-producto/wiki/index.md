---
tags: [indice, navegacion]
tipo: concepto
fuentes: ["PRODUCT.md", "DESIGN.md", "domain.ts", "middleware.ts", "gtm-tecnico", "consolidacion-landing-2026", "sesion-cartera-crm-2026-06", "estrategia-ia-minima-viable", "plan-general-ia"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-09-12
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
| [[consolidacion-landing-2026]] | 🆕 La sesión de mayo 2026 que metió el landing en el SaaS y destapó el choque `--spacing-*` / `max-w-*` |

---

## Arquitectura

| Página | Descripción |
|---|---|
| [[estructura-app-router]] | Rutas Next.js 15: portales SaaS + route group (marketing) público |
| [[landing-marketing]] | 🆕 Route group (marketing): rutas, componentes, lib y assets del landing |
| [[autenticacion-roles]] | Firebase Auth, Custom Claims, RBAC, onboarding por enlace, recuperación y las puertas que no delatan cuentas (`FIX-004`, `FIX-005`) |
| [[correos-mensajeria]] | 🆕 Mensajería híbrida: Resend (onboarding) + Firebase nativo, página /restablecer |
| [[notificaciones-residentes]] | 🆕 Avisos in-app + email a residentes: catálogo editable, triggers y crons |
| [[multi-tenancy]] | Modelo multi-tenant lógico sobre Firestore, aislamiento y planes |
| [[modulos-variantes]] | 🆕 moduleVariants: modos de operación por módulo (Visitas/Paquetería simple vs completo) |
| [[stack-tecnico]] | Stack: Next.js 15 / React 19 / Tailwind v4 / Firebase App Hosting |
| [[dominios-app-hosting]] | Topología prod/staging, dominios custom y runbook del incidente 403 |
| [[ciclo-de-vida-tenant]] | 🆕 `tenants.status`: prueba → cliente, `tenantOperable()` y el candado de módulos en tres capas |
| [[programa-ia]] | Dos capacidades construidas y medidas; la sombra de PQRS corre en producción. Estado por ambiente y brechas recontadas |
| [[banderas-funcionalidad]] | 🆕 Encender y apagar capacidades sin desplegar: precedencia, kill switch maestro y aislamiento de overrides |
| [[puerta-ia]] | Dos puertas —sesión y servidor— sobre un solo tramo de ejecución. El conjunto sale de la sesión; proveedor real vía Vertex |
| [[integracion-albert]] | 🆕 Vivaru es TENANT de Albert CRM, y eso decide la arquitectura: sin webhooks, sin OIDC, con usuario de servicio. Tenant dado de alta el 22 ago 2026 |
| [[rol-consejo]] | 🆕 El consejo es un atributo de la membresía, no un rol: lee lo emitido, firma, y no ve el detalle por unidad (`PLAT-004`) |
| [[puerta-de-buzones]] | 🆕 En un conjunto sin cliente detrás solo entran y salen direcciones de prueba o del equipo (`PLAT-006`) |

---

## Módulos SaaS

| Página | Descripción |
|---|---|
| [[dashboard-admin]] | Vista principal del administrador: KPIs, accesos rápidos, widgets |
| [[billing]] | Cartera y cobros: CRM de cobros, comprobantes, tipos de cobro, lote/programación |
| [[cartera-campanas]] | 🆕 Campañas, listados por pestaña, embudo CRM, recordatorios y cierre de períodos |
| [[pqrs]] | Tickets residente→administración: radicado, semáforo de 15 días hábiles, editor de clasificación y capa de IA con modo sombra |
| [[reservaciones]] | Reservas de áreas comunes y mudanzas: decide el servidor (`FIX-001`), política por área y la hora del conjunto |
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
| [[informe-mensual]] | 🆕 El informe del Decreto 462: anclado al banco, emitido, congelado y firmado; el detalle por unidad, aparte (`FLOW-007`) |
| [[cuentas-por-pagar]] | 🆕 Egresos con calendario de cuotas: cada cuota se paga y deja su asiento (`FLOW-008`) |
| [[tesoreria]] | 🆕 Saldo por cuenta, traspasos que no son asientos y caja chica (`FEAT-010`) |
| [[medicion-consumos]] | 🆕 El agua medida con foto: lecturas, cierre de período y cobro por consumo (`FEAT-008`) |
| [[presupuesto]] | 🆕 El presupuesto anual contra lo ejecutado, para la asamblea (`FEAT-009`) |

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
| [[modo-oscuro]] | 🆕 Tema claro u oscuro elegido por cada usuario; seis formas de color literal, y lo impreso siempre en claro (`FEAT-007`) |

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
| [[falsacion-de-pruebas]] | 🆕 Un verde solo vale si algo puede enrojecerlo: romper el código a propósito y contar cuáles fallan |

---

## Decisiones

| Página | Descripción |
|---|---|
| [[absolute-bans]] | Prohibiciones absolutas de diseño y código (bugs si se violan) |
| [[estado-modulos]] | Estado de módulos SaaS, landing marketing, adquisición y programa de IA (construido, no 0%) |
| [[roadmap-tecnico]] | Fases GTM 0–4: seguridad, branding, compliance, escalado. **Plan de mayo, no estado actual** |
| [[trampas-conocidas]] | Errores recurrentes: Tailwind v4, CORS de callables, unitId doc-id, deploy de functions, proyecto activo = producción, condiciones escritas contra un valor y **copiadas en más sitios de los que el inventario vio**, **`units` es raíz y su id es GLOBAL**, y **cuando una frase dice «todas» hay que contar cuántas son** |
| [[triaje-auditoria-ux]] | 🆕 Cómo se verifica un reporte externo contra código antes de ejecutarlo |
| [[torres-canonicas]] | 🆕 Agrupaciones canónicas: normalizeTower, lista por tenant y migración one-off |
| [[integridad-financiera]] | Reversar en vez de borrar, confirmar cobros, mora real, y **la exclusión que evita el doble conteo** — mira el origen del asiento, **en producción desde el 23 ago 2026** |
| [[portafolio-prd]] | 🆕 Dónde viven las PRD y por qué: `docs/prd/funcionales/` y `docs/prd/ia/`, dos skills, una regla |
