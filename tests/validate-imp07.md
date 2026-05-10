# Validate IMP-07 — Módulo de Soporte Básico (Manual Checklist)

> Ejecutar como **Superadmin**. URL base: `http://localhost:3000` (dev) o prod.

---

## 1. Acceso y estado inicial

- [ ] Login Superadmin → navegar a `/superadmin/support`
- [ ] La página muestra una tabla vacía (NO el componente `EmptyState` genérico)
- [ ] Botón **"Registrar incidencia"** visible en el header de la tarjeta

---

## 2. Modal de creación — validaciones

- [ ] Click **"Registrar incidencia"** → modal se abre
- [ ] El modal contiene los campos: Tenant (select), Reportado por (email), Categoría, Asunto, Descripción, Prioridad, Notas (opcional)
- [ ] Intentar guardar con **email inválido** (e.g. `no-es-email`) → mensaje de error visible bajo el campo
- [ ] Intentar guardar con **asunto < 5 chars** (e.g. `abc`) → mensaje de error visible bajo el campo
- [ ] El botón Guardar está deshabilitado / no guarda mientras haya errores de validación

---

## 3. Crear ticket válido

Datos de prueba:

| Campo | Valor |
|---|---|
| Tenant | El Nogal (`tenant-nogal-bogota`) |
| Reportado por | `admin@elnogal.co` |
| Categoría | Técnico |
| Asunto | `Problema de acceso a plataforma` |
| Descripción | `El administrador no puede iniciar sesión` |
| Prioridad | Alta |
| Notas | *(vacío)* |

- [ ] Completar campos con datos válidos → click **Guardar**
- [ ] Modal se cierra automáticamente
- [ ] Nuevo ticket aparece en la tabla en **tiempo real** (sin reload)
- [ ] La fila muestra el asunto, tenant name, y fechas correctas

---

## 4. Badges de estado y prioridad

- [ ] Badge **Estado "Abierto"** aparece en azul (`bg-blue-100 text-blue-800`)
- [ ] Badge **Prioridad "Alta"** aparece en rojo (`bg-red-100 text-red-800`)
- [ ] Badge **Prioridad "Media"** aparece en ámbar (`bg-amber-100 text-amber-800`)
- [ ] Badge **Prioridad "Baja"** aparece en gris pizarra (`bg-slate-100 text-slate-700`)

---

## 5. Drawer de detalle — cambio a "En progreso"

- [ ] Click **"Ver detalle"** en cualquier fila → Drawer se abre
- [ ] Todos los campos del ticket son visibles (tenant, reportado por, categoría, prioridad, etc.)
- [ ] Cambiar **Estado** a **"En progreso"** → click **Guardar**
- [ ] Drawer se cierra (o actualiza) y el badge de estado cambia a naranja en la tabla
- [ ] El campo `resolvedAt` **no** aparece en Firestore para este ticket

---

## 6. Cambio a "Resuelto"

- [ ] Abrir Drawer del mismo ticket → cambiar **Estado** a **"Resuelto"** → Guardar
- [ ] Badge de estado cambia a verde (`bg-emerald-100 text-emerald-800`) en la tabla
- [ ] Fecha de resolución visible en el Drawer (campo `resolvedAt` presente)
- [ ] En Firestore: `resolvedAt` escrito como `serverTimestamp()`

---

## 7. Filtros

- [ ] Escribir nombre del tenant en el campo de búsqueda → tabla filtra en tiempo real mostrando solo tickets de ese tenant
- [ ] Seleccionar **Estado "Resuelto"** en el select → solo tickets resueltos visibles
- [ ] Seleccionar **Prioridad "Alta"** en el select → solo tickets de prioridad alta visibles
- [ ] Click **"Limpiar filtros"** (o borrar campos) → todos los tickets visibles de nuevo

---

## 8. Control de acceso

- [ ] Cerrar sesión → login como **Admin** (rol `tenant_admin`) → intentar navegar a `/superadmin/support`
- [ ] El middleware redirige a `/unauthorized` (sin código adicional — ya manejado por `middleware.ts`)
- [ ] El Admin **no** puede ver ni crear tickets de soporte superadmin

---

## 9. Verificación en Firestore (Emulator o Console)

- [ ] Colección `supportTickets` existe y contiene el ticket creado
- [ ] Documento tiene campos: `tenantId`, `tenantName`, `reportedBy`, `category`, `subject`, `description`, `priority`, `status: "open"`, `createdAt`, `updatedAt`, `createdBy` (uid del superadmin)
- [ ] Documento **no** tiene campo `resolvedAt` si el ticket está en estado `open` o `in_progress`
- [ ] Documento tiene `resolvedAt` cuando estado es `resolved`
