---
tags: [fuente, producto, diseno]
tipo: fuente
fuentes: ["PRODUCT.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Fuente: PRODUCT.md

Documento de visión de producto de Vivaru. Define el propósito de la plataforma, los cuatro portales, los principios de diseño, la identidad de marca y el tono de voz.

## Contenido principal

El propósito central es digitalizar la relación administrador-residente en LATAM. El documento distingue con claridad dos usuarios primarios: el [[portal-residente|administrador del edificio]] (desktop-first, 50–500 unidades, necesita operar rápido y ver todo de un vistazo) y el residente (mobile-first, acceso ocasional, espera la misma confianza que genera WhatsApp).

Los cuatro portales documentados son: `/admin` para el administrador, `/resident` para propietarios e inquilinos, `/guard` para el guardia de seguridad con 4 funciones, y `/superadmin` para el equipo interno Vivaru. Ver [[estructura-app-router]] para el detalle de rutas.

## Principios de diseño

Los seis principios que guían toda decisión visual son:
- **Status at a glance**: el estado operativo debe ser legible sin clic adicional
- **Progressive disclosure**: mostrar lo básico primero, profundizar solo cuando el usuario lo solicite
- **Resident trust signals**: el portal del residente debe transmitir confianza institucional
- **Admin density without chaos**: el panel admin puede ser denso, pero nunca abrumador
- **Mobile-first por rol**: cada portal sigue el paradigma correcto según su contexto de uso
- **Sparse modals**: los modals son para confirmaciones simples; los flujos complejos van en [[drawer-pattern|Drawer]]

## Identidad de marca

El color primario es navy `#0B3C5D`, parte de una paleta azul-gris institucional. La tipografía combina Manrope (UI) con Fraunces (display), aunque Fraunces está suprimida dentro del shell admin. Ver [[tokens-color]] y [[tipografia]] para los valores exactos.

El tono de voz es claro sobre inteligente, formal pero cálido, con español (es-CO) como idioma principal. Las [[absolute-bans|anti-referencias]] explícitas incluyen Notion/Linear, Airbnb, fintech neon-on-dark y SAP/ERP clásico.

## Prohibiciones absolutas

PRODUCT.md establece prohibiciones de diseño cuya violación es clasificada como bug 🔴. La lista completa vive en [[absolute-bans]].

## Relaciones

- Véase también: [[design-md]], [[tokens-color]], [[tipografia]]
- Depende de: —
- Se conecta con: [[portal-residente]], [[portal-guardia]], [[superadmin]], [[estructura-app-router]]

## Fuentes

- Archivo original: `/PRODUCT.md` en el repositorio Vivaru
