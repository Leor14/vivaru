# HOGARU

Plataforma SaaS multi-tenant para propiedad horizontal en Colombia (estratos 4, 5 y 6), construida con Next.js App Router + TypeScript + Firebase.

## Estado actual
MVP navegable y comercializable con 4 capas:
- Superadmin HOGARU
- Administracion de edificio (tenant admin)
- Residente
- Guarda de seguridad

Incluye base de modulos priorizados:
- Autenticacion y sesiones
- Multi-tenant base
- Consolas por rol
- Comunicaciones
- Estado de cuenta basico
- Reservas
- Visitantes
- Paqueteria
- PQRS
- Repositorio documental
- Dashboards iniciales
- Rules + Functions + seeds iniciales

## Stack
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn-style reusable components (base en `src/components/ui`)
- React Hook Form + Zod
- Firebase: Auth, Firestore, Functions, Storage, FCM, App Check
- ESLint + Prettier

## Arquitectura
### Frontend
- Rutas por rol en route groups:
  - `src/app/(superadmin)/superadmin`
  - `src/app/(admin)/admin`
  - `src/app/(resident)/resident`
  - `src/app/(auth)`
- Login universal: `src/app/(auth)/login/page.tsx`.
- `AppShell` reusable para layout, guard visual y navegacion por rol.
- Sistema de diseno mobile-first en `src/app/globals.css` con tokens.

### Routing y acceso
- Rutas publicas:
  - `/`
  - `/login`
  - `/forgot-password`
  - `/setup-error`
  - `/unauthorized`
- Rutas privadas:
  - `/superadmin/*`
  - `/admin/*`
  - `/resident/*`
- Guardas en `middleware.ts` + `src/lib/auth/routing.ts`.

### Seguridad y acceso
- RBAC central en `src/lib/constants/roles.ts` y `src/lib/rbac/guards.ts`.
- Rol `security` con navegacion y permisos limitados a:
  - `/admin/visitors`
  - `/admin/reservations`
  - `/admin/packages`
- Estrategia multi-tenant: cada documento de negocio usa `tenantId`.
- Rules Firestore y Storage incluidas.
- Operaciones sensibles centralizadas en Cloud Functions callable:
  - `createTenant`
  - `seedDemoData`

### Datos
Modelo base preparado para colecciones:
- tenants
- users
- tenantUsers
- units
- residents
- owners
- adminUsers
- communications
- communicationReads
- documents
- assemblies
- charges
- payments
- reservations
- amenities
- visitorPasses
- packages
- tickets
- auditLogs
- plans
- featureFlags
- featureFlagOverrides
- aiUsage

## Proyecto Firebase
Proyecto existente configurado:
- `hogaru-1`

## Firebase App Hosting (produccion)
Este proyecto usa `apphosting.yaml` como fuente de variables de entorno para el frontend desplegado.

Variables requeridas en App Hosting:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

Importante para Next.js App Router en App Hosting:
- Estas variables deben estar disponibles en `BUILD` y `RUNTIME`.
- Si faltan en `BUILD`, el bundle cliente se compila sin ellas y puede redirigir a `/setup-error`.
- Si faltan en `RUNTIME`, servicios server-side y validaciones pueden fallar segun el flujo.

En `apphosting.yaml` cada variable debe declarar:
```yaml
availability:
  - BUILD
  - RUNTIME
```

