---
tags: [arquitectura, roles, consejo]
tipo: decision
fuentes: ["PRD-V-PLAT-004"]
fecha_creacion: 2026-09-12
fecha_actualizacion: 2026-09-12
---

# El rol Consejo

El consejo de administración firma el informe mensual y vigila las cuentas del conjunto. Pero en Vivaru
el rol `committee` tenía permisos en las reglas y **nadie podía concederlo**: 0 de 41 personas lo tenían
en producción, y la callable de alta solo admitía administración y portería. La firma del consejo del
[[informe-mensual]] estaba desplegada y nadie podía usarla. `PRD-V-PLAT-004` lo resolvió **sin tocar el
rol**.

## El consejo es un atributo, no un rol

- **La marca vive en la membresía** (`tenantUsers`): `isCommittee`, `committeeSince` y
  `committeeGrantedBy`. `tenantUsers` guarda un solo `role` por persona, así que `role: "committee"` le
  habría quitado al consejero su condición de residente, con su unidad y su estado de cuenta. Ver
  [[autenticacion-roles]].
- **La concede la administración** desde el padrón (`/admin/residents`), con la callable
  `setCommitteeMembership`, que valida y deja auditoría. **El cliente no puede escribir la marca**: todo
  campo nuevo de `tenantUsers` nacía escribible, y un administrador podía dársela a sí mismo.
- **Entra por el portal del residente** (decisión de David, `TBD-B`): su menú gana «Informes del
  conjunto», con los totales y el botón de firmar, y nada más cambia. Ver [[portal-residente]].
- **En las reglas**, `esConsejo` le deja leer los informes emitidos —no el borrador— y los paz y salvo;
  en `documents` lee lo mismo que un residente. **No recibe el PDF mientras `K2` esté cerrado**, porque
  lista la cartera por unidad: lo abre la administración.
- **Firma con el nombre y el cargo que pone el servidor** (`identidadParaFirmar`), y cada firma rehace
  el PDF.

## Bandera y estado

`producto-rol-consejo` ([[banderas-funcionalidad]]). **Medido el 12 sep:** encendida solo en Santa María
(producción) y en Palmas (staging). Las entregas 1 (9 sep) y 2 (11 sep) están en producción; la 3 —el paz
y salvo de cualquier unidad— espera al abogado. `CA3` y `CA5` están probados y sin mirar en pantalla,
porque firmar y tocar la marca en staging no se autorizaron.

**El freno es un número**: de 68 personas del padrón, solo 10 tienen cuenta, y 8 son de Santa María, el
único conjunto donde hoy se puede formar un consejo (medido el 9 sep). Ver [[ciclo-de-vida-tenant]] y
[[estado-modulos]].

## Lo que dejó

- **`CA3` era imposible por construcción**: el PDF se congelaba al emitir, con el bloque de firmas vacío,
  y firmar no lo tocaba. Ver [[trampas-conocidas]].
- **El detalle por unidad del informe viajaba entero a su navegador** —una regla no oculta campos— hasta
  que el 12 sep salió a un documento aparte. Ver [[multi-tenancy]].

## Relaciones

- Se conecta con: [[informe-mensual]], [[autenticacion-roles]], [[portal-residente]], [[usuarios]]
