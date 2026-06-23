---
tags: [arquitectura, correos, mensajeria, resend, seguridad]
tipo: tecnica
fuentes: ["remediacion-auth-2026"]
fecha_creacion: 2026-06-09
fecha_actualizacion: 2026-06-23
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

## Relaciones

- Véase también: [[autenticacion-roles]], [[usuarios]], [[firebase-firestore]], [[notificaciones-residentes]]
- Depende de: [[stack-tecnico]], [[middleware-ts]]
- Se conecta con: [[portal-residente]], [[multi-tenancy]], [[trampas-conocidas]], [[estado-modulos]]
