# Plan de implementación — Módulos con variantes (piloto: Visitas + Paquetería)

> Decisiones confirmadas:
> 1. Piloto = **Visitas (P0) + Paquetería (P1)**.
> 2. **Finanzas y Gobernanza se fijan al crear** (no editables por el admin) — fuera del piloto,
>    pero el modelo reserva su lugar.
> 3. El selector de variantes va en el **alta de superadmin** (`createTenantWorkspace`).
>
> Metodología: critique → execute → commit. Gate por incremento: `npm run typecheck` limpio en
> `src/` **y** `functions/`, + `npm run test:rules:auto`. Front despliega por push a `master`;
> functions por `firebase deploy --only functions`; reglas por `firebase deploy --only firestore:rules`.

---

## 0. Concepto

Nuevo eje de configuración **paralelo** a `residentModules` (que es ON/OFF y solo oculta menú).
`moduleVariants` define **el modo de operación** de un módulo y ramifica comportamiento en varias
capas (guardia, residente, admin, reglas, notificaciones).

```
tenantSettings/{tenantId}
  residentModules: { reservations, services, surveys, regulations }   // existente (ON/OFF)
  moduleVariants:  { visitors, packages, ... }                        // NUEVO (modos)
```

---

## 1. Modelo de datos y accesor (incremento 1)

**Nuevo archivo:** `src/lib/config/module-variants.ts`

```ts
export type VisitorsVariant = "qr_full" | "registro_simple";
export type PackagesVariant = "con_evidencia" | "aviso_simple";
// reservados (fijos al crear, fuera del piloto):
export type FinanceVariant = "completa" | "solo_consulta";
export type GovernanceVariant = "formal" | "informativo";

export type ModuleVariants = {
  visitors: VisitorsVariant;
  packages: PackagesVariant;
  finance: FinanceVariant;
  governance: GovernanceVariant;
};

export const DEFAULT_MODULE_VARIANTS: ModuleVariants = {
  visitors: "qr_full",          // default = comportamiento actual (no rompe nada)
  packages: "con_evidencia",
  finance: "completa",
  governance: "formal",
};

// Best-practice de editabilidad (decidido en el análisis):
//  - "locked"  → se fija al crear; el admin NO lo cambia (estructural)
//  - "warn"    → editable con advertencia + manejo de datos en vuelo
//  - "free"    → editable en cualquier momento
export const VARIANT_EDITABILITY: Record<keyof ModuleVariants, "locked" | "warn" | "free"> = {
  visitors: "warn",
  packages: "free",
  finance: "locked",
  governance: "locked",
};

export function getModuleVariant<K extends keyof ModuleVariants>(
  settings: { moduleVariants?: Partial<ModuleVariants> } | null | undefined,
  key: K,
): ModuleVariants[K] {
  return (settings?.moduleVariants?.[key] ?? DEFAULT_MODULE_VARIANTS[key]) as ModuleVariants[K];
}
```

**Tocar:** `src/features/admin/services.ts`
- Añadir `moduleVariants?: Partial<ModuleVariants>` a `TenantSettingsItem` (junto a `residentModules`, ~línea 260).
- Re-exportar tipos/accesor desde aquí si conviene para consumo en UI.

> Patrón idéntico a `DEFAULT_RESIDENT_MODULES`: si el campo falta, se aplica el default → **los
> conjuntos existentes siguen en `qr_full`/`con_evidencia` sin migración**.

---

## 2. Selección al crear el conjunto — superadmin (incremento 1)

**Cloud Function** `functions/src/index.ts` → `createTenantWorkspace` (~líneas 900-937):
- Extender `CreateTenantWorkspaceInput` con `moduleVariants: ModuleVariants` (las 4 claves).
- Validar valores contra los literales permitidos.
- **Inicializar** `tenantSettings/{tenantId}` en la creación con `moduleVariants` (hoy NO crea
  `tenantSettings` en el alta → lo agregamos; `residentModules` puede quedar en default).
- Registrar en `auditLogs` la config elegida.

