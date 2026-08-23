---
tags: [decision, estado, modulos, backlog]
tipo: decision
fuentes: ["BACKLOG.md", "consolidacion-landing-2026", "FIN-001", "lote-habitanto"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-08-23
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

## Vivaru Finance y REVOPS — en PRODUCCIÓN (ago 2026)

| Capacidad | Estado | Notas |
|---|---|---|
| `FIN-000` — Storage con filtro de rol | ✅ en producción (17 ago) | Por carpeta y no por árbol. Ver [[integridad-financiera]] |
| `FIN-001` — un solo comando de pago | ✅ en producción (18 ago) | Transaccional e idempotente; su reverso deshace los tres registros |
| El recibo dentro de la transacción | ✅ en producción (20 ago) | Y revertir lo anula. **Lo emite el servidor, no el navegador** |
| **Lo fiscal FUERA del alcance** | ✅ retirado (19 ago) | La factura la emite el cliente. El SRI de Ecuador **ya no existe en el código** de ninguno de los dos ambientes — no buscarlo |
| `SUP-001` — responsable y primera respuesta | ✅ en producción (18 ago) | Ver [[soporte]] |
| `REVOPS-001E` — propiedad comercial del lead | ✅ en producción (17 ago) | Quién es dueño de cada lead y quién vendió cada conjunto |
| `REVOPS-001A` — atribución y consentimiento | ✅ en producción (18 ago) | `acceptedAt` lo pone el servidor |
| Precio de plan cableado | ✅ en producción (19 ago) | Primera mitad de `REVOPS-001C` |
| País y moneda al crear un conjunto | ✅ en producción (19 ago) | **No corrige los nueve anteriores**: 6 sin moneda y 4 sin país. Ver [[ciclo-de-vida-tenant]] |
| Borrar a un residente le quita el acceso | ✅ en producción (19 ago) | Antes seguía dentro con su sesión viva |
| Integración con Albert CRM | ✅ tenant dado de alta (22 ago) | Ver [[integracion-albert]] |

## El lote de propiedad horizontal — EN PRODUCCIÓN desde el 23 de agosto de 2026

**Esta sección decía «construido y SIN desplegar» hasta el 23 de agosto.** Dejó de ser cierto esa
madrugada: `master` pasó de `d17478d` a `f16927d` en un solo movimiento de **67 commits**, el
primero desde el 20 de agosto.

**Casi todo sigue detrás de una [[banderas-funcionalidad|bandera apagada]]**, así que estar en
producción **no significa que un usuario lo vea**. Las cinco banderas de producto no tienen
documento en `featureFlags`, de modo que resuelven al default del catálogo.

| Pieza | Bandera | Notas |
|---|---|---|
| Decimales por moneda | **sin bandera — se ve** | MXN y USD muestran sus centavos; COP sigue sin ellos. De los nueve conjuntos, **tres tienen MXN y solo uno está activo** |
| Vocabulario por país | **sin bandera — se ve** | El término lo decide el país del conjunto **y la audiencia**. Solo cambia en los cuatro conjuntos que tienen `country` |
| `PLAT-002` — la autoridad del admin es su membresía | **sin bandera** | **La única del lote que no se revierte apagando nada.** Abre el multi-conjunto |
| `FIX-001` entrega 1 — reglas de reserva en servidor | `producto-reservas-servidor` | La compuerta de morosos existía y **solo se comprobaba en el cliente**. Ver [[reservaciones]] |
| `PLAT-001` — coeficiente y cobro por reparto | `producto-cobro-por-coeficiente` | Ver [[cartera-campanas]] |
| `FEAT-003` — registro de proveedores | `producto-registro-proveedores` | Datos bancarios que el residente no ve nunca |
| `PLAT-003` entregas 1a y 1b | `producto-plan-de-cuentas` · `producto-concepto-al-libro` | El concepto del cargo llega al libro y el recaudo se reparte. Ver [[integridad-financiera]] §5 |
| `PLAT-003` entrega 2 | las mismas | `accountCode` en cargos y egresos, el formulario del plan, **R9** —los informes agrupan por cuenta y las etiquetas salen del plan— y el aviso de R8 |
| `PLAT-003` 1b-i — la exclusión mira el origen | **sin bandera — se ve** | **Lo único que cambia una cifra:** Las Playas pasa de 129.000 a 127.500, que es lo que recaudó. Corrige un doble conteo que **ya existía**. Confirmado en producción el 23 de agosto |
| Validación de `crmRef` | sin bandera | Ver [[integracion-albert]] |

**Una nota de método que esta misma tabla ganó.** La fila del 1b-i **ya decía** que Las Playas
pasaría de 129.000 a 127.500. Al desplegar, quien lo hizo dio ese cambio por «inerte» y lo
redescubrió midiendo, como si fuera una sorpresa. **La respuesta estaba escrita aquí desde el
22.** Es el argumento entero de tener wiki: no sirve de nada si no se lee antes de afirmar.

**Cómo se comprobó que el resto es inerte**, porque «inerte» es una predicción y no un hecho: se
aplicaron **las dos reglas de exclusión, la vieja y la nueva, sobre los 89 asientos de
producción**, y se contó cuántos cambian de lado. Cambió **uno**. Comparar el estado financiero
antes y después no habría probado nada — el «antes» se calcula con el código nuevo.

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
