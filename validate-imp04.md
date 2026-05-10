# IMP-04 — Manual Validation Checklist

Objetivo: verificar en browser que ningún mensaje de error visible al usuario
contiene texto interno de Firebase, Firestore, o rutas de colección.

---

## Preparación

- [ ] Abre DevTools → Console → Network
- [ ] Abre DevTools → Application → Storage → borra caché local si aplica
- [ ] Ten a mano un usuario residente, uno admin y uno guard con credenciales válidas

---

## 1. Error de permisos Firestore

**Setup:** en Firestore Console → Rules, restringe temporalmente una colección
(o usa un usuario sin permisos sobre ella). Alternativamente, revoca el
`tenantId` del usuario en la DB para forzar `permission-denied`.

**Pasos:**
1. Login como residente
2. Navega a cualquier sección que cargue datos (PQRS, Reservas, Visitantes)
3. Observa el toast que aparece

**Pasa si:**
- [ ] Toast muestra `"No tienes permiso para realizar esta acción."` (o mensaje
      amigable equivalente)
- [ ] Toast **NO** muestra `"Missing or insufficient permissions"`
- [ ] Toast **NO** contiene las palabras `Firebase`, `Firestore`, `permission`
- [ ] Console muestra el error completo (para debugging), pero NO el toast

---

## 2. Residente → PQRS → crear ticket → forzar error

**Pasos:**
1. Login como residente
2. Navega a PQRS (`/resident/pqrs`)
3. Desconecta red (DevTools → Network → Offline) o revoca permisos Firestore
4. Escribe un texto y pulsa el botón de crear ticket

**Pasa si:**
- [ ] Aparece toast con mensaje amigable (ej: `"El servicio no está disponible."`)
- [ ] **NO** aparece `"Missing or insufficient permissions"` en ningún toast
- [ ] **NO** aparece ningún stack trace en pantalla
- [ ] Reconecta red → la operación puede reintentarse

---

## 3. Residente → Reservas → cancelar → forzar error

**Pasos:**
1. Login como residente
2. Navega a Reservas (`/resident/reservations`)
3. Intenta cancelar una reserva mientras la red está en modo Offline

**Pasa si:**
- [ ] Toast amigable visible (ej: `"El servicio no está disponible."`)
- [ ] **NO** aparece contenido técnico en el toast ni en la UI

---

## 4. Admin → Comunicados → crear/editar → forzar error

**Pasos:**
1. Login como admin
2. Navega a Comunicados (`/admin/communications`)
3. Pon la red en Offline y trata de guardar un comunicado nuevo o editar uno existente

**Pasa si:**
- [ ] Toast amigable visible
- [ ] El inline `errorMessage` del formulario muestra el fallback, **no** el error.message
      de Firebase (note: este campo muestra string de fallback cuando `error instanceof
      Error` es false, o el message cuando es un Error JS genérico — comportamiento
      aceptable si no es un mensaje de Firebase internals)
- [ ] **NO** aparece `"Firebase"` ni rutas de colección en el toast

---

## 5. Ruta inexistente → error.tsx muestra UI amigable

**Pasos:**
1. (Cualquier sesión o sin sesión)
2. Navega a `/resident/ruta-que-no-existe` u otra URL inexistente dentro del app

**Pasa si:**
- [ ] La página muestra el boundary de error con texto tipo `"Algo salió mal"`
- [ ] Hay un botón `"Intentar de nuevo"` visible
- [ ] **NO** hay stack trace ni mensaje técnico visible en pantalla
- [ ] Al hacer click en `"Intentar de nuevo"` se ejecuta `reset()` (recarga la ruta)

---

## 6. Inspección DevTools: ningún mensaje de error visible contiene internals

**Pasos:**
1. Realiza cualquier operación que lance error (offline, sin permisos, etc.)
2. Abre DevTools → Console
3. Busca (Ctrl+F) los términos siguientes en los toasts y en la UI visible:

**Términos prohibidos en mensajes al usuario:**
- [ ] `Firebase`
- [ ] `Firestore`
- [ ] `permission-denied`
- [ ] `Missing or insufficient permissions`
- [ ] `/tenants/` (o cualquier ruta de colección Firestore)
- [ ] Stack traces (`at Object.` / `at async`)

**Términos permitidos SOLO en Console (no en UI):**
- Los errores completos deben aparecer en `console.error` para debugging en dev
- En producción (`NODE_ENV=production`) el log está suprimido en callables.ts

---

## Post-validación

- [ ] Restaurar Firestore Rules a estado original
- [ ] Verificar que las operaciones normales (sin error) siguen funcionando
- [ ] Correr suite de tests: `npm test` → todos deben pasar (≥ 186 tests)
