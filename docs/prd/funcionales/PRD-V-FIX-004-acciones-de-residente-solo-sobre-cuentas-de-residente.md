# PRD-V-FIX-004 — Las acciones de residente solo tocan cuentas de residente

| | |
|---|---|
| **ID** | `PRD-V-FIX-004` (tentativo hasta registrarlo en `docs/prd/README.md`) |
| **Tipo** | `FIX` — corrección estructural: dos acciones del administrador sobre la ficha de un residente actúan sobre **cualquier cuenta**, sin mirar de quién es |
| **Portales** | **`ADMIN`** (alcance: Residentes) · `SUPERADMIN` y `PORTERIA` (afectados: sus cuentas quedan protegidas) · `RESIDENTE` (sin cambios) |
| **Módulo** | Residentes · Identidad y acceso |
| **Usuario principal** | `tenant_admin` — es quien da y quita el acceso de los residentes |
| **Usuarios secundarios** | `superadmin` · el `tenant_admin` y la portería **de otros conjuntos**, cuyas cuentas hoy puede pisar o borrar un admin ajeno |
| **Responsable** | David |
| **Estado** | 🟡 **CONSTRUIDA, SIN DESPLEGAR** (11 sep 2026, rama `trabajo/admins-multiconjunto`). Los tres caminos: `cuentaReutilizableParaResidente` (`D-A`), el caso `sin-membresia` de la revocación (`D-B`) y `authUid` cerrado al cliente en `people`, más el motivo real en el alta de unidad, en el alta de persona y en el envío en bloque. **`CF5` y `CF6` se vieron en ROJO contra el código de antes**: la ficha que apuntaba al superadmin producía cuatro escrituras —sesiones, claim, `users` y la cuenta—. Falsación: cuatro mutaciones, cada una enrojece exactamente las suyas. Correrlas en rojo cazó además **un guardián ciego**: «la guarda va antes» pasaba sin guarda, porque `indexOf` da −1. Bancos: app **2003**, functions **906**, reglas **475** (`storage.rules` aparte, sin emulador). Encontrado **de paso**, midiendo para `PLAT-002` entrega 2; **va primero y aparte**, después de la ventana de producción de las 18:00 |
| **Dependencias** | Ninguna. **Precede** a `PLAT-002` §16, que da al superadmin —y solo a él— la potestad de cambiar el rol de una cuenta |
| **Riesgo** | **Bajo en ejecución, alto en consecuencia.** Solo rechaza casos que hoy **no ocurren** (radio medido: **0** en los dos ambientes). Lo que protege es la cuenta del superadmin y las de otros conjuntos |
| **Reversibilidad** | **Total.** Dos functions y una regla. La regla es **restrictiva** y va la última; se revierte redesplegando el ruleset anterior |
| **Fase comercial** | Todos los planes |

---

## 1. Resumen ejecutivo

Dar acceso a un residente **reutiliza cualquier cuenta que ya tenga ese correo**: le cambia la clave y la convierte en residente del conjunto, aunque sea la de un administrador de otro conjunto o la del superadmin. Quitar el acceso **borra la cuenta a la que apunte la ficha**, y ese puntero lo puede escribir el propio administrador: si apunta al superadmin, que no tiene membresías, se borra su cuenta. Esta ficha fija que **las acciones de residente solo actúan sobre cuentas de residente y sobre la membresía de residente de ese conjunto**, y que el puntero lo escribe solo el servidor. No hay clientes en producción y ningún dato está afectado, así que el momento es el más barato posible.

## 2. Problema y baseline

### 2.1 `D-A` · «Enviar acceso» pisa cuentas que no son de residente

`upsertResidentTemporaryAccess` (`functions/src/index.ts:826`) busca la cuenta por el correo de la ficha (`:883`) y, **si existe, la reutiliza sin mirar su rol** (`:903-909`):

- le pone una clave aleatoria nueva —nadie la ve, así que **no hay robo de cuenta**— y le manda al dueño del correo el enlace de restablecimiento;
- le reescribe el claim a `{ role: "resident", tenantId }` (`:918-921`);
- le reescribe `users.role` y `users.tenantId` (`:926-946`, `merge`).

