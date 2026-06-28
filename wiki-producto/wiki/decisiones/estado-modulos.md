---
tags: [decision, estado, modulos, backlog]
tipo: decision
fuentes: ["BACKLOG.md", "consolidacion-landing-2026"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-06-23
---

# Estado de Módulos

Tabla de estado actual de todos los módulos del producto. Se actualiza después de cada sesión de critique → execute → commit. Algunos módulos operan en variantes configurables por conjunto (ver [[modulos-variantes]]): ya implementados en [[visitantes]], [[paquetes]] y [[pqrs]]; sigue [[comunicaciones]].

## Portal Admin (`/admin`)

| Módulo | Ruta | Estado | Notas |
|---|---|---|---|
| Dashboard | `/admin` | ✅ fixes aplicados | KPIs fluid, layout corregido |
| Residentes y Unidades | `/admin/residents` | ✅ + fusión de duplicadas | Ver [[fusion-unidades]] |
| Visitantes | `/admin/visitors` | ✅ fixes aplicados | Ver [[visitantes]] |
| Cartera (Billing) | `/admin/billing` | ✅ CRM completo (jun 2026) | Ver [[billing]], [[cartera-campanas]] |
| PQRS | `/admin/pqrs` | ✅ tabla mobile corregida | Ver [[pqrs]] |
| Usuarios | `/admin/users` | ✅ card mobile + skeleton | Ver [[usuarios]] |
| Configuración | `/admin/settings` | ✅ skeleton + footer mobile | Ver [[configuracion]] |
| Reservaciones | `/admin/reservations` | 🔲 pendiente critique | Ver [[reservaciones]] |
| Paquetería | `/admin/packages` | 🔲 pendiente critique | Ver [[paquetes]] |
| Comunicaciones | `/admin/communications` | 🔲 pendiente critique | Ver [[comunicaciones]] |
| Encuestas | `/admin/surveys` | 🔲 pendiente critique | Ver [[encuestas]] |
| Reglamento | `/admin/regulations` | 🔲 pendiente critique | Ver [[reglamento]] |
| Reportes | `/admin/reports` | 🔲 pendiente critique | Ver [[reportes]] |

## Portal Residente (`/resident`)

| Módulo | Estado | Notas |
|---|---|---|
| Portal completo | ✅ fixes mobile aplicados | Ver [[portal-residente]] |

## Portal Guardia (`/guard`)

| Módulo | Estado | Notas |
|---|---|---|
| Portal completo | ✅ bottom nav + calendario | Ver [[portal-guardia]] |

## Landing Marketing — Route Group `(marketing)`

Estado del sitio público (`grupovivaru.com`). Ver [[landing-marketing]] para detalle de componentes.

| Sección / Página | Estado | Notas |
|---|---|---|
| Consolidación landing → SaaS | ✅ completado | Repo `vivaru-landing/` deprecado |
| Topbar | ✅ nav links ocultos (Sprint 1) | Botón login → `/login` |
| Hero | ✅ trust line actualizada | "Demo y Activación en menos de 72h" |
| ImpactBand | ✅ tipografía rebalanceada | — |
| Pain / Dolor | ✅ funcional | Incluye lead magnet promo |
| Solution | ✅ 4 pilares funcionales | — |
| Perspectives | ✅ tabs + screenshots | H7: screenshot Portería pendiente |
| MultiConjunto | ✅ funcional | Solo tenant Santa María |
| Differentiators | ✅ 6 diferenciadores | — |
| Pricing | ✅ 3 planes sin precios | "Cotización a medida" pill |
| Pilot | 🔒 OCULTO — HITL H4/H5 | No mostrar hasta resolución |
| FAQ | ✅ acordeón funcional | — |
| FinalCTA | ✅ funcional | — |
| Footer | ✅ funcional | Entidad: Qintilab S.A.S. |
| Diagnóstico `/diagnostico` | ✅ cuestionario funcional | H11: PDF pendiente |
| Legales `/legal/*` | ✅ funcional | Privacidad, Términos, Datos |
| **Bug max-w-* fix** | ⚠️ commit `dcac2ce` pendiente push | `git push origin master` requerido |

## Flujo de critique

Cada módulo pendiente debe pasar por:
1. **Critique**: identificar violaciones de [[absolute-bans]], problemas con [[tokens-color]], issues de [[mobile-first-ios]]
2. **Execute**: aplicar correcciones en el código
3. **Commit**: registrar cambios y actualizar esta tabla

## Relaciones

- Véase también: [[backlog-md]], [[absolute-bans]], [[landing-marketing]]
- Depende de: —
- Se conecta con: todos los módulos en `wiki/modulos/`, [[diagnostico]]

## Fuentes

- [[backlog-md]], [[consolidacion-landing-2026]]
