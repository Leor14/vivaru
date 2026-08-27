---
tags: [arquitectura, correos, mensajeria, resend, seguridad, entregabilidad]
tipo: tecnica
fuentes: ["remediacion-auth-2026"]
fecha_creacion: 2026-06-09
fecha_actualizacion: 2026-08-27
---

# Correos y Mensajería

Sistema de correo transaccional de identidad de Vivaru, construido en junio 2026 durante la remediación de [[autenticacion-roles]] para go-live. Es **híbrido por seguridad**: los correos de onboarding salen por Resend con marca Vivaru; el reset de auto-servicio usa el envío nativo de Firebase.

## Qué correos se envían y por quién

- **Onboarding** (alta de admin, guardia o residente — disparada por un admin autenticado): los manda **Resend** desde `noreply@notificaciones.grupovivaru.com`. Ver [[usuarios]].
- **Recuperación auto-servicio** (`/forgot-password`, endpoint público): la manda **Firebase nativo** (`sendPasswordResetEmail`) desde `noreply@hogaru-1.firebaseapp.com`.

La razón del híbrido: el endpoint público no debe ser un vector de spam, y el envío nativo de Firebase trae throttling y manejo de enumeración. Los flujos de onboarding son autenticados, así que ahí sí se usa Resend.

## Flujo Resend (A5)

Las Cloud Functions de creación llaman a `sendPasswordSetupEmail`, que: (1) genera el enlace seguro con `generatePasswordResetLink` (Admin SDK); (2) lo envía con `resend.emails.send` vía `fetch` a `api.resend.com` (sin dependencia nueva en `functions/`), usando una plantilla HTML con el logo. El código vive en `functions/src/email.ts`. Es *best-effort*: si el envío falla no rompe la creación del usuario. Ver [[firebase-firestore]].

Hay dos variantes de plantilla: **bienvenida** (cuenta nueva) y **restablecimiento** (reenvío de acceso a un residente existente); el backend elige según si el usuario ya existía.

## Dominio y secreto

El dominio remitente `notificaciones.grupovivaru.com` está **verificado en Resend** (región us-east-1), con registros DKIM/SPF/DMARC cargados en el DNS de Squarespace. La API key vive como **secret de Firebase Functions** (`RESEND_API_KEY`), nunca en código ni en App Hosting para las functions. Despliegue: hay que recompilar (`tsc`) y fijar el secret **antes** de `firebase deploy --only functions` — ver [[trampas-conocidas]].

## Página de reset y URL de acción

El enlace de los correos abre la página propia `/restablecer` (en español, con marca), que valida el `oobCode`. Para que el enlace apunte ahí, hay que fijar la **URL de acción** global en Firebase Console → Authentication → Templates a `https://www.grupovivaru.com/restablecer` (aplica a todas las plantillas). Detalle del flujo en [[autenticacion-roles]] y la ruta pública en [[middleware-ts]].

## Pendientes y mejoras

- **Guardar la URL de acción** requiere cuenta Owner del proyecto y el dominio en "Dominios autorizados" (ver [[trampas-conocidas]]).
- Mejora futura: enrutar también `/forgot-password` por Resend (requiere rate-limiting propio por ser público), para que TODO salga de `grupovivaru.com`.

## Avisos a residentes (distintos de los correos de identidad)

Esta página cubre los **correos de identidad** (onboarding y reset). Los **avisos operativos a residentes** (cartera, PQRS, reservas, etc.) son un sistema aparte — in-app + email opcional, con catálogo de copias editable por tenant. Su detalle vive en [[notificaciones-residentes]], usado intensamente por [[cartera-campanas|Cartera]]. Comparten el mismo secret `RESEND_API_KEY` y el remitente `notificaciones.grupovivaru.com`.

## Entrega medida: `emailDeliveries` y el webhook de Resend (`PRD-V-FLOW-003`)

**En producción desde el 27 de agosto de 2026, y validado de punta a punta.** Antes, un correo que
rebotaba o caía en spam **no dejaba rastro**: nadie sabía a quién no le llegaba el aviso.

| Pieza | Qué hace |
|---|---|
| `idDeRespuestaResend` | Captura el **id del mensaje** que devuelve la API. No se guardaba: `sendNotificationEmail` devolvía `void` y tiraba el cuerpo de la respuesta |
| `emailDeliveries` | Una fila por correo, **con ese id como id de documento** — de ahí sale la idempotencia. Lectura solo para administración y superadmin (**el consejo NO**: guarda la dirección de cada residente), escritura cerrada entera. Retención desde el día uno |
| `resendWebhook` | La **primera función HTTP del producto** (`https://us-central1-hogaru-1.cloudfunctions.net/resendWebhook`). Resend firma con **Svix** y `svix` no está en el repositorio, así que la firma se verifica a mano contra el vector público de Svix |
| La bandera | `producto-entrega-de-correo`, comprobada **en el servidor** dentro de `registrarEnvio`. Apagada no se escribe una sola fila |

**`email.opened` y `email.clicked` se ignoran a propósito:** saber si alguien abrió un correo exige
un píxel de seguimiento, y esta colección existe para saber si el aviso **llegó**, no para vigilar a
quien lo recibe. Un rebote o una queja marcan además `people.emailStatus`, que es donde el
administrador corrige el contacto.

> **DOS COSAS QUE MUERDEN, LAS DOS MEDIDAS.** (1) Un secret de Functions v2 se queda **clavado a una
> VERSIÓN**, no sigue a `latest`: cambiar el valor de `RESEND_WEBHOOK_SECRET` **obliga a redesplegar**
> `resendWebhook`, y no hacerlo da el mismo síntoma que una clave mal copiada. (2) **Un endpoint de
> webhook no se prueba con el navegador**: un `GET` responde `405 method not allowed`, que es su
> conducta correcta y se lee como avería. Para probarlo, `curl -X POST` (da `401`) o el «send test
> event» de Resend.

**Y el eslabón que decide si esto sirve de algo está aguas arriba**, en [[notificaciones-residentes]]:
si el aviso no tiene el email activo para ese conjunto, no hay envío y por tanto tampoco fila.

## Relaciones

- Véase también: [[autenticacion-roles]], [[usuarios]], [[firebase-firestore]], [[notificaciones-residentes]]
- Depende de: [[stack-tecnico]], [[middleware-ts]]
- Se conecta con: [[portal-residente]], [[multi-tenancy]], [[trampas-conocidas]], [[estado-modulos]]