**Consecuencia.** Un `tenant_admin` de otro conjunto deja de ver su panel —`assertActiveTenantAdmin` exige `users.role === "tenant_admin"` y la sesión solo carga membresías de admin con ese rol— y **el superadmin pierde la consola**, porque la regla `superadmin()` lee el claim. Se recupera a mano, con script.

**Se dispara solo, sin querer.** La callable `provisionResidentTemporaryAccess` (`:2532`) la llama cualquier admin del conjunto (`:2546`) desde cuatro sitios de `src/app/(admin)/admin/residents/page.tsx`, y **uno es automático**: dar de alta una unidad con su titular configura el acceso en el mismo paso (`:760`). El caso realista no es un ataque: es **un administrador que se registra como propietario en un edificio que administra**, con su correo de siempre.

**Lo que ya lo frena, y no basta:** en un conjunto de prueba no se invita a nadie real (`assertCanInviteRealPeople`, `:2552`), y la puerta de buzones de `PLAT-006` (`:2558`). Ninguna de las dos mira **de quién es la cuenta**.

### 2.2 `D-B` · «Quitar acceso» borra la cuenta a la que apunte la ficha

`revocarAccesoDeResidente` (`functions/src/resident-access.ts:109`) toma la cuenta de `people.authUid` (`:129`) y decide con `planearRevocacion` (`:60`):

- si la membresía **de este conjunto** es de admin o portería, rechaza (`:73`) — **pero esa guarda solo funciona si la membresía existe**;
- si no existe, mira las de otros conjuntos: con alguna, **reapunta el claim y le revoca las sesiones** (`:170-175`); sin ninguna, **«revocar-y-borrar»** (`:91`): borra el claim, `users/{uid}` y la cuenta de Auth (`:178-180`).

Y **`authUid` lo puede escribir el administrador a mano**: la regla de `people` (`firestore.rules:423-428`) solo mira el conjunto operable, el rol y el correo. **El front nunca lo escribe** —solo lo lee—, así que la puerta está abierta sin que ningún uso legítimo la necesite.

**La cuenta sin ninguna membresía es la del superadmin.** Un admin de cualquier conjunto que conozca su uid puede escribirlo en una ficha suya y pulsar «Quitar acceso»: la plataforma se queda sin superadmin. Con cualquier otro uid conocido, lo que consigue es **cerrarle la sesión** a esa persona.

### 2.3 Baseline medido — 11 de septiembre de 2026, solo lectura

| Medida | `hogaru-1` | `vivaru-staging-02` |
|---|---|---|
| Fichas `people` con `authUid` | 10 | 14 |
| …que apuntan a una cuenta **sin membresía de residente en su conjunto** | **0** | **0** |
| Fichas con el correo de una cuenta **que no es de residente** | **0** | **0** |
| Superadmins | 1 (`superadmin@hogaru.co`) | 1 |
| Dónde se ve su uid para un miembro de conjunto | `tenants.createdBy` de **3 conjuntos** | ninguno |

**Nada está afectado hoy.** El registro de auditoría solo lo lee el superadmin (`firestore.rules:1402-1405`).

**Exposición.** El alta de prueba (`createTrialWorkspace`, `index.ts:4591`) es **pública y sin sesión**: cualquiera puede ser admin de un conjunto de prueba en producción. `D-A` no se alcanza desde ahí, porque en prueba no se da acceso a residentes; **`D-B` sí**, porque `revokeResidentAccess` (`:2160`) solo exige ser admin activo. Lo que falta para explotarlo desde fuera es el uid del superadmin, que un admin de prueba **no puede leer** en ninguno de los tres documentos donde está. **No es explotable hoy sin otra fuga; el camino existe y el daño sería total.**

### 2.4 Los gemelos, revisados

Se buscó toda escritura de cuentas en `functions/src` (`createUser`, `updateUser`, `deleteUser`, `getUserByEmail`) y toda escritura de `role: "resident"`:

