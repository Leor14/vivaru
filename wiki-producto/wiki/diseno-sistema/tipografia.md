---
tags: [diseno, tipografia, fuentes]
tipo: herramienta
fuentes: ["DESIGN.md", "PRODUCT.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Tipografía

Sistema tipográfico de Vivaru basado en dos fuentes: Manrope para toda la UI y Fraunces para elementos de display. La combinación crea un contraste entre lo funcional (Manrope, geométrica, legible) y lo cálido (Fraunces, serif variable con eje de redondez).

## Fuentes y variables CSS

| Variable | Fuente | Uso |
|---|---|---|
| `--font-sans` | Manrope | Todo el UI — cuerpo, botones, etiquetas, tablas |
| `--font-display` | Fraunces | h1/h2/h3 globales, marketing |

**Regla crítica**: Fraunces está suprimida dentro de `.admin-shell`. El portal admin usa Manrope para todo, incluyendo los títulos de página. Fraunces solo aparece en el [[portal-residente]] y el landing. Ver [[layout-patterns]].

## Escala tipográfica

| Clase | Tamaño | Peso | Uso |
|---|---|---|---|
| `.text-display` | 22px | 500 | Títulos de sección mayores |
| `.text-heading` | 18px | 500 | Títulos de card, modal |
| `.text-subhead` | 16px | 500 | Subtítulos, headers de tabla |
| `.text-body` | 13px | 400 | Cuerpo de texto general |
| `.text-label` | 10px | 500 | Etiquetas, badges, meta |

## KPI Fluid

Para los indicadores numéricos del [[dashboard-admin]] y [[billing]], existen tres variantes de tamaño responsivo que escalan según el viewport:
- `kpi-value-fluid`: tamaño estándar para KPIs secundarios
- `kpi-value-fluid-xl`: para el KPI principal del dashboard
- `kpi-value-fluid-compact`: para grids muy densos o mobile

La fluidez usa `clamp()` de CSS para escalar entre los breakpoints sin saltos abruptos.

## Jerarquía en admin vs residente

El [[portal-residente|portal residente]] usa la jerarquía completa (Fraunces display + Manrope body). El portal admin solo usa Manrope en toda la escala, priorizando la legibilidad funcional sobre la expresividad visual.

## Relaciones

- Véase también: [[design-md]], [[tokens-color]], [[layout-patterns]]
- Depende de: [[product-md]]
- Se conecta con: [[dashboard-admin]], [[portal-residente]], [[componentes]], [[absolute-bans]]

## Fuentes

- [[design-md]], [[product-md]]
