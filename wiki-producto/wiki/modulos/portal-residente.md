---
tags: [modulo, residente, mobile-first]
tipo: concepto
fuentes: ["PRODUCT.md", "DESIGN.md", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Portal Residente

Portal mobile-first para propietarios e inquilinos (`/resident/*`). Es el segundo portal más importante del producto: el residente accede ocasionalmente, espera una experiencia de baja fricción y necesita señales de confianza institucional equivalentes a las de WhatsApp.

## Principios de diseño

El portal residente aplica tres principios de [[product-md]] de forma especialmente exigente:
- **Resident trust signals**: cada pantalla debe transmitir que el conjunto es profesional y confiable
- **Mobile-first por rol**: diseñado para 375px, no adaptado desde desktop
- **Progressive disclosure**: mostrar el estado más relevante primero, detalles solo al pedirlos

El [[layout-patterns|patrón de página residente]] es: Card → CardTitle+Desc → hero section → staggered cards. Ver [[layout-patterns]].

## Módulos accesibles desde el portal

El residente puede acceder a:
- Estado de su cuenta en [[billing]] (ver si está al día, pendiente o vencido)
- Subir comprobante de pago (genera `PaymentReceipt` en estado `pending`)
- Solicitar reservas de amenidades y mudanzas → [[reservaciones]]
- Crear y seguir tickets → [[pqrs]]
- Ver paquetes pendientes → [[paquetes]]
- Pre-registrar visitas y compartir QR → [[visitantes]]
- Leer comunicados del administrador → [[comunicaciones]]
- Consultar el reglamento y actas → [[reglamento]]

## Estado: ✅ fixes mobile aplicados

Los fixes corrigen headers con `position: fixed` + `pt-[57px]` en el contenido (la alternativa `sticky` no es confiable en iOS Safari). Ver [[mobile-first-ios]].

## Onboarding del residente

El primer acceso usa contraseña temporal gestionada por [[usuarios]]. El [[middleware-ts]] redirige a `/resident/change-password-required` si `mustChangePassword=true`. Ver [[autenticacion-roles]].

## Relaciones

- Véase también: [[mobile-first-ios]], [[layout-patterns]], [[product-md]]
- Depende de: [[autenticacion-roles]], [[middleware-ts]]
- Se conecta con: [[billing]], [[pqrs]], [[reservaciones]], [[visitantes]], [[paquetes]], [[comunicaciones]]

## Fuentes

- [[product-md]], [[design-md]], [[backlog-md]]
