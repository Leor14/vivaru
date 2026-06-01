---
tags: [arquitectura, marketing, landing, nextjs, rutas]
tipo: tecnica
fuentes: ["consolidacion-landing-2026", "globals-css"]
fecha_creacion: 2026-05-31
fecha_actualizacion: 2026-05-31
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

`public/product/` contiene los screenshots reales del SaaS usados en el landing:

| Archivo | Uso | Tenant |
|---|---|---|
| `hero-admin-dashboard.png` | Hero — screenshot admin | Santa María ✓ |
| `hero-resident-home.png` | Hero — screenshot residente | Santa María ✓ |
| `alt-admin-reservations.png` | Hero — screenshot alternativo | Santa María ✓ |
| `alt-resident-account.png` | Hero — screenshot alternativo | Santa María ✓ |
| `perspectives-admin-cartera.png` | Perspectives tab Admin | Santa María ✓ |
| `perspectives-resident-visitor.png` | Perspectives tab Residente | Santa María ✓ |

⚠️ **Regla de screenshots:** Solo usar tenant "Santa María". Nunca "Las Palmas" u otros tenants.

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