| Sitio | Veredicto |
|---|---|
| `createTenantAdmin`, `createTenantOperationalUser`, `createTrialWorkspace` | **Rechazan** un correo que ya existe. Bien |
| `seedDemoData` (`index.ts:2696`) | Resetea cuentas fijas a una clave conocida, **incluida `superadmin@hogaru.co`**, pero exige superadmin (`:2697`) **y** estar en el emulador o tener `ALLOW_DEMO_SEED` (`:2701`), que no está definida en ningún fichero de configuración. Bien |
| `setCommitteeMembership` (`PLAT-004`) | También toma el uid de `person.authUid`, pero solo escribe una membresía **de este conjunto** que ya exista (`CA11` de `PLAT-004`). Al cerrar `authUid` al cliente queda cubierto de raíz |
| `upsertResidentTemporaryAccess` y `revocarAccesoDeResidente` | **Los dos defectos de esta ficha** |

## 3. Usuarios, roles y permisos

| Rol | Puede | **NO puede** |
|---|---|---|
| `tenant_admin` | Dar y quitar acceso a los residentes **de su conjunto**, como hoy | Cambiar la clave, el rol o el conjunto de **una cuenta que no es de residente**. Borrar o cerrar la sesión de **una cuenta sin membresía de residente en su conjunto**. Escribir `authUid` en una ficha |
| `superadmin` | Todo lo de hoy. Cambiar el rol de una cuenta llega con `PLAT-002` §16, **con aviso** | — |
| `resident` | Sin cambios | — |
| `security_guard` | Sin cambios | Ser convertido en residente desde Residentes |

## 4. Objetivo, alcance y exclusiones

**Objetivo.** Que una acción sobre la ficha de un residente **no pueda tocar ninguna cuenta más que la de ese residente en ese conjunto**.

### Entra

1. `D-A`: rechazar «Enviar acceso» cuando la cuenta del correo **existe y no es de residente**, antes de escribir nada y sin enviar correo.
2. `D-B`: la revocación solo actúa sobre una cuenta con **membresía de residente en este conjunto**; sin ella, **no toca la cuenta**.
3. `people.authUid` deja de ser escribible desde el cliente.
4. El motivo real del rechazo llega a la pantalla, **también en el alta automática** de la unidad y en el envío en bloque.

### No entra, y por qué

| Excluido | Por qué |
|---|---|
| Que un admin pueda ser **además** residente con la misma cuenta | La cuenta tiene un solo rol (`users.role`). Decidido el 11 sep: el paso de residente a admin lo da **solo el superadmin, con aviso** (`PLAT-002` §16). Al revés, **otro correo** |
| El residente con unidades en dos conjuntos | Excluido por `PLAT-002` §4. Hoy se reutiliza su cuenta de residente y **eso no cambia** |
| Revisar el resto de acciones sobre cuentas desde `/admin/users` | Van con `PLAT-002` §16, porque solo se vuelven peligrosas cuando una cuenta tiene varios conjuntos |

## 5. Flujo funcional

**Enviar acceso** (fila, bloque o alta de unidad):

1. Si el correo **no tiene cuenta** → se crea, como hoy.
2. Si tiene cuenta **de residente** → se reutiliza, como hoy.
3. Si tiene cuenta **de otro rol** (administración, portería o superadmin, mirando `users.role` **y** el claim) → **se rechaza** con este texto, y no se escribe nada ni sale correo:

   > «Ese correo ya tiene una cuenta de administración o portería en Vivaru, y una cuenta no puede ser además residente. Registra al residente con otro correo.»

   **El texto no dice qué conjunto ni qué rol exacto**: el admin que lo lee no tiene por qué saber dónde administra otra persona.
4. Una cuenta de Auth **sin rol** en ningún lado (huérfana) se reutiliza, como hoy: es la única forma de recuperarla.

**En el alta de unidad**, la unidad y el titular se crean igual; el aviso deja de ser genérico («No se pudo configurar el acceso automáticamente») y **dice el motivo**. **En el envío en bloque**, los demás salen y el rechazado se nombra con su motivo.

**Quitar acceso:**

