---
tags: [patron, mobile, ios, safari]
tipo: tecnica
fuentes: ["DESIGN.md", "PRODUCT.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Mobile-First e iOS Safari

Colección de patrones técnicos para garantizar que los portales [[portal-residente|residente]] y [[portal-guardia|guardia]] funcionen correctamente en iOS Safari — el browser más restrictivo del ecosistema mobile.

## overflow-x: clip en lugar de hidden

El elemento `<html>` usa `overflow-x: clip` (NO `overflow-x: hidden`). La diferencia crítica: `hidden` crea un nuevo contexto de scroll container, lo que rompe `position: sticky` en todo el árbol DOM. `clip` corta el contenido sin crear ese contexto.

```css
html { overflow-x: clip; }
```

## Headers con position fixed

En mobile, los headers de página usan `position: fixed` en lugar de `position: sticky`. En iOS Safari, `sticky` presenta comportamientos inconsistentes al hacer scroll con momentum. La solución:

```css
.mobile-header { position: fixed; top: 0; left: 0; right: 0; z-index: 50; }
.mobile-content { padding-top: 57px; } /* altura del header */
```

Este patrón está aplicado en [[portal-residente]], [[portal-guardia]] y la corrección de [[configuracion]].

## createPortal para tooltips y HelpTip

Los [[componentes|HelpTip]] y otros tooltips usan `createPortal` para renderizarse fuera del árbol DOM de su contenedor. Esto evita que sean clippeados por contenedores con `overflow: hidden` o `overflow: clip`. Sin createPortal, los tooltips en listas o tarjetas quedan cortados en mobile.

## Web Share API para QR

Para compartir el QR de [[visitantes]], el patrón es:
1. `navigator.canShare({files})` — verificar soporte del dispositivo
2. `navigator.share({files: [qrBlob]})` — usar share nativo (iOS: AirDrop, WhatsApp, etc.)
3. Fallback: `link.download` — descarga directa si share no está disponible

## Dropdowns sin details/summary

Los dropdowns deben implementarse con `useState` + `useRef` para click-outside handler. El elemento nativo `<details>/<summary>` tiene comportamiento inconsistente en iOS Safari al interactuar con formularios o animaciones.

## safe-area-inset

En dispositivos con notch (iPhone X+), el footer de páginas debe respetar `safe-area-inset-bottom` para no quedar debajo de la barra de home. Fix aplicado en [[configuracion]].

## Relaciones

- Véase también: [[portal-residente]], [[portal-guardia]], [[componentes]]
- Depende de: —
- Se conecta con: [[layout-patterns]], [[drawer-pattern]], [[trampas-conocidas]], [[animaciones]]

## Fuentes

- [[design-md]], [[product-md]]
