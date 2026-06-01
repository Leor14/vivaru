---
tags: [arquitectura, nextjs, rutas]
tipo: tecnica
fuentes: ["PRODUCT.md", "middleware.ts", "consolidacion-landing-2026"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-31
---

# Estructura App Router

Next.js 15 App Router organiza el sitio de Vivaru en dos zonas: el **SaaS** (portales autenticados) y el **Landing Marketing** (sitio público). Ambas conviven en el mismo repo y se despliegan juntas desde Firebase App Hosting. El repo `vivaru-landing/` (Next.js 14 + Tailwind v3) quedó **deprecado** en mayo 2026.

## Route group (marketing) — sitio público

El landing vive bajo `src/app/(marketing)/` — un route group de Next.js que no añade segmento de URL. Ver [[landing-marketing]] para el detalle completo de componentes, rutas y restricciones de negocio.

| Ruta | Descripción |
|---|---|
| `/mx` | Landing principal para México |
| `/diagnostico` | Lead magnet — cuestionario de madurez digital. Ver [[diagnostico]] |
| `/legal/privacidad` | Política de privacidad |
| `/legal/terminos` | Términos de uso |
| `/legal/datos` | Tratamiento de datos |

El layout del route group aplica `.marketing-theme` para aislar los tokens CSS del landing del SaaS. El fix de `max-w-*` depende de que este wrapper exista. Ver [[tailwind-v4-spacing-fix]].

## Portales SaaS autenticados

| Portal | Ruta base | Paradigma | Usuarios |
|---|---|---|---|
| Admin | `/admin` | Desktop-first, denso | Administrador del edificio |
| Residente | `/resident` | Mobile-first, baja fricción | Propietarios e inquilinos |
| Guardia | `/guard` | Mobile-first, 4 funciones | Personal de seguridad |
| Superadmin | `/superadmin` | Consola global | Equipo interno Vivaru |

## Módulos del portal Admin

La ruta `/admin` contiene los módulos operativos del administrador: [[dashboard-admin]], [[billing]], [[pqrs]], [[reservaciones]], [[visitantes]], [[paquetes]], [[comunicaciones]], [[encuestas]], [[reglamento]], [[reportes]], [[usuarios]] y [[configuracion]]. Cada módulo es un segmento de ruta independiente (`/admin/billing`, `/admin/pqrs`, etc.).

## Layout y shell

El portal admin usa la clase `.admin-shell` en su layout raíz, lo que suprime la fuente Fraunces y activa los estilos de alta densidad. Ver [[tipografia]] y [[layout-patterns]].

El portal residente y el guardia usan layouts móviles con `position: fixed` en los headers, resolviendo el problema de `sticky` en iOS Safari. Ver [[mobile-first-ios]].

## Rutas públicas

Las rutas `/`, `/login`, `/forgot-password`, `/setup-error` y `/unauthorized` no requieren autenticación. El [[middleware-ts|middleware]] las excluye del RBAC. Ver [[autenticacion-roles]].

## Matcher del middleware

El matcher excluye `_next`, `favicon` y archivos con extensión. Esto garantiza que los assets estáticos no pasen por la lógica de autenticación, lo que evitaría bloquear fuentes, imágenes y scripts de Next.js.

## Relaciones

- Véase también: [[stack-tecnico]], [[autenticacion-roles]], [[middleware-ts]], [[landing-marketing]]
- Depende de: [[multi-tenancy]]
- Se conecta con: [[layout-patterns]], [[mobile-first-ios]], [[portal-residente]], [[portal-guardia]], [[superadmin]], [[tailwind-v4-spacing-fix]]

## Fuentes

- [[product-md]], [[middleware-ts]], [[consolidacion-landing-2026]]