**Cliente superadmin** `src/features/superadmin/services.ts` → `createTenantWorkspace` (117-126):
añadir `moduleVariants` al input.

**UI superadmin** (formulario de alta de tenant): agregar una sección **"Modos de operación"** con
un **selector por módulo** (radio / segmented), con copy de ayuda por opción. Las 4 variantes se
eligen aquí; las `locked` (finance, governance) **solo** se definen en este punto.

---

## 3. Configurador del admin — editar las variantes permitidas (incremento 1)

**Tocar:** `src/features/admin/components/resident-modules-card.tsx` (o nueva tarjeta hermana
`module-variants-card.tsx`) dentro de `src/app/(admin)/admin/settings/page.tsx`.

- Mostrar las 4 variantes; pero **editar según `VARIANT_EDITABILITY`**:
  - `free` (packages): cambio directo, igual que un toggle.
  - `warn` (visitors): modal de advertencia + chequeo de **datos en vuelo** (p. ej. autorizaciones/QR
    activos) antes de confirmar.
  - `locked` (finance, governance): solo lectura, badge *"Definido al crear el conjunto — contactar
    soporte para cambiar"*.
- Escritura con merge: `updateDoc(tenantSettings/{id}, { ['moduleVariants.'+key]: value })`
  (mismo patrón que `residentModules.${key}`).

---

## 4. Visitas — comportamiento por variante (incremento 2)

### 4.1 `qr_full` (hoy): sin cambios. Es el default.

### 4.2 `registro_simple`: el guardia registra al llegar

**Guardia** `src/components/securityGuard/GuardVisitors.tsx`:
- Leer la variante (subscripción a `tenantSettings`, ya disponible en el shell; o accesor).
- Si `registro_simple`:
  - **Ocultar** el escáner QR y la lista de pases programados.
  - Mostrar como acción primaria **"Registrar visita"** → formulario corto (nombre, número de
    identificación, unidad/torre, a quién visita).
  - Al guardar: crear `visitorPasses` con `status: "inside"`, `checkInAt: now`, **sin** `qrCodeValue`,
    `registeredByGuard: true`, `authorizationType` omitido.
  - Disparar **notificación al residente**: *"Tienes una visita registrada"* (ver §4.4).
  - Permitir un **"Salió"** opcional (status → `completed`), pero sin obligar el flujo.

**Residente** `src/app/(resident)/resident/visitors/*`:
- Si `registro_simple`: la página pasa a **registro de solo lectura** (historial de visitas a su
  unidad) + las notificaciones. **Ocultar** "Nueva invitación"/pre-autorización/QR.

**Admin** `src/app/(admin)/admin/visitors/page.tsx`:
- Si `registro_simple`: **ocultar** la pestaña/acciones de *autorizaciones* y QR; dejar la vista
  de **monitoreo** (log de pases registrados).

### 4.3 Reglas Firestore — el guardia debe poder CREAR pases en modo simple

**Tocar:** `firestore.rules` → `match /visitorPasses/{docId}`.

Helper seguro (usa `.get(key, default)` para no fallar si falta el campo):
```
function tenantVisitorsVariant(tid) {
  return get(/databases/$(database)/documents/tenantSettings/$(tid))
           .data.get('moduleVariants', {}).get('visitors', 'qr_full');
}
```
Añadir rama de `create` para el guardia **solo** en modo simple, con campos acotados:
```
allow create: if signedIn() && (
  tenantAdminOrSuper(request.resource.data.tenantId) ||
  ( residentOwnUnit(...) && request.resource.data.createdBy == request.auth.uid ) ||   // existentes
  (
    securityGuardRole(request.resource.data.tenantId) &&
    tenantVisitorsVariant(request.resource.data.tenantId) == 'registro_simple' &&
    request.resource.data.status == 'inside' &&
    request.resource.data.keys().hasOnly([
      'tenantId','unitId','unitLabel','visitorName','documentNumber',
      'hostResidentName','tower','unit','date','status','checkInAt','registeredByGuard'
    ])
  )
);
```
> Nota: `get()` en reglas cuenta como lectura adicional por operación de creación. Es aceptable
> para el volumen de porterías. Tests obligatorios (§7).