1. Membresía de residente **en este conjunto** → como hoy: se conserva la cuenta si le quedan otros conjuntos y se borra si era la última.
2. Membresía de admin o portería en este conjunto → **rechazo de hoy**, sin cambios.
3. **Sin membresía en este conjunto** → **la cuenta no se toca** —ni borrado, ni claim, ni sesiones— y la ficha sigue su camino. Resultado `sin-membresia`, con el motivo «la ficha apuntaba a una cuenta que no es residente de este conjunto; la cuenta no se tocó».

## 6. Estados y transiciones

Sin estados nuevos. La única transición que esta ficha **prohíbe** es la que hoy ocurre sin permiso: *cuenta de otro rol → residente* desde un conjunto. La inversa, *residente → admin*, queda **solo en manos del superadmin** (`PLAT-002` §16).

## 7. Contrato de datos y multi-tenancy

- **Sin campos ni colecciones nuevas.**
- **`people.authUid`: lo escribe solo el servidor** —`upsertResidentTemporaryAccess` al dar acceso—. La regla deniega crearlo desde el cliente y cambiarlo al actualizar. Radio de la restricción: **0 escritores en el front** (`grep` sobre `src/`: solo lecturas), y la importación masiva no lo lleva.
- **Conjunto suspendido o vencido:** sin cambios; `people` ya exige `tenantOperable`.
- **Conjunto en prueba:** dar acceso sigue bloqueado por la regla B; **quitar acceso queda cubierto por `D-B`**, que es justo el camino abierto desde una prueba.

## 8. Reglas de negocio

| # | Regla |
|---|---|
| **R1** | Una acción de residente **solo reutiliza una cuenta de residente**. Una cuenta con rol de administración, portería o superadmin, en `users.role` **o** en el claim, **se rechaza antes de escribir** |
| **R2** | Quitar acceso **solo actúa sobre la membresía de residente de este conjunto**. Sin ella, la cuenta no se toca |
| **R3** | `people.authUid` **solo lo escribe el servidor** |
| **R4** | **Ninguna acción de conjunto toca la cuenta del superadmin.** Se sigue de R1–R3 y lleva criterio propio, porque es el caso que más cuesta |
| **R5** | El rechazo **no revela** el conjunto ni el rol exacto de la otra cuenta |

## 9. Notificaciones y correo

Sin correo nuevo. **Un rechazo no envía nada**: hoy el dueño de la cuenta pisada recibía un restablecimiento que no había pedido.

## 10. Criterios de aceptación

### Deben pasar

| # | Criterio |
|---|---|
| CA1 | Enviar acceso a una ficha cuyo correo **no tiene cuenta** → se crea la cuenta de residente y sale la bienvenida, como hoy |
| CA2 | Reenviar acceso a un residente **de este conjunto** que ya tiene cuenta → restablecimiento, como hoy |
| CA3 | Enviar acceso con el correo de un **residente de otro conjunto** → se reutiliza, como hoy (`PLAT-002` §4) |
| CA4 | Quitar acceso a un residente con membresía aquí y **sin otros conjuntos** → la cuenta se borra, como hoy |
| CA5 | Quitar acceso a un residente con membresía aquí **y en otro conjunto** → se conserva y se reapunta, como hoy |
| CA6 | Alta de unidad cuyo titular tiene el correo de un admin → **unidad y titular creados**, y el aviso **dice el motivo real** |
| CA7 | «Enviar acceso a N» con uno rechazado → salen los demás y el rechazado aparece **con su motivo** |

### Deben fallar

| # | Criterio |
|---|---|
| CF1 | Enviar acceso con el correo de un **`tenant_admin` de otro conjunto** → rechazado; esa cuenta **conserva** rol, conjunto, claim y clave, y **no sale correo** |
| CF2 | Enviar acceso con el correo del **superadmin** → rechazado; su claim `superadmin` **intacto** |
| CF3 | Enviar acceso con el correo de una cuenta de **portería** → rechazado |
| CF4 | Escribir `authUid` en una ficha desde el cliente, al crear **o** al actualizar → **denegado por reglas** |
| CF5 | Quitar acceso a una ficha cuyo `authUid` apunta a una cuenta **sin membresía en este conjunto** (sembrada con Admin SDK, porque CF4 ya no deja hacerlo desde el cliente) → la cuenta **no se borra, no cambia su claim y no pierde sus sesiones** |
| CF6 | CF5 con el uid **del superadmin** → la cuenta del superadmin **sigue existiendo y siendo superadmin** |
| CF7 | Quitar acceso a una ficha cuyo `authUid` es un **admin de este conjunto** → rechazado, como hoy |
| CF8 | El mensaje de CF1 **no contiene** el nombre del otro conjunto, la palabra «superadmin» ni el rol exacto |

