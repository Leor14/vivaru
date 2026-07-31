---
tags: [decision, unidades, data-model, agrupaciones]
tipo: decision
fuentes: ["sesion-auditoria-ux-2026-07"]
fecha_creacion: 2026-07-03
fecha_actualizacion: 2026-07-03
---

# Torres y Agrupaciones Canónicas

La "Torre/Bloque" de una unidad nació como texto libre y convivían variantes del mismo valor (`T1`, `torre 1`, `torre1`, `TORRE 1`). Eso fragmentaba filtros y **corrompía KPIs** — incluido el "111% de unidades morosas" del [[reportes|Reporte de Comité]] que detectó la [[auditoria-ux-jul-2026]]. Se decidió el modelo **A1: lista canónica gestionada** (no una entidad relacional con FK — evolución posible, no necesaria).

## Las piezas

1. **`normalizeTower()`** (`src/utils/tower.ts`) — única regla de canonización: `t1`/`torre-1` → `Torre 1`; `bloque a` → `Bloque A`; Title Case es-CO con conectores en minúscula (`CASA DE CAMPO` → `Casa de Campo`). Default `Principal` para conjuntos de un bloque.
2. **`tenantSettings.agrupaciones`** — lista canónica por tenant, con CRUD en [[configuracion|Configuración → Conjunto]] (`TowersCard`: conteo de uso, bloqueo de borrado en uso, importar desde unidades).
3. **Select en el modal de unidad** (fin del input libre) + "Nueva agrupación…" que se suma a la lista. Al editar una unidad legada su torre se muestra ya canónica — migración progresiva.
4. **Normalización en la capa de servicios** (`createUnit`/`updateUnit`/`bulkCreateUnits`) — ver la trampa de `getValues()` en [[trampas-conocidas]].
5. **Normalize-on-read en filtros** de [[visitantes|Residentes]], [[modulos-variantes|Servicios]] y [[paquetes]]: colapsa duplicados sin esperar migración.

## Migración one-off (ejecutada en prod)

`functions/scripts/migrate-towers.mjs` (con `DRY_RUN`): **20 unidades + 25 personas** normalizadas en hogaru-1 y `agrupaciones` sembrada en 6 tenants; staging ya estaba canónico. Verificado con `audit-towers.mjs`: 0 variantes restantes. Reutilizable para tenants futuros.

## Relaciones

- Véase también: [[resolucion-unit-id]], [[fusion-unidades]], [[kpis-formula-unica]]
- Se conecta con: [[multi-tenancy]], [[triaje-auditoria-ux]]

## Fuentes

- Commits `51987ca` (código) y `a356a53` (scripts + migración)
