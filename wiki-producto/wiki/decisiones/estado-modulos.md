---
tags: [decision, estado, modulos, backlog]
tipo: decision
fuentes: ["BACKLOG.md", "consolidacion-landing-2026"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-08-17
---

# Estado de Módulos

Tabla de estado actual de todos los módulos del producto. Se actualiza después de cada sesión de critique → execute → commit. Todos los módulos del catálogo de variantes ya están implementados (ver [[modulos-variantes]]): [[visitantes]], [[paquetes]], [[pqrs]], [[comunicaciones]], Gobernanza ([[reglamento]]) y [[billing|Finanzas]] (`solo_consulta`, estructural, hecho en 3 fases).

## Portal Admin (`/admin`)

| Módulo | Ruta | Estado | Notas |
|---|---|---|---|
| Dashboard | `/admin` | ✅ fixes aplicados | KPIs fluid, layout corregido |
| Residentes y Unidades | `/admin/residents` | ✅ + fusión de duplicadas | Ver [[fusion-unidades]] |
| Visitantes | `/admin/visitors` | ✅ fixes aplicados | Ver [[visitantes]] |
| Cartera (Billing) | `/admin/billing` | ✅ CRM completo (jun 2026) | Ver [[billing]], [[cartera-campanas]] |
| PQRS | `/admin/pqrs` | ✅ + editor de clasificación y capa de IA (ago 2026) | Ver [[pqrs]] |
| Usuarios | `/admin/users` | ✅ card mobile + skeleton | Ver [[usuarios]] |
| Configuración | `/admin/settings` | ✅ skeleton + footer mobile | Ver [[configuracion]] |
| Reservaciones | `/admin/reservations` | 🔲 pendiente critique | Ver [[reservaciones]] |
| Paquetería | `/admin/packages` | 🔲 pendiente critique | Ver [[paquetes]] |
| Comunicaciones | `/admin/communications` | 🔲 pendiente critique · + panel de IA tras bandera | Ver [[comunicaciones]] |
| Encuestas | `/admin/surveys` | 🔲 pendiente critique | Ver [[encuestas]] |
| Reglamento | `/admin/regulations` | 🔲 pendiente critique | Ver [[reglamento]] |
| Reportes | `/admin/reports` | 🔲 pendiente critique | Ver [[reportes]] |
| Soporte | `/admin/soporte` | ✅ productivo (ago 2026) | Ver [[soporte]] |

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
| **Bug max-w-* fix** | ✅ empujado | Comprobado el 17 ago 2026: `dcac2ce` está en `origin/master` y `origin/develop` |

## Adquisición y activación (jul–ago 2026)

| Capacidad | Estado | Notas |
|---|---|---|
| Trial self-service de 15 días | ✅ en producción | Fases 0–4. Ver [[ciclo-de-vida-tenant]] |
| Guía de puesta en marcha | ✅ en producción | 18 pasos en 4 bloques; **activación = 7 en la prueba, 10 en un cliente** (`descubre` no cuenta). Ver [[onboarding-guiado]] |
| Recorrido para clientes nuevos | ✅ en producción | `onboardingTrack: cliente` |
| `tenantOperable()` en reglas | ✅ en producción | 25 colecciones, 52 statements |
| Wizard «Inicia tu suscripción» | ✅ en producción | Sin promesa de plazo de respuesta |
| Tickets de soporte | ✅ en producción | Verificado de punta a punta. Ver [[soporte]] y [[portafolio-prd]] |
| Barrido de tokens CSS | ✅ cerrado | 20 variables declaradas. Ver [[transiciones-navegacion]] |

## Programa de IA

**Construido y en producción desde el 15 de agosto de 2026** — esta sección decía «0% construido, no existe código de IA en el repositorio» hasta el 17 de agosto, y llevaba dos semanas siendo falsa.

| Pieza | Estado | Notas |
|---|---|---|
| Plataforma `PLAT-001` | ✅ en producción | Puerta, catálogo, [[banderas-funcionalidad]], cuotas, telemetría, retención. Ver [[puerta-ia]] |
| Borrador de [[comunicaciones]] | ✅ construido · bandera apagada | Medido con dos administradores reales |
| Asistente de [[pqrs]] | ✅ construido · bandera apagada | Gold set de 152 casos; su callable **no está desplegada en producción** |
| Modo sombra de PQRS | ✅ **en producción, encendido** | Clasifica en silencio; 0 filas porque no hay tickets reales |
| Mapeo de columnas ([[onboarding-guiado]]) | ⬜ solo la bandera | Bloqueado por materia prima: `importRuns` sin encabezados sin mapear |
| Extracción de comprobantes ([[billing]]) | ⬜ solo la bandera | Producción tiene cero comprobantes |

**El límite ya no es técnico.** Producción tiene dos conjuntos reales con 0 tickets y 1 comunicación de marzo: las puertas de escala se cobran contra datos que solo existen si entra trabajo de verdad. Ver [[programa-ia]].

De las cinco PRD de IA, **una está versionada** (`docs/prd/ia/PRD-VAI-FEAT-002-asistente-pqrs.md`) y es fuente de verdad sobre su copia de Drive. Ver [[portafolio-prd]].

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
