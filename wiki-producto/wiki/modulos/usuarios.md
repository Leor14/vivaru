---
tags: [modulo, admin, usuarios, roles]
tipo: concepto
fuentes: ["domain.ts", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Usuarios

Módulo de gestión de usuarios del portal administrador (`/admin/users`). Permite al administrador crear, editar y desactivar usuarios del tenant: otros administradores, residentes y operativos.

## Entidades principales

El tipo `SessionUser` en [[domain-types]] define el usuario. Campos relevantes para este módulo:
- `fullName`, `email`, `role`: identidad y rol
- `unitId?`, `unitLabel?`: unidad asignada (para residentes)
- `documentNumber?`: cédula o NIT
- `status`: active | inactive
- `mustChangePassword?`, `temporaryPassword?`, `passwordStatus?`: estado de la contraseña temporal

## Flujo de onboarding de residente

1. Administrador crea el usuario residente con unidad asignada
2. La Cloud Function `provisionResidentTemporaryAccess` genera una contraseña temporal
3. El residente recibe sus credenciales (via email transaccional — ítem A6 del [[gtm-tecnico]])
4. Al primer login, `mustChangePassword=true` activa la redirección del [[middleware-ts]] a `/resident/change-password-required`
5. El residente cambia su contraseña → `mustChangePassword=false`

## Estado: ✅ card mobile + skeleton

Los fixes aplican la tarjeta mobile compacta (con avatar y estado visible en 56px) y el skeleton de carga para listas largas. El skeleton sigue el patrón de [[componentes|Skeleton animated pulse]].

## Roles que puede crear el admin

El administrador puede crear usuarios con roles `admin` (adicionales), `resident` y operativos. No puede crear `superadmin` — ese rol solo lo gestiona el equipo Vivaru desde [[superadmin]].

## Permisos y RBAC

El acceso a este módulo está restringido al rol `admin`. El [[middleware-ts]] y las [[firebase-firestore|reglas Firestore]] enforzan que un residente no pueda acceder a `/admin/users`. Ver [[autenticacion-roles]].

## Relaciones

- Véase también: [[domain-types]], [[autenticacion-roles]], [[middleware-ts]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[portal-residente]], [[superadmin]], [[componentes]], [[gtm-tecnico]]

## Fuentes

- [[domain-types]], [[backlog-md]]