Archivos clave:
- `.firebaserc`
- `firebase.json`
- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`
- `functions/`

## Estrategia de despliegue frontend implementada
Se implemento pipeline CI/CD en `.github/workflows/frontend-apphosting.yml`:

1. Quality gate obligatorio:
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

2. Preview por Pull Request:
- Publica canal temporal por PR con expiracion de 7 dias.
- Permite validacion funcional/visual antes de merge.

3. Produccion en main:
- Despliegue automatico a App Hosting con `firebase deploy --only apphosting`.

4. Build reproducible y performance:
- `npm ci` para dependencias deterministicas.
- Caching de assets estaticos e imagenes en `next.config.ts`.
- Compresion habilitada y formatos de imagen optimizados (`avif/webp`).

## Politica de snapshots visuales (Playwright)
- Los archivos en `tests/visual/mobile-responsive.spec.ts-snapshots/` son baseline de regresion visual y no afectan runtime ni App Hosting.
- Cualquier cambio de snapshots debe revisarse en PR como cambio funcional de UI, no como artefacto incidental.
- Si el cambio visual es esperado, actualizar baseline con:
```powershell
npm.cmd run test:visual -- --update-snapshots
```
- Si no es esperado, descartar snapshots antes de merge para evitar ruido en CI y crecimiento innecesario del repositorio.

Secrets requeridos en GitHub Actions:
- `FIREBASE_SERVICE_ACCOUNT_HOGARU_1`
- `FIREBASE_TOKEN`

## Setup local (Windows + VS Code)
1. Instalar dependencias del frontend:
```powershell
npm.cmd install
```

2. Instalar dependencias de Functions:
```powershell
Set-Location functions
npm.cmd install
Set-Location ..
```

3. Crear variables de entorno:
```powershell
Copy-Item .env.local.example .env.local
```
Completar valores en `.env.local`.

Variables requeridas por cliente Firebase (consumidas en `src/lib/firebase/config.ts`):
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Si alguna falta, `isFirebaseConfigured` queda en `false`, `src/lib/firebase/client.ts` no inicializa `app/auth/db` y la app termina mostrando errores como `Firebase no esta configurado en este entorno`.

Si `/setup-error` aparece con lista vacia de variables faltantes, normalmente indica desalineacion de entorno/build (no necesariamente llaves ausentes en runtime). En ese caso, validar `apphosting.yaml` y redeploy de App Hosting.

4. Login de Firebase CLI:
```powershell
npx.cmd firebase login
npx.cmd firebase use hogaru-1
```

5. Correr app web:
```powershell
npm.cmd run dev
```

6. (Opcional) Emuladores:
```powershell
npm.cmd run firebase:emulators
```

## Login real por rol (Firebase Auth email/password)
Este proyecto usa autenticacion real con Firebase Auth (`signInWithEmailAndPassword`) + resolucion de perfil en Firestore.

1. En Firebase Console, habilitar proveedor **Email/Password**.
2. Asegurar ADC con quota project (necesario para scripts admin locales):
```powershell
C:\Users\Luis1\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd auth application-default set-quota-project hogaru-1
```
3. Sembrar tenant + usuarios demo reales:
```powershell
npm.cmd run seed:demo
```
4. Ejecutar app:
```powershell
npm.cmd run dev
```

Usuarios de acceso:
- superadmin@hogaru.co / Demo1234*
- admin@santamaria.co / Demo1234*
- residente@santamaria.co / Demo1234*

Resolucion de sesion y rol:
- `AuthProvider` mantiene estados: `loading`, `authenticated`, `unauthenticated`, `misconfigured`, `profile_error`.
- Fuente de verdad de perfil: `users/{uid}` (principal) + `tenantUsers/{tenantId_uid}` (fallback de membresia).
- La app nunca renderiza dashboard generico mientras se resuelve sesion.
- El middleware usa cookie de sesion (`hogaru_session`) para proteger rutas y validar autorizacion por rol.

## Modelo de sesion
```ts
session = {
  authUser: { uid, email },
  profile: {
    uid,
    email,
    role,
    tenantId,
    fullName,
    status,
  },
  resolved: true,
  isConfigured: true,
}
```

Comportamiento:
- Si Firebase no esta configurado: redirige a `/setup-error`.
- Si no hay sesion autenticada: redirige a `/login`.
- Si hay sesion pero perfil inconsistente: redirige a `/unauthorized`.
- Si el rol es valido: redirige a su workspace (`/superadmin`, `/admin`, `/resident`).

## Decisiones tecnicas clave
- Se elimino fallback de dashboards con data mock para evitar comportamiento falso cuando Firebase no esta listo.
- Se dejaron Cloud Functions para operaciones criticas cross-tenant.
- Se establecio `users/{uid}` como perfil canonico y `tenantUsers/{tenantId_uid}` como membresia tenant.
- Se evito sobreingenieria temprana: no se incluyo TanStack Query al no ser necesario en MVP inicial.
- Se preparo App Check y FCM sin bloquear el arranque del producto.

## Comandos utiles
```powershell
npm.cmd run dev
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run format
npm.cmd run firebase:emulators
npm.cmd run firebase:deploy
```

## Checklist de validacion
- [ ] Funciona en localhost con `.env.local` real
  - [ ] `/login` carga
  - [ ] Firebase client inicializa
  - [ ] `AuthProvider` sale de `loading` hacia estado finito
- [ ] Funciona en Firebase App Hosting
  - [ ] Variables `NEXT_PUBLIC_FIREBASE_*` definidas para `BUILD` y `RUNTIME`
  - [ ] `/login` no cae en `/setup-error` cuando el entorno esta correcto
- [ ] Login redirige segun rol
  - [ ] `superadmin -> /superadmin`
  - [ ] `tenant_admin -> /admin`
  - [ ] `resident -> /resident`
- [ ] `/setup-error` solo aparece cuando realmente hay problema de configuracion de entorno (variables faltantes o inicializacion invalida)

## Superadmin operativo (CRUD real)
El workspace superadmin ahora opera con persistencia real en Firestore y Functions.

Areas operativas:
- Tenants: listar, crear, editar, activar/suspender, cambiar plan, cambiar onboarding.
- Admins: listar, filtrar por tenant, crear admin, editar admin, activar/desactivar admin.
- Planes: listar, crear, editar, activar/desactivar, editar limites y features.

Separacion de seguridad:
- Directo a Firestore (superadmin):
  - Actualizacion de tenant (`tenants/*`).
  - Creacion/edicion de planes (`plans/*`).
- Via Cloud Functions (backend seguro):
  - `createTenantWorkspace`.
  - `createTenantAdmin` (crea Auth user + perfiles consistentes).
  - `updateTenantAdmin` (actualiza Auth user, claims y documentos de perfil/membresia).

Funciones/archivos clave:
- UI superadmin:
  - `src/app/(superadmin)/superadmin/tenants/page.tsx`
  - `src/app/(superadmin)/superadmin/admin-users/page.tsx`
  - `src/app/(superadmin)/superadmin/plans/page.tsx`
- Capa de negocio:
  - `src/features/superadmin/services.ts`
  - `src/features/superadmin/schemas.ts`
- Callables cliente:
  - `src/lib/firebase/callables.ts`
- Backend seguro:
  - `functions/src/index.ts`

Prueba manual recomendada:
1. Login como `superadmin@hogaru.co`.
2. Tenants:
   - Crear tenant nuevo.
   - Editar ciudad/plan/onboarding.
   - Suspender y reactivar tenant.
3. Admins:
   - Filtrar por tenant.
   - Crear admin con email nuevo.
   - Editar nombre/email/tenant/estado.
   - Verificar activacion/desactivacion.
4. Planes:
   - Crear plan nuevo.
   - Editar limites/SLA/features.
   - Activar/desactivar plan.
5. Validar persistencia:
   - Revisar colecciones `tenants`, `users`, `tenantUsers`, `plans` en Firestore.
   - Confirmar que operaciones sensibles quedan registradas en `auditLogs` via Functions.

## Roadmap
### Proxima fase
- CRUD real de modulos sobre Firestore.
- Claims + session cookies robustas en servidor.
- Integracion de pasarela de pagos colombiana.
- Notificaciones push productivas por eventos backend.
- Asambleas avanzadas y votacion digital.
- Porteria full con QR.

## Fase por fase (resumen de ejecucion)
### Fase 1
Inicializacion de proyecto y dependencias.

### Fase 2
Arquitectura de carpetas, providers, theming, auth shell y layouts por rol.

### Fase 3
Conexion y configuracion Firebase para `hogaru-1` mediante variables de entorno.

### Fase 4
Auth demo + base RBAC + estructura multi-tenant.

### Fase 5
Consola superadmin (dashboard, tenants, planes, soporte).

### Fase 6
Consola administracion edificio (dashboard + modulos MVP).

### Fase 7
Portal residente (home + modulos MVP).

### Fase 8
Notificaciones in-app, FCM prep, App Check prep.

### Fase 9
Rules, Cloud Functions iniciales, seed demo, backlog.

### Fase 10
Listo para ejecucion local y despliegue inicial.

## URL oficial de la aplicación

> **IMPORTANTE:**
> La única superficie oficial de la app es:
> **https://hogaru-web--hogaru-1.us-central1.hosted.app/**
>
> - Todas las validaciones, debugging y QA deben hacerse sobre esta URL.
> - No uses hogaru-1.web.app ni firebaseapp.com como referencia de entorno productivo.
> - Si encuentras bugs, repórtalos solo si ocurren en hosted.app.
> - El dominio hosted.app debe estar autorizado en Firebase Auth (Authentication > Sign-in method > Authorized domains).

## Validación de cambios en producción

1. Despliega usando App Hosting (hosted.app).
2. Valida login, navegación y módulos críticos en la URL oficial.
3. No uses web.app para pruebas ni debugging.

## Notas de entorno

- El AUTH_DOMAIN de Firebase Auth sigue siendo hogaru-1.firebaseapp.com (necesario para login), pero la app real vive en hosted.app.
- Si hay diferencias de comportamiento entre hosted.app y web.app, el build válido es el de hosted.app.
