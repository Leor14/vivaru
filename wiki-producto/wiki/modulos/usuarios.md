---
tags: [modulo, admin, usuarios, roles]
tipo: concepto
fuentes: ["domain.ts", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-08-30
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

## Revisar duplicados del padrón (30 ago 2026)

Desde `ONB-002`, el administrador ve en `/admin/residents` **qué registros de personas parecen la
misma y por qué regla** —mismo documento, mismo correo o mismo nombre normalizado—, y puede
**fusionarlos eligiendo cuál sobrevive**, corregir el dato, o marcar que **no** son la misma
persona con un motivo escrito. Bandera `producto-padron-sin-duplicados`.

**El problema no era el alta: era que nadie miraba hacia atrás.** La carga masiva y el alta manual
ya descartaban duplicados; los 13 de producción entraron por semillas, migraciones y altas
anteriores a esa corrección. **Blindar la puerta no limpia la casa.**

Tres cosas que conviene saber antes de tocarlo:

- **Se agrupa por COINCIDENCIA, no por cierre transitivo.** Encadenar los grupos que comparten a
  alguien parece más limpio y es peligroso: en producción, dos personas de **nombres distintos**
  comparten número de documento, así que la transitividad las mete en una sola propuesta de fusión.
  **Un duplicado se ve; una fusión mala, no.**
- **Fusionar repunta todo lo que apuntaba al archivado, y el inventario de esas referencias
  se derivó de los DATOS, no de los nombres de campo** — ver [[trampas-conocidas]]. Lo que sostiene
  el invariante no es la lista: es un **barrido que aborta antes de escribir** si aparece una
  referencia que no conoce, en vez de dejar huérfanos como hizo `mergeUnits`.
- **Las personas se archivan, no se borran**, y cada fusión deja un `snapshot` de lo pisado en
  `personMergeDecisions`. **Sin snapshot no hay fusión**: sin él, «fusionar» es «borrar con un
  nombre amable». El descarte **caduca** si entra un registro nuevo al grupo, para que la pantalla
  no se vuelva el sitio donde los problemas se esconden.

Detrás hay dos callables, `mergePeople` y `dismissDuplicatePeopleGroup`: escriben en varias
colecciones y **una regla de Firestore no protege lo que escribe una callable** — ver
[[firebase-firestore]]. La detección, en cambio, es lectura pura y vive en el navegador.

## Estado: ✅ card mobile + skeleton

Los fixes aplican la tarjeta mobile compacta (con avatar y estado visible en 56px) y el skeleton de carga para listas largas. El skeleton sigue el patrón de [[componentes|Skeleton animated pulse]].

## Roles que puede crear el admin

El administrador puede crear usuarios con roles `admin` (adicionales), `resident` y operativos. No puede crear `superadmin` — ese rol solo lo gestiona el equipo Vivaru desde [[superadmin]].

## Permisos y RBAC

El acceso a este módulo está restringido al rol `admin`. El [[middleware-ts]] y las [[firebase-firestore|reglas Firestore]] enforzan que un residente no pueda acceder a `/admin/users`. Ver [[autenticacion-roles]].

## Relaciones

- Véase también: [[domain-types]], [[autenticacion-roles]], [[middleware-ts]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[portal-residente]], [[superadmin]], [[componentes]], [[gtm-tecnico]], [[correos-mensajeria]]

## Fuentes

- [[domain-types]], [[backlog-md]]
