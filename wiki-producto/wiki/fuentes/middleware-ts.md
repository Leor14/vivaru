---
tags: [fuente, autenticacion, middleware]
tipo: fuente
fuentes: ["middleware.ts"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Fuente: middleware.ts

Archivo de middleware de Next.js que controla el acceso a todas las rutas de la aplicación. Implementa la lógica de autenticación basada en sesión, el routing por rol y las redirecciones de seguridad.

## Contenido principal

`middleware.ts` es la primera línea de defensa del RBAC. Se ejecuta en el edge antes de que cualquier página se renderice. Usa `decodeSessionCookie` con `SESSION_COOKIE_KEY` para validar la sesión. Ver [[autenticacion-roles]] para el modelo completo.

## Rutas públicas

Las rutas que no requieren autenticación son: `/`, `/login`, `/forgot-password`, `/setup-error` y `/unauthorized`. Todas las demás rutas requieren sesión válida.

## Routing por rol

La función `routeByRole(session.role)` determina la redirección inicial según el rol del usuario:
- `admin` → `/admin`
- `resident` → `/resident`
- `guard` → `/guard`
- `superadmin` → `/superadmin`

La función `canAccessPath(role, pathname)` enforza que cada rol solo acceda a sus rutas. Un guardia no puede acceder a `/admin`, un residente no puede acceder a `/guard`. Ver [[autenticacion-roles]].

## Caso especial: contraseña temporal

Si un residente tiene `mustChangePassword=true` en su [[domain-types|SessionUser]], el middleware lo redirige a `/resident/change-password-required` independientemente de la ruta solicitada. Esta es la implementación del flujo de [[usuarios|contraseñas temporales]] para el onboarding de residentes. Ver [[portal-residente]].

## Matcher

El middleware aplica a todas las rutas excepto `_next` (assets internos de Next.js), `favicon` y archivos con extensión (imágenes, fuentes, etc.). Esto garantiza que las rutas API y pages estén protegidas sin interferir con los assets estáticos.

## Relaciones

- Véase también: [[autenticacion-roles]], [[multi-tenancy]]
- Depende de: [[domain-types]]
- Se conecta con: [[portal-residente]], [[portal-guardia]], [[superadmin]], [[usuarios]], [[stack-tecnico]]

## Fuentes

- Archivo original: `/src/middleware.ts` en el repositorio Vivaru
