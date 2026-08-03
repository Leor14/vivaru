---
tags: [arquitectura, marketing, landing, nextjs, rutas]
tipo: tecnica
fuentes: ["consolidacion-landing-2026", "globals-css"]
fecha_creacion: 2026-05-31
fecha_actualizacion: 2026-08-02
---

# Landing Marketing — Route Group (marketing)

El sitio público de Vivaru vive dentro del mismo repo que el SaaS (`vivaru/`), bajo el route group `(marketing)`. La decisión de consolidar el landing en el SaaS se tomó en mayo 2026 para que `grupovivaru.com` sirva ambos desde un único proyecto Firebase App Hosting.

El repo `vivaru-landing/` (Next.js 14 + Tailwind v3) queda **deprecado** — solo se usa como referencia visual en `vivaru-landing.vercel.app`.

## Rutas del route group

| Ruta | Archivo | Descripción |
|---|---|---|
| `/mx` | `src/app/(marketing)/mx/page.tsx` | Landing principal México — ensambla todas las secciones |
| `/` | `src/app/(marketing)/page.tsx` | Redirect o página raíz (comparte layout) |
| `/diagnostico` | `src/app/(marketing)/diagnostico/page.tsx` | Lead magnet — cuestionario de madurez digital. Ver [[diagnostico]] |
| `/legal/privacidad` | `src/app/(marketing)/legal/privacidad/page.tsx` | Política de privacidad |
| `/legal/terminos` | `src/app/(marketing)/legal/terminos/page.tsx` | Términos de uso |
| `/legal/datos` | `src/app/(marketing)/legal/datos/page.tsx` | Tratamiento de datos |

## Layout del route group

`src/app/(marketing)/layout.tsx` aplica el wrapper `.marketing-theme` sobre todos los hijos. Este div activa los tokens HSL de shadcn scoped para el landing, aislándolos de los tokens del SaaS. Ver [[tailwind-v4-spacing-fix]] y [[tokens-color]].

```tsx
// (marketing)/layout.tsx — fragmento clave
export default function MarketingLayout({ children }) {
  return (
    <PostHogProvider>
      <div className="marketing-theme">
        {children}
        <CookieBannerLoader />
      </div>
    </PostHogProvider>
  );
}
```

El `.marketing-theme` también es el selector padre para los overrides de `max-w-*` que corrigen el conflicto Tailwind v4 `--spacing-*`. Sin él, los headings y párrafos se renderizan a 8–96px de ancho. Ver [[tailwind-v4-spacing-fix]].

## Componentes de sección — página /mx

La página `/mx` ensambla las secciones en este orden:

| Componente | Archivo | Descripción |
|---|---|---|
| `<Topbar>` | `Topbar.tsx` | Nav fija: logo, enlaces (ocultos Sprint 1), CTA demo + login |
| `<Hero>` | `Hero.tsx` | Headline, descripción, trust line, screenshots de producto |
| `<ImpactBand>` | `ImpactBand.tsx` | Franja de 3 métricas de impacto (números grandes) |
| `<Pain>` | `Pain.tsx` | 4 dolores del administrador + lead magnet promo (Diagnóstico) |
| `<Solution>` | `Solution.tsx` | 4 pilares: Finanzas, Comunidad, Operaciones, Gobernanza |
| `<Perspectives>` | `Perspectives.tsx` | Tabs por rol: Admin / Residente / Portería con screenshots |
| `<MultiConjunto>` | `MultiConjunto.tsx` | Demo visual de multi-conjunto (Santa María + Las Bromelias) |
| `<Differentiators>` | `Differentiators.tsx` | 6 diferenciadores competitivos vs Residentify / Excel |
| `<Pricing>` | `Pricing.tsx` | 3 planes sin precios — pill "Cotización a medida" |
| `<Pilot>` | `Pilot.tsx` | **OCULTO** — HITL H4/H5 pendiente. No mostrar. |
| `<FAQ>` | `FAQ.tsx` | Preguntas frecuentes — acordeón |
| `<FinalCTA>` | `FinalCTA.tsx` | CTA final antes del footer |
| `<Footer>` | `Footer.tsx` | Links, legal, créditos Qintilab S.A.S. |

## Componentes de UI del landing (shadcn copies)

Viven en `src/components/marketing/ui/` — copias aisladas de shadcn para no contaminar el SaaS:

- `accordion.tsx` — FAQ section
- `button.tsx` — CTA buttons (usa @base-ui/react internamente)
- `card.tsx` — cards genéricas
- `dialog.tsx` — DemoDialog
- `input.tsx` — formulario de demo
- `label.tsx` — labels de formulario
- `sheet.tsx` — menú mobile (oculto Sprint 1)
- `tabs.tsx` — Perspectives tabs
- `tooltip.tsx` — tooltips de marketing

## Lib de marketing

`src/lib/marketing/` contiene las utilidades exclusivas del landing:

| Archivo | Descripción |
|---|---|
| `analytics.ts` | Wrapper `track()` sobre PostHog para eventos de conversión |
| `hooks.ts` | `useInView()`, `useReducedMotion()` — animaciones de entrada |
| `tokens.ts` | Design tokens de referencia (tipados para TypeScript) |
| `diagnostic-schema.ts` | Esquema Zod del cuestionario de diagnóstico |
| `diagnostic-score.ts` | Lógica de puntuación del diagnóstico |
| `diagnostic-recommendations.ts` | Recomendaciones personalizadas por resultado |
| `markdown.ts` | Parseo de markdown para contenido legal |
| `emails/lead-notification.ts` | Notificación de nuevo lead al equipo interno |

## Assets de producto

`public/product/` contiene los screenshots reales del SaaS usados en el landing. Se sirven en **WebP ya redimensionado**, no en PNG.

| Archivo | Uso | Ancho | Tenant |
|---|---|---|---|
| `hero-admin-dashboard.webp` | Hero — panel del admin | 1200 | Santa María ✓ |
| `hero-resident-reservations.webp` | Hero — móvil superpuesto | 390 | Santa María ✓ |
| `perspectives-admin-*.webp` | Perspectives, pestaña Admin | 1440 | Santa María ✓ |
| `perspectives-resident-*.webp` | Perspectives, pestaña Residente | 390-780 | Santa María ✓ |
| `perspectives-porteria-*.webp` | Perspectives, pestaña Portería | 1024 | El Nogal (no hay guardia en Santa María) |
| `perspectives-comite-*.webp` | Perspectives, pestaña Comité | 1440 | Santa María ✓ |
| `multiconjunto-marca-{a,b}.webp` | [[multi-tenancy\|Multiconjunto]] — dos marcas | 1200 | Santa María ✓ |
| `trust-{migracion,respaldos,soporte}.webp` | Confianza y onboarding | 1280 | Santa María ✓ |

⚠️ **Regla de screenshots:** Solo usar tenant "Santa María", salvo Portería. Nunca "Las Palmas" u otros tenants.

### Pipeline: capturar → optimizar

`tests/capture-product-screenshots.spec.ts` (Playwright, `deviceScaleFactor: 2`) genera los PNG contra staging. Después hay que correr **siempre**:

```bash
npm run images:optimize
```

`scripts/optimize-product-images.mjs` redimensiona al ancho de la tabla de arriba (con `withoutEnlargement`, porque varias capturas ya nacen más pequeñas que su tope), convierte a WebP q90 y borra el PNG. El landing importa `.webp`: sin este paso las capturas nuevas no se ven.

El paso no es opcional ni cosmético. En App Hosting el optimizador de Next está apagado (ver [[trampas-conocidas]] y [[dominios-app-hosting]]), así que `public/` llega crudo al navegador. Los PNG @2x originales pesaban **7,6 MB** —hasta 2880 px de ancho para tarjetas que se pintan a 300-770 px—; en WebP redimensionado son **1,0 MB** (−86 %).

Por qué WebP y no otra cosa, medido sobre estas mismas capturas: JPEG **aumenta** el peso (son interfaces con mucho color plano y bordes duros); el PNG cuantizado se queda en −79 % y tiene una trampa —redimensionar antes de cuantizar puede subir el peso, porque la interpolación inventa colores y rompe la paleta—; AVIF baja algo más pero emborrona el texto pequeño, que es justo lo que estas capturas venden.

Los anchos de destino salen de medir la maqueta, no de una regla general: el contenedor del landing es `max-width: 1280px` con `padding-inline: 2rem` (ver [[layout-patterns]] y [[tailwind-v4-spacing-fix]]), así que el ancho útil tope es 1216 px y ninguna captura necesita más de 1440 px ni siquiera en pantallas @2x. `sharp` hace la conversión y viene ya instalado como dependencia de Next ([[stack-tecnico]]).

## Proveedores

`src/components/marketing/providers/PostHogProvider.tsx` — inicializa PostHog para analítica de marketing. Se monta en el layout del route group.

## Restricciones de negocio activas

- **Precios:** `Pricing.tsx` solo muestra "Cotización a medida" — nunca precios numéricos
- **Badge "Sweet Spot":** Removido intencionalmente. No re-agregar.
- **Sección Pilot:** Componente existe pero está oculto (`{false && <Pilot />}`)
- **Entidad legal:** Siempre "Qintilab S.A.S." (NIT 902060869-1) en Footer y Legales

## HITLs pendientes del landing

| ID | Descripción |
|---|---|
| H7 | Screenshot pendiente para Perspectives tab "Portería" (panel tablet) |
| H11 | Generación de PDF del diagnóstico |
| H14 | Actualizar TXT record DNS en Google Domains para Firebase verification |

## Relaciones

- Véase también: [[estructura-app-router]], [[tailwind-v4-spacing-fix]], [[stack-tecnico]]
- Depende de: [[tokens-color]], [[tipografia]], [[animaciones]]
- Se conecta con: [[diagnostico]], [[absolute-bans]], [[roadmap-tecnico]]

## Fuentes

- [[consolidacion-landing-2026]], [[globals-css]]
