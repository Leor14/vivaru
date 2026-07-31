---
tags: [arquitectura, stack, tecnologia]
tipo: tecnica
fuentes: ["PRODUCT.md", "DESIGN.md", "consolidacion-landing-2026"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-31
---

# Stack Técnico

Vivaru está construido sobre Next.js 15 App Router con TypeScript y React 19, combinando un frontend tipado con un backend Firebase completamente serverless. El stack fue elegido para maximizar la velocidad de desarrollo en un equipo pequeño sin sacrificar la escalabilidad del modelo [[multi-tenancy|multi-tenant]].

## Capa de frontend

**Next.js 15 / React 19** (actualizado desde Next.js 14 / React 18 en mayo 2026 durante la consolidación del landing). Define la estructura de rutas para el SaaS y el [[landing-marketing|landing de marketing]]. Ver [[estructura-app-router]] para el detalle.

**TypeScript** con tipos estrictos definidos en [[domain-types]]. Todos los formularios usan **Zod + React Hook Form** con `React.forwardRef` obligatorio en componentes registrados. Ver [[form-validation]].

**Tailwind CSS v4** (actualizado desde v3). Implementa el [[tokens-color|sistema de tokens]] como variables CSS custom. ⚠️ La migración a v4 introdujo un bug crítico de colisión de namespace `--spacing-*` vs `max-w-*`. Ver [[tailwind-v4-spacing-fix]] antes de modificar tokens de espaciado en `@theme`.

**Lucide Icons** es la única librería de iconos permitida en todo el proyecto (SaaS y landing).

## Dependencias exclusivas del landing

El [[landing-marketing|route group (marketing)]] requiere dependencias adicionales que no usa el SaaS:

| Librería | Uso |
|---|---|
| `@base-ui/react` | Primitivas UI accesibles para componentes de marketing (accordion, button, dialog, sheet) |
| `framer-motion` | Animaciones de entrada y transición de tabs en Perspectives |
| `posthog-js` | Analítica de conversión del landing (eventos de CTA, tabs, hover) |

## Capa de backend

**Firebase Auth** maneja la autenticación con Custom Claims (`role` + `tenantId`). La sesión se gestiona via cookies HTTP-only con `SESSION_COOKIE_KEY`. Ver [[autenticacion-roles]].

**Firestore** es la base de datos principal. Modelo multi-tenant lógico: todos los documentos llevan `tenantId`. Las reglas de aislamiento viven en `firestore.rules` (700+ líneas). Ver [[firebase-firestore]].

**Firebase App Hosting** despliega automáticamente en `grupovivaru.com` a cada `git push` a `master`. El archivo de configuración es `apphosting.yaml` en la raíz del repo.

**Cloud Functions** ejecutan operaciones privilegiadas: `createTenant`, `createTenantWorkspace`, `createTenantAdmin`, `createTenantOperationalUser`, `provisionResidentTemporaryAccess`. Ver [[firebase-firestore]].

## Dependencias clave del SaaS

| Librería | Uso |
|---|---|
| Zod | Validación de esquemas en formularios y Cloud Functions |
| React Hook Form | Formularios con bajo re-render |
| Radix UI | Primitivas accesibles (Tooltip para HelpTip) |
| Lucide | Iconos |

## Relaciones

- Véase también: [[dominios-app-hosting]], [[estructura-app-router]], [[multi-tenancy]], [[firebase-firestore]], [[landing-marketing]]
- Depende de: —
- Se conecta con: [[autenticacion-roles]], [[form-validation]], [[tokens-color]], [[domain-types]], [[tailwind-v4-spacing-fix]]

## Fuentes

- [[product-md]], [[design-md]], [[consolidacion-landing-2026]]
