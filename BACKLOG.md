# Resident Profile — Checklist de QA y despliegue

## Pruebas funcionales

1. Acceso a /resident/profile:
	- [ ] Carga sin errores para un residente autenticado.
	- [ ] Muestra nombre, correo, unidad y tenant.
	- [ ] Banner superior refleja branding del tenant (color/logo/nombre).

2. Edición de perfil:
	- [ ] Se puede editar nombre, teléfono, documento y método de contacto.
	- [ ] Se puede elegir y guardar un avatar del sistema.
	- [ ] El botón guardar solo se habilita si hay cambios válidos.
	- [ ] El botón cancelar revierte cambios no guardados.
	- [ ] Feedback visual de guardado, error y éxito.

3. Persistencia y UI:
	- [ ] Cambios se guardan en Firestore y se reflejan inmediatamente en la UI.
	- [ ] El avatar se muestra correctamente tras guardar y recargar.
	- [ ] No hay uploads de imagen pesados.

4. Seguridad:
	- [ ] El residente solo puede editar su propio perfil.
	- [ ] No puede cambiar role, tenantId ni email.
	- [ ] No puede editar el perfil de otro usuario.
	- [ ] No puede crear ni eliminar usuarios.

## Pruebas de edge cases

- [ ] Branding incompleto: sin color/logo, debe usar fallback seguro.
- [ ] Campos opcionales vacíos: no debe romper la UI.
- [ ] Intento de guardar datos inválidos: debe mostrar error y no guardar.

## Despliegue

1. Validar que todas las pruebas anteriores pasan en staging.
2. Hacer merge a main/master.
3. Deploy a Firebase App Hosting.
4. Validar en producción con usuario real.

---
Checklist completado = módulo listo para producción.
# Backlog Tecnico HOGARU

## Sprint 2
- Integrar lectura/escritura real de Firestore en todos los modulos (reemplazar dataset demo).
- Implementar middleware con session cookie firmada para guards server-side estrictos.
- Activar flujo real de recovery password (Firebase Auth sendPasswordResetEmail).
- Implementar CRUD completo de tenants por Cloud Functions + UI forms.
- Activar upload real de comprobantes y documentos a Cloud Storage.
- Implementar worker/trigger para notificaciones por eventos de Firestore.

## Seguridad
- Completar validaciones de ownership por recurso (unidad, residente, ticket).
- Endurecer Storage Rules con verificacion de membresia por tenantUsers.
- Forzar App Check en Functions y Firestore al pasar a entorno productivo.
- Agregar tests de reglas con @firebase/rules-unit-testing.

## Producto
- Asambleas avanzadas con votacion digital.
- Integracion de pasarela (PSE/Wompi/ePayco) con conciliacion automatica.
- Modulo porteria operativo con scanner QR.
- Analitica avanzada por tenant y benchmarking agregado en superadmin.
- Branding extendido por tenant (dominio custom + tema visual).
