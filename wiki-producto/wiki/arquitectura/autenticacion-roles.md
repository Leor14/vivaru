---
tags: [arquitectura, autenticacion, rbac, seguridad]
tipo: tecnica
fuentes: ["middleware.ts", "domain.ts"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Autenticación y Roles

Vivaru implementa autenticación basada en Firebase Auth con Custom Claims para el control de acceso por rol (RBAC). La sesión se persiste en una cookie HTTP-only y el [[middleware-ts|middleware de Next.js]] enforza el RBAC en cada petición.

## Flujo de autenticación

1. El usuario ingresa credenciales en `/login`
2. Firebase Auth valida y genera un ID token
3. El servidor crea una session cookie firmada con `SESSION_COOKIE_KEY`
4. En cada request, `decodeSessionCookie` valida la cookie
5. El middleware ejecuta `routeByRole(session.role)` y `canAccessPath(role, pathname)`

Si la sesión es inválida o el rol no tiene acceso al path solicitado, el usuario es redirigido a `/unauthorized`. Ver [[middleware-ts]].

## Custom Claims

Firebase Auth almacena `role` y `tenantId` como Custom Claims en el token JWT. Esto permite que tanto el middleware (edge) como las reglas de Firestore lean el rol sin consultar la base de datos.

## Roles del sistema

| Rol | Portal | Acceso |
|---|---|---|
| `admin` | `/admin` | Todos los módulos del tenant |
| `resident` | `/resident` | Solo su unidad |
| `guard` | `/guard` | 4 funciones de seguridad |
| `superadmin` | `/superadmin` | Consola global multi-tenant |

Los roles están definidos en [[domain-types|SessionUser.role]]. La membresía de cada usuario a un tenant se almacena en la colección `tenantUsers/{tenantId}_{uid}`, que es la fuente de verdad para el acceso. Ver [[multi-tenancy]].

## Contraseña temporal y onboarding

Cuando un residente es creado via Cloud Function `provisionResidentTemporaryAccess`, recibe una contraseña temporal. Si `mustChangePassword=true` está en su [[domain-types|SessionUser]], el middleware lo redirige a `/resident/change-password-required` en cada request, sin importar la ruta solicitada. Ver [[portal-residente]].

## Reglas Firestore

El aislamiento entre tenants se enforza en `firestore.rules` (700+ líneas), donde cada read/write verifica que `request.auth.token.tenantId == resource.data.tenantId`. Ver [[firebase-firestore]].

## Relaciones

- Véase también: [[middleware-ts]], [[multi-tenancy]], [[firebase-firestore]]
- Depende de: [[domain-types]], [[stack-tecnico]]
- Se conecta con: [[usuarios]], [[portal-residente]], [[portal-guardia]], [[estructura-app-router]]

## Fuentes

- [[middleware-ts]], [[domain-types]]
