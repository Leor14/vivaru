---
tags: [arquitectura, autenticacion, rbac, seguridad]
tipo: tecnica
fuentes: ["middleware.ts", "domain.ts"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-06-09
---

# Autenticación y Roles

Vivaru implementa autenticación basada en Firebase Auth con Custom Claims para el control de acceso por rol (RBAC). La sesión se persiste en una cookie HTTP-only y el [[middleware-ts|middleware de Next.js]] enforza el RBAC en cada petición. Toda la mensajería de credenciales vive en [[correos-mensajeria]].

## Flujo de autenticación

1. El usuario ingresa credenciales en `/login`
2. Firebase Auth valida y genera un ID token
3. El servidor crea una session cookie firmada con `SESSION_COOKIE_KEY`
4. En cada request, `decodeSessionCookie` valida la cookie
5. El middleware ejecuta `routeByRole(session.role)` y `canAccessPath(role, pathname)`

Si la sesión es inválida o el rol no tiene acceso al path solicitado, el usuario es redirigido a `/unauthorized`. Ver [[middleware-ts]].

## Custom Claims y membresía

Firebase Auth almacena `role` y `tenantId` como Custom Claims en el token JWT, leídos por el middleware (edge) y por `firestore.rules`. **Importante:** para el rol de tenant, las reglas leen el documento `tenantUsers/{tenantId}_{uid}` (no el claim) vía `tenantRole()`; ese documento es la fuente de verdad del acceso. Ver [[multi-tenancy]] y [[domain-types|SessionUser.role]]. Tras cambiar claims, el usuario debe re-loguearse para refrescar el token.

## Roles del sistema

| Rol | Portal | Acceso |
|---|---|---|
| `tenant_admin` | `/admin` | Todos los módulos del tenant |
| `resident` | `/resident` | Solo su unidad |
| `security_guard` | `/guard` | 4 funciones de seguridad |
| `superadmin` | `/superadmin` | Consola global multi-tenant |

## Onboarding por enlace (jun 2026, A2)

No hay auto-registro. Toda cuenta la crea un admin/superadmin vía Cloud Functions (`createTenantAdmin`, `createTenantOperationalUser`, `provisionResidentTemporaryAccess`). El principio rector: **nunca se transmite una contraseña**. La cuenta nace con una clave aleatoria que nadie conoce (`generateStrongPassword`), y el usuario recibe un correo con un enlace para definir la suya. La **cédula dejó de ser credencial** (antes el residente entraba con su documento). Ver [[usuarios]] y [[correos-mensajeria]].

## Recuperación y cambio de contraseña

- **Auto-servicio (A1):** `/forgot-password` dispara `sendPasswordResetEmail` (Firebase nativo) con mensaje neutro anti-enumeración. Cubre todos los roles.
- **Cambiar contraseña (A3):** admins en Configuración → Seguridad y residentes en su perfil (reautenticación + `updatePassword`).
- **Política unificada (A0):** mínimo 8 caracteres con mayúscula, minúscula, número y símbolo (`assertStrongPassword` en `functions/`), aplicada también a los formularios de cambio. Ver [[form-validation]].

## Página propia de reset (A6)

`/restablecer` valida el `oobCode` con `verifyPasswordResetCode` + `confirmPasswordReset`, en español y con marca, manejando enlace válido/expirado/éxito. Es ruta pública en [[middleware-ts]]. Requiere fijar la **URL de acción** en Firebase Console a `https://www.grupovivaru.com/restablecer` (ajuste global; exige dominio en "Dominios autorizados" y cuenta Owner — ver [[trampas-conocidas]]).

## Seguridad de las callables

Las Cloud Functions callable de identidad restringen el origen con `callableCorsOrigins`; debe incluir el dominio que sirve la app (`www.grupovivaru.com`) o el `POST` se bloquea por CORS. Ver [[trampas-conocidas]] y [[firebase-firestore]].

## Relaciones

- Véase también: [[middleware-ts]], [[multi-tenancy]], [[firebase-firestore]], [[correos-mensajeria]]
- Depende de: [[domain-types]], [[stack-tecnico]]
- Se conecta con: [[usuarios]], [[portal-residente]], [[portal-guardia]], [[estructura-app-router]], [[trampas-conocidas]]

## Fuentes

- [[middleware-ts]], [[domain-types]]