### 4.4 Notificaciones
- Reusar el catálogo (`functions/src/notification-catalog.ts`) + `createNotifications`.
- Nuevo tipo: *visita registrada* → destinatarios = residentes de la unidad anfitriona.
- Se puede disparar **cliente** (al crear el pase) o vía **Cloud Function** `createVisitorPass`
  (preferible si ya centraliza notificaciones). Definir en ejecución según dónde viven hoy.

---

## 5. Paquetería — comportamiento por variante (incremento 3)

Gemela operativa de Visitas; reusa el patrón.

- `con_evidencia` (hoy): foto + firma + estados + retiro. Sin cambios.
- `aviso_simple`:
  - **Guardia**: "Registrar paquete" corto (unidad + descripción opcional) → notifica al residente.
    Sin foto/firma; sin flujo de retiro confirmado (o retiro de un toque).
  - **Datos**: campos de evidencia opcionales/omitidos.
  - **Reglas**: si el guardia ya puede crear/registrar paquetes hoy, no hay cambio de permisos
    (verificar en ejecución); si no, misma técnica que §4.3 acotada a `aviso_simple`.
  - **Editabilidad `free`**: cambio directo en el configurador, sin datos en vuelo problemáticos.

---

## 6. Migración / compatibilidad
- **Conjuntos existentes**: sin `moduleVariants` → accesor aplica defaults (`qr_full`,
  `con_evidencia`) = comportamiento idéntico al actual. **Cero migración de datos.**
- **Staging primero**: probar el alta con variantes y el modo simple en `vivaru-staging-02` antes
  de prod.
- Cambio `warn` (visitors) en runtime: el modal valida autorizaciones/QR activas y avisa que
  quedarán sin uso; no se borran datos.

---

## 7. Pruebas (gate)
- **Reglas** (`tests/firestore.rules.test.ts`, vía `npm run test:rules:auto`):
  - Guardia **puede** crear `visitorPasses` cuando `visitors == registro_simple` y campos válidos.
  - Guardia **NO** puede crear cuando `visitors == qr_full` (o por defecto).
  - Guardia no puede inyectar campos fuera de la lista (`hasOnly`).
  - Admin/residente conservan sus permisos actuales.
- **Typecheck** `src/` y `functions/` limpios.
- **Manual en staging**: alta de tenant en cada modo; flujo de guardia simple; notificación al
  residente; configurador (free vs warn vs locked).

---

## 8. Plan de incrementos (commits)
1. **Infra de variantes**: `module-variants.ts` (tipos/defaults/accesor/editabilidad) +
   `TenantSettingsItem` + `createTenantWorkspace` (CF + cliente + UI superadmin) +
   `module-variants-card` en settings (mostrar; editar free/warn; locked solo-lectura).
   → typecheck.
2. **Visitas `registro_simple`**: guardia (form + crear + "Salió" opcional), residente/admin
   (modos), reglas Firestore (guardia create en simple) + tests, notificación. → typecheck + rules.
3. **Paquetería `aviso_simple`**: guardia + datos + (reglas si aplica) + notificación. → typecheck + rules.
4. **Pulido + pruebas en staging** + documentación en wiki (`wiki-producto/wiki/`), luego prod.

---

## 9. Riesgos y decisiones abiertas
- **Reglas con `get()`**: costo de lectura extra por creación de pase. Aceptable; medir si crece.
- **¿El residente conserva algo en modo simple?** Propuesta: solo lectura + notificaciones. Confirmar.
- **Notificación: cliente vs Cloud Function** — decidir en ejecución según dónde se centraliza hoy.
- **Estados de visita en modo simple**: reusar `"inside"`/`"completed"` (propuesto) vs. introducir
  `"registered"`. Reusar evita tocar más capas; confirmar en ejecución.
```
