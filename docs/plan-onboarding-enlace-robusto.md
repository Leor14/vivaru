# Análisis y plan — Enlace de onboarding "expirado o ya usado"

## Qué pasó (diagnóstico)

El correo de alta de usuario operativo (guardia/admin) envía un **enlace de
restablecimiento de contraseña de Firebase**:

```ts
// functions/src/index.ts:215
const link = await getAuth().generatePasswordResetLink(email);
```

Dos problemas en ese enlace:

1. **No lleva `actionCodeSettings` con URL branded** → abre la **página de acción por
   defecto de Firebase (en inglés)**. Es el pendiente conocido (CLAUDE.md): fijar la *action
   URL* en Firebase Console → `https://www.grupovivaru.com/restablecer` (cuenta Owner).
2. El enlace lleva un **código de un solo uso** (`oobCode`) que **expira en 1 hora**.

El mensaje **"expired or already been used"** tiene **dos causas** y Firebase **no distingue**:

- **Ya usado (causa #1 en correos de staff/guardia):** un **escáner de enlaces del proveedor
  de correo o antivirus** (Outlook Safe Links, proxies corporativos, ESET, etc.) **abre el
  enlace antes que el usuario** para "verificarlo" y **consume el código de un solo uso**.
  Cuando el guardia hace clic, ya está usado.
- **Expirado:** pasó más de **1 hora** entre el envío y el clic.

## Validación: ¿cuánto dura el enlace?

- **1 hora**, fijo. La expiración de los códigos de **reset de contraseña** de Firebase
  **no es configurable** (no hay setting en Console para extenderla). Por eso no se puede
  "alargar" el enlace actual: hay que **cambiar el mecanismo**.

## Opciones para modificar el flujo

### Opción A — Parche rápido (NO resuelve la raíz)
- Fijar la **action URL branded** (Owner) → al menos la pantalla sale en español/branded.
- Botón **"Reenviar acceso"** en el admin + nota en el correo ("dura 1 h, un solo uso, ábrelo
  directamente"). El usuario siempre puede usar **"¿Olvidaste tu contraseña?"**.
- ❌ No evita el **escáner que consume el enlace** ni el **límite de 1 hora**.

### Opción B — Invitación con token propio (RECOMENDADA) ✅
No depende de los `oobCode` de Firebase. Alineada con la dirección "onboarding por enlace".
- Al crear el usuario, generar un **token de invitación** propio (UUID) en Firestore
  (`accountInvites`): `{ uid, email, tenantId, role, expiresAt, usedAt }`, **TTL configurable
  (p. ej. 7 días)**, **un solo uso**.
- El correo enlaza a **`/activar?token=…`** en nuestro dominio (branded, español).
- La página (**GET**) muestra el formulario "crea tu contraseña" — **el GET no consume el
  token**, así que el **escáner que solo hace GET no lo invalida**.
- Al **enviar** (callable `activateAccount`), validar token (existe, no usado, no expirado),
  setear la contraseña con Admin SDK (`updateUser`), marcar `usedAt`, y dejar la sesión lista.
- Respaldo: "¿Olvidaste tu contraseña?" nativo sigue disponible.
- ✅ Resuelve: prefetch de escáner (GET-safe), expiración corta (TTL propio de 7 días),
  branding (nuestra página), y queda auditable.

### Opción C — Contraseña temporal por correo (alternativa rápida)
Reusar la infra existente (`generateStrongPassword`, `mustChangePassword`): el guardia recibe
una **clave temporal** y la cambia en el primer login.
- ✅ Sin enlace de un solo uso → inmune a escáner y sin límite de 1 h.
- ❌ Va **contra la dirección de seguridad** del proyecto (mover credenciales fuera del correo);
  una clave en texto en el inbox es un riesgo. Solo si se quiere lo más rápido posible.

## Recomendación

**Opción B** (token propio, GET-safe, TTL 7 días, branded). Es la que de verdad evita el
problema reportado y es coherente con el enfoque de onboarding por enlace.
En **paralelo**, hacer ya la **Opción A** mínima: que el Owner fije la action URL branded
(beneficia también al "¿Olvidaste tu contraseña?").

## Plan de ejecución (Opción B)

- **O1 — Backend del token.** Colección `accountInvites` + reglas (solo functions escriben/leen).
  Al crear usuario operativo, crear invite y enlazar `/activar?token=…` en el correo (variante
  welcome). TTL en una constante (`INVITE_TTL_DAYS = 7`).
- **O2 — Callables.** `getAccountInvite(token)` (valida sin consumir, para pintar la página) y
  `activateAccount({ token, password })` (consume + setea clave + marca usado). Política de
  contraseña reutilizando `assertStrongPassword`.
- **O3 — Página `/activar`.** Formulario branded (crear contraseña + confirmar), estados:
  token inválido/expirado/usado (con CTA "pedir nuevo acceso" → reenvío), éxito → ir a login.
- **O4 — Reenviar acceso.** Botón en el admin (gestión de usuarios) que regenera el invite y
  reenvía el correo. Invalida el invite anterior.
- **O5 — Limpieza.** Cron opcional que borra invites usados/expirados.
- Mantener `generatePasswordResetLink` solo para el reset nativo ("¿Olvidaste tu contraseña?").

## Decisiones a confirmar

1. ¿Vamos con **Opción B** (recomendada), o prefieres la **C** (clave temporal) por rapidez?
2. **TTL del token**: ¿7 días te parece bien?
3. ¿Coordinas con el Owner la **action URL branded** en paralelo? (mejora el reset nativo).