**CF5 y CF6 son los que prueban el arreglo de `D-B`**, y **deben verse en rojo contra el código de hoy** antes de escribir la corrección.

## 11. Arquitectura y dependencias

**Cliente o callable: callable, como ya es.** Crear, cambiar y borrar cuentas son operaciones del Admin SDK, y el invariante no puede vivir en el cliente. **La regla de `people` cierra la puerta del cliente; no sostiene el invariante** —R1 y R2 viven en el servidor, porque el Admin SDK no evalúa reglas—.

- **`upsertResidentTemporaryAccess`:** antes de `updateUser`, leer el rol efectivo de la cuenta —`users/{uid}.role` y el claim— y rechazar con `failed-precondition` si alguno no es de residente.
- **`planearRevocacion`:** añadir el caso `sin-membresia` cuando `rolEnEsteConjunto` falta. Es la parte que ya se prueba sin emulador, y es donde vive la decisión.
- **`firestore.rules`, `people`:** en `create`, `!('authUid' in request.resource.data)`; en `update`, `authUid` fuera de `diff().affectedKeys()`.
- **Front:** que el aviso del alta de unidad (`residents/page.tsx:770`) y el resultado del envío en bloque muestren el mensaje del servidor. `normalizeCallableError` ya lo entrega intacto.
- **Sin índices, jobs ni banderas.** Una bandera no protegería nada: el servidor tiene que rechazar siempre.

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación | Señal |
|---|---|---|
| Rechazar a un admin que **de verdad** es residente de su edificio | El mensaje le dice qué hacer (otro correo), y `PLAT-002` §16 cubre el paso a admin | Rechazos con el motivo de R1 en `logClientError` |
| La regla restrictiva deniega a un escritor legítimo de `authUid` | Radio medido: **0** en el front y en la importación | Denegaciones de `people` tras desplegar |
| Una cuenta huérfana con rol solo en el claim | R1 mira **los dos**: `users.role` y el claim | CF2 y CF3 |

## 13. Despliegue, rollback y validación

**Orden:** functions (`provisionResidentTemporaryAccess`, `revokeResidentAccess`) → front (el motivo en pantalla) → **reglas, las últimas**, porque restringen.

**Validación.**

- **Emulador:** CF1–CF7 **en rojo contra el código de hoy**, luego en verde, con falsación de cada guarda.
- **Staging:** antes y después con **una cuenta desechable**, creada para la prueba **con permiso de David**. **Nunca** con una cuenta de uso: el «antes» es destructivo.
- **Producción:** `updateTime` de las dos functions y diferencia del ruleset contra el repo. **Sin datos de prueba** salvo permiso expreso.

**Rollback:** redesplegar las dos functions del commit anterior y el ruleset anterior. Nada que migrar.

## 14. Puertas

| Puerta | Estado |
|---|---|
| **G0 Necesidad** | ✅ Los dos caminos, leídos en el código; el daño es total (`D-B`) o bloqueante (`D-A`) |
| **G1 Valor** | ✅ Baseline **0** en los dos ambientes. Métrica: **cero cuentas que no son de residente tocadas** por una acción de residente |
| **G2 Datos y permisos** | ✅ Sin datos nuevos; un campo pasa a ser solo de servidor |
| **G3 Riesgo** | ✅ Reversible entero; la regla restrictiva va la última y con radio 0 |
| **G4 Aceptación** | ✅ 7 que pasan y 8 que deben fallar; CF5 y CF6 en rojo antes del arreglo |
| **G5 Operación** | ✅ Nadie opera esto: el mensaje le dice al admin qué hacer |
| **G6 Escala** | ✅ Una lectura más por envío de acceso |
