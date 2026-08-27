---
tags: [fuente, landing, marketing, tailwind, sesion]
tipo: fuente
fuentes: ["log.md [2026-05-31]", "commits c586740 y dcac2ce"]
fecha_creacion: 2026-08-27
fecha_actualizacion: 2026-08-27
---

# `consolidacion-landing-2026` — la sesión que metió el landing en el SaaS

**Es una sesión de trabajo del 31 de mayo de 2026, no un fichero**, y por eso nunca estuvo en
`raw/`. Ocho páginas la citan como fuente y durante meses no hubo nada al otro lado. El original sí
existe y es comprobable: la entrada `[2026-05-31] UPDATE | Consolidación landing + fix Tailwind v4`
de [[log]], y dos commits en el repositorio.

## Qué se hizo

El landing vivía en un repositorio aparte, `vivaru-landing/` (Next.js 14 + Tailwind v3). La sesión
lo trasladó **dentro de `vivaru/`, al route group `(marketing)`**, para que `grupovivaru.com`
sirviera el sitio público y el SaaS desde un único proyecto de Firebase App Hosting; el repositorio
viejo quedó deprecado como referencia visual. Rutas, layout y componentes están en
[[landing-marketing]], y el salto de versiones que trajo consigo —Next.js 15, React 19, Tailwind
v4— en [[stack-tecnico]].

Al migrar apareció un defecto de CSS que dejaba el texto ilegible palabra por palabra: los tokens
`--spacing-*` declarados en [[globals-css]] colisionan con las utilidades `max-w-*` de Tailwind v4.
Se intentó primero con `@utility` —commit **`c586740`**, que no funcionó porque v4 fusiona la regla
declarada con la autogenerada— y se resolvió con selectores `.marketing-theme` scoped —commit
**`dcac2ce`**—. Ambos del 1 de junio de 2026. El diagnóstico completo está en
[[tailwind-v4-spacing-fix]].

## Qué produjo en la wiki

| Páginas creadas | Páginas actualizadas |
|---|---|
| [[landing-marketing]], [[tailwind-v4-spacing-fix]], [[diagnostico]] | [[estructura-app-router]], [[stack-tecnico]], [[tokens-color]], [[estado-modulos]], [[trampas-conocidas]], [[index]] |

Dejó además dos trampas de Tailwind v4 registradas —`@utility` fusionado y clases de color en
camelCase—, 17 componentes de sección del landing, 8 componentes de `components/marketing/ui/` y
tres HITL pendientes (H7, H11, H14). El lead magnet `/diagnostico` nació en esta sesión.

## Cómo leerla

Esta página **resume el registro, no lo reemplaza**: cuando haga falta el detalle textual, la
entrada del [[log]] y los dos commits son el original y mandan sobre lo escrito aquí. Es la misma
convención con la que [[globals-css]] remite a su fichero.

## Relaciones

- Véase también: [[design-md]], [[product-md]], [[globals-css]]
- Se conecta con: [[landing-marketing]], [[tailwind-v4-spacing-fix]], [[diagnostico]]

## Fuentes

- Entrada `[2026-05-31]` de [[log]] y los commits `c586740` y `dcac2ce` del repositorio de Vivaru.
  **Son el original y mandan sobre esta página.**
