---
tags: [decision, trampas, bugs, antipatrones]
tipo: decision
fuentes: ["DESIGN.md", "PRODUCT.md", "consolidacion-landing-2026"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-31
---

# Trampas Conocidas

Errores que han ocurrido o que tienen alta probabilidad de ocurrir durante el desarrollo. Documentados para no repetirlos.

## replace_all con acentos

Usar `replace_all` con palabras acentuadas en el editor puede corromper plurales o palabras que comparten la raíz. Ejemplo: reemplazar `"configuración"` puede afectar `"configuraciones"`. Siempre proporcionar suficiente contexto en el string a reemplazar para que sea único.

## authorizationType sin acento

El valor `"larga_duracion"` en `authorizationType` NO lleva acento (es `duracion`, no `duración`). Si se escribe con acento en el código, la comparación falla silenciosamente. Ver [[domain-types]].

## Locale: siempre es-CO, nunca es-MX en código

El locale para fechas y números en el código es `es-CO`, nunca `es-MX`. El comportamiento en producción: aunque hay una inconsistencia histórica (`toLocaleDateString` usa `es-MX` en algunos lugares), el estándar a seguir en código nuevo es `es-CO`. Ver [[product-md]] para el tono de voz.

## React.forwardRef obligatorio

Cualquier componente de input usado con React Hook Form necesita `React.forwardRef`. Sin esto, `register()` falla silenciosamente y los campos no se validan. Ver [[form-validation]].

## Git locks desde sandbox

Al operar desde el sandbox del agente, si se intenta hacer push directamente se generan archivos `.git/HEAD.lock` y `.git/index.lock` que corrompen el repositorio. El usuario siempre debe hacer el push desde su terminal local.

## Sticky no confiable en iOS Safari

`position: sticky` en iOS Safari tiene comportamiento inconsistente bajo scroll con momentum. La solución establecida es `position: fixed` con `padding-top` equivalente al alto del header. Ver [[mobile-first-ios]].

## overflow-x: hidden rompe sticky

Usar `overflow-x: hidden` en `<html>` o en contenedores ancestros crea un nuevo scroll container que rompe `position: sticky` en todos los descendientes. Usar `overflow-x: clip` en su lugar. Ver [[mobile-first-ios]].

## Transiciones con 'all'

El uso de `transition: all` está prohibido per [[absolute-bans]], pero algunos componentes viejos todavía lo tienen. Al tocar un componente existente, verificar y reemplazar por propiedades específicas. Ver [[animaciones]].

## Tailwind v4: @utility no sobreescribe tokens --spacing-*

En Tailwind v4, `@utility max-w-xl { max-width: 36rem; }` **no funciona** para sobreescribir un token `--spacing-xl` del `@theme`. Tailwind fusiona ambas declaraciones en un solo bloque CSS y la del token siempre gana por aparecer última:

```css
/* CSS generado — la segunda declaración siempre gana */
.max-w-xl { max-width: 36rem; max-width: var(--spacing-xl); }
```

La solución correcta es usar selectores scoped con mayor especificidad (`.marketing-theme .max-w-xl`), que también son CSS no-layered y superan `@layer utilities`. Ver [[tailwind-v4-spacing-fix]] para el diagnóstico completo y el fix en producción.

## Tailwind v4: nombres de clases de color en kebab-case

En Tailwind v3, el config generaba `bg-brand-greenResident` desde la clave `greenResident`. En Tailwind v4, la clase se genera desde el nombre de la variable CSS: `--color-brand-green-resident` → `bg-brand-green-resident`. Los nombres camelCase del v3 generan clase vacía sin error. Siempre verificar kebab-case en nombres de color al migrar desde v3. Ver [[tokens-color]].

## Relaciones

- Véase también: [[absolute-bans]], [[mobile-first-ios]], [[form-validation]], [[tailwind-v4-spacing-fix]]
- Depende de: —
- Se conecta con: [[animaciones]], [[domain-types]], [[firebase-firestore]], [[stack-tecnico]], [[tokens-color]]

## Fuentes

- [[design-md]], [[product-md]], [[consolidacion-landing-2026]]
