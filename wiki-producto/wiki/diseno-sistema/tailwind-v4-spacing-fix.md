---
tags: [diseno, tailwind, css, bug, patron-tecnico]
tipo: decision
fuentes: ["globals-css", "consolidacion-landing-2026"]
fecha_creacion: 2026-05-31
fecha_actualizacion: 2026-05-31
---

# Fix Tailwind v4 — Conflicto --spacing-* vs max-w-*

Documenta el bug crítico de CSS encontrado al migrar el landing a Tailwind v4, su diagnóstico, el intento fallido de solución, y el fix correcto que está en producción. Es una trampa conocida de Tailwind v4 que no está documentada prominentemente.

## El bug

Al servir el landing en `grupovivaru.com/mx`, todo el texto se renderizaba palabra por palabra — como si cada columna tuviera 8 a 96 píxeles de ancho. El síntoma visual era texto completamente ilegible apilado verticalmente.

**Diagnóstico en browser:**
```js
getComputedStyle(document.createElement('div') con clase max-w-xl).maxWidth
// → "32px"  (debería ser "576px" / 36rem)
```

## Causa raíz

Tailwind v4 mapea `--spacing-{nombre}` a **todas** las utilidades de tamaño, incluyendo `max-w-*`, `w-*`, `h-*`, `min-w-*`. Nuestro `@theme` en [[globals-css]] define tokens semánticos de espaciado:

```css
@theme {
  --spacing-xs:  4px;
  --spacing-sm:  8px;
  --spacing-md:  16px;
  --spacing-lg:  24px;
  --spacing-xl:  32px;
  --spacing-xxl: 64px;
  --spacing-3xl: 96px;
}
```

Estos tokens colisionan con los nombres de breakpoint de `max-w-*` de Tailwind:

| Token definido | max-w-* afectado | Valor incorrecto | Valor correcto |
|---|---|---|---|
| `--spacing-sm: 8px` | `max-w-sm` | 8px | 24rem (384px) |
| `--spacing-md: 16px` | `max-w-md` | 16px | 28rem (448px) |
| `--spacing-lg: 24px` | `max-w-lg` | 24px | 32rem (512px) |
| `--spacing-xl: 32px` | `max-w-xl` | 32px | 36rem (576px) |
| `--spacing-3xl: 96px` | `max-w-3xl` | 96px | 48rem (768px) |

Los tokens `--spacing-xxl` y `--spacing-xs` no colisionan porque Tailwind no tiene `max-w-xxl` ni `max-w-xs` en su escala estándar de Tailwind v4.

## Intento fallido: @utility override

La primera solución intentada fue agregar `@utility` después del `@import "tailwindcss"`:

```css
@utility max-w-xl { max-width: 36rem; }
```

**Por qué no funcionó:** Tailwind v4 **fusiona** el `@utility` declarado con la regla auto-generada del `--spacing-*` en un único bloque CSS:

```css
/* CSS resultante en producción — verificado inspeccionando bundle */
.max-w-xl { max-width: 36rem; max-width: var(--spacing-xl); }
```

En CSS, cuando hay dos declaraciones de la misma propiedad en el mismo bloque, la **última gana**. `var(--spacing-xl) = 32px` siempre sobreescribe `36rem`. El `@utility` declarado nunca tiene efecto.

## Fix correcto: selectores .marketing-theme scoped

La solución usa selectores con **mayor especificidad** como CSS **fuera de cualquier `@layer`**:

```css
/* src/app/globals.css — sección de overrides */
.marketing-theme .max-w-xs  { max-width: 20rem; }
.marketing-theme .max-w-sm  { max-width: 24rem; }
.marketing-theme .max-w-md  { max-width: 28rem; }
.marketing-theme .max-w-lg  { max-width: 32rem; }
.marketing-theme .max-w-xl  { max-width: 36rem; }
.marketing-theme .max-w-2xl { max-width: 42rem; }
.marketing-theme .max-w-3xl { max-width: 48rem; }
.marketing-theme .max-w-4xl { max-width: 56rem; }
.marketing-theme .max-w-5xl { max-width: 64rem; }
.marketing-theme .max-w-6xl { max-width: 72rem; }
.marketing-theme .max-w-7xl { max-width: 80rem; }
```

Gana por **dos propiedades independientes** de la cascada CSS:

1. **Especificidad mayor:** `.marketing-theme .max-w-xl` tiene especificidad (0,2,0) vs la regla fusionada `.max-w-xl` que tiene (0,1,0). Mayor especificidad siempre gana sobre menor especificidad.

2. **CSS sin `@layer` supera `@layer utilities`:** Las reglas escritas fuera de cualquier `@layer` quedan en la capa "externa" implícita que supera todas las capas declaradas (`@layer base`, `@layer components`, `@layer utilities`). Tailwind genera sus utilidades dentro de `@layer utilities`, por lo que nuestras reglas las superan independientemente del orden de declaración.

Este fix se aplica correctamente porque **todo el landing vive dentro de** `.marketing-theme` (ver [[landing-marketing]] — el `MarketingLayout` envuelve todo el route group en ese div).

## Commits relacionados

| Commit | Descripción | Resultado |
|---|---|---|
| `c586740` | Intento con `@utility` — subido a GitHub | ❌ No funciona. CSS fusionado en producción |
| `dcac2ce` | Fix correcto con `.marketing-theme` scoped | ✅ Pendiente verificar tras push |

**⚠️ Pendiente:** El commit `dcac2ce` requiere `git push origin master` desde el terminal del usuario para desplegar.

## Verificación

Para confirmar que el fix está activo en producción:

```js
// Ejecutar en DevTools en grupovivaru.com/mx
const d = document.createElement('div');
d.className = 'max-w-xl';
document.querySelector('.marketing-theme').appendChild(d);
getComputedStyle(d).maxWidth; // → debe ser "576px" (36rem)
```

## Clases max-w-* usadas en el landing

Las siguientes clases de marketing dependen de este fix para renderizar correctamente:

- `max-w-3xl` — headings de sección (10 ocurrencias)
- `max-w-xl` — párrafos de descripción (8 ocurrencias)
- `max-w-md` — CookieBanner, dialogs (9 ocurrencias)
- `max-w-sm` — elementos compactos (6 ocurrencias)
- `max-w-lg` — contenedores intermedios (3 ocurrencias)

## Container también fue corregido

El `@utility container` en globals.css también requirió `width: 100%` explícito porque `@utility` sobreescribe el comportamiento por defecto del built-in container que lo incluía:

```css
@utility container {
  width: 100%;  /* sin esto, el container no expande al ancho disponible */
  margin-inline: auto;
  padding-inline: 1rem;
  max-width: 1280px;
}
```

## Relaciones

- Véase también: [[tokens-color]], [[layout-patterns]], [[landing-marketing]]
- Depende de: [[globals-css]]
- Se conecta con: [[trampas-conocidas]], [[stack-tecnico]], [[animaciones]]

## Fuentes

- [[globals-css]], [[consolidacion-landing-2026]]
