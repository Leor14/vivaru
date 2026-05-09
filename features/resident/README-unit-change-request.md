# Pruebas y criterios de aceptación: Solicitud de cambio de unidad (residente)

## 1. Prueba funcional completa

### a) Acceso y visualización
- Ingresa como residente en /resident/profile.
- Verifica que se muestre la unidad actual y el botón “Solicitar cambio de unidad”.

### b) Solicitud de cambio
- Haz clic en “Solicitar cambio de unidad”.
- Se abre un modal con:
  - Unidad actual (solo lectura)
  - Selector de nueva unidad (solo unidades activas del mismo tenant, excluyendo la actual)
  - Motivo opcional
- Selecciona una nueva unidad y (opcional) ingresa un motivo.
- Haz clic en “Enviar solicitud”.
- Debes ver feedback de éxito y la solicitud debe aparecer en el estado del perfil.

### c) Estado de solicitud
- Si tienes una solicitud pendiente, el botón queda deshabilitado y ves el estado (pendiente, aprobada, rechazada).
- Si la solicitud es aprobada/rechazada por un admin, el estado se actualiza automáticamente en el perfil.

### d) Validaciones y reglas
- No puedes solicitar la misma unidad actual.
- No puedes crear más de una solicitud pendiente.
- No puedes seleccionar unidades inactivas o de otro tenant.
- No puedes cambiar tenantId ni adjudicarte unidad directamente.

### e) Seguridad
- Solo puedes ver y crear tu propia solicitud.
- Admin/tenant_admin puede ver y aprobar/rechazar solicitudes de su tenant.
- Nadie puede borrar solicitudes desde el cliente.

## 2. Criterios de aceptación
- El perfil del residente sigue cargando bien.
- Se ve la unidad actual.
- Existe la opción de solicitar cambio de unidad.
- Solo se pueden seleccionar unidades del mismo tenant.
- No se puede elegir la misma unidad actual.
- La solicitud se guarda en Firestore.
- El residente ve el estado de su solicitud.
- No hace falta recargar manualmente.
- No se permite cambio directo inseguro de unidad.

## 3. Pruebas de seguridad (Firestore rules)
- Un residente no puede crear/leer/actualizar/borrar solicitudes de otro usuario.
- Un admin puede aprobar/rechazar solicitudes de su tenant.
- Nadie puede borrar solicitudes.

---

**Listo para QA y validación de negocio.**
