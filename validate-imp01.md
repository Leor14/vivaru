# Validación manual — IMP-01: Sincronización unitId Admin → Residente

## Requisitos previos

- Acceso a Admin y Residente del mismo tenant
- Una unidad existente en el catálogo (ej. "Apto 101")
- El residente de esa unidad con `unitId` correcto en `users/{uid}` o `tenantUsers/`
- Un CSV de prueba preparado (ver paso 6)

---

## Paso 1 — Admin crea cobro manual

1. Login como Admin → sección **Cartera**
2. En el formulario de creación:
   - Selecciona la unidad **"Apto 101"** del dropdown
   - Fecha: mes actual (ej. `2026-05`)
   - Monto: `$300.000`
   - Abono: `$0`
   - Fecha límite: cualquier fecha futura
3. Click **Registrar**
4. El cobro aparece en la tabla del Admin con estado **Pendiente**

> ✅ Esperado: el documento en Firestore tiene `unitId` igual al ID real del catálogo (ej. `abc123`), **no** un slug como `unit-apto-101`.
> Verificar en Firebase Console → `billingStatements` → último documento.

---

## Paso 2 — Residente ve el cobro

1. Logout del Admin
2. Login como Residente de **"Apto 101"**
3. Navegar a **Estado de Cuenta**

> ✅ Esperado: el cobro de `$300.000` aparece en la lista con estado **Pendiente**.
> ❌ Si sigue mostrando "Sin movimientos": el `unitId` del residente en Firestore no coincide — revisar campo `unitId` en `users/{uid}`.

---

## Paso 3 — Verificar campos mostrados

En la tarjeta del cobro en el portal Residente, verificar:
- Período: `2026-05`
- Saldo: `$300.000`
- Estado: `Pendiente`

---

## Paso 4 — Admin edita el cobro

1. Login Admin → Cartera
2. Click **Editar** en el cobro de Apto 101
3. Cambiar monto a `$350.000` (abono sigue en `$0`)
4. Click **Guardar**

> ✅ Esperado en Firestore: `amount = 350000`, `unitId` sigue siendo `abc123` (el real), **no** fue sobreescrito a slug.

---

## Paso 5 — Residente ve el monto actualizado

1. Volver al portal Residente → Estado de Cuenta (puede requerir refresh)

> ✅ Esperado: el saldo ahora muestra `$350.000` (actualización en tiempo real por Firestore listener).

---

## Paso 6 — CSV con 1 label válido y 1 inválido

### Preparar CSV

Crear archivo `prueba-cartera.csv` con este contenido exacto (separado por comas):

```
apartamento,fecha,monto,abono,saldo,fecha_limite
Apto 101,2026-06,120000,0,120000,2026-06-30
Bodega 999,2026-06,50000,0,50000,2026-06-30
```

- `Apto 101` → debe existir en el catálogo del tenant
- `Bodega 999` → debe **NO** existir en el catálogo

### Importar

1. Login Admin → Cartera → botón **Importar CSV**
2. Seleccionar `prueba-cartera.csv`

> ✅ Esperado:
> - Toast de éxito: `"Importacion completa: 1 fila(s) procesadas."`
> - Toast de error: `"1 fila(s) omitidas por unidad no encontrada: Bodega 999"`
> - Solo aparece el cobro de Apto 101 en la tabla
> - El cobro de Bodega 999 **NO** se crea

### Verificar en Residente

1. Login Residente de "Apto 101"
2. Estado de Cuenta → debe mostrar ahora 2 cobros (el del paso 1 editado + el del CSV)

---

## Verificación en Firestore (opcional)

En Firebase Console → Firestore → colección `billingStatements`:

| Campo | Valor esperado |
|---|---|
| `unitId` | ID real del catálogo (ej. `abc123`), nunca `unit-apto-101` |
| `unitLabel` | `"Apto 101"` |
| `tenantId` | ID del tenant correcto |
| `amount` | `350000` (cobro editado) o `120000` (CSV) |

Si cualquier `unitId` empieza con `unit-`, hay datos legacy → ejecutar el script de migración:

```bash
npx ts-node scripts/migrate-billing-unit-ids.ts [tenantId]
```
