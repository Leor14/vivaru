# Portafolio de PRD — Vivaru

Toda especificación de producto vive aquí, versionada junto al código que describe. Esa cercanía es el punto: cuando la PRD dice «máximo 5 MB por adjunto» y `SUPPORT_LIMITS.maxAttachmentBytes` dice lo mismo, ambas afirmaciones viajan en el mismo commit. Un documento fuera del repositorio se desincroniza el primer día que alguien cambia uno de los dos lados.

## Estructura

```
docs/prd/
  funcionales/   → Producto sin IA. Prefijo PRD-V-
  ia/            → Capacidades asistidas por IA. Prefijo PRD-VAI-
```

La separación no es cosmética. Una PRD de IA tiene que responder preguntas que una funcional no tiene: con qué datos se evalúa, cuánto cuesta cada ejecución, qué pasa cuando el modelo se equivoca, y quién confirma antes de que algo se guarde. Mezclarlas obligaría a arrastrar esas secciones vacías por todo el portafolio.

## Nomenclatura

| Carpeta | Formato | Tipos |
|---|---|---|
| `funcionales/` | `PRD-V-[TIPO]-NNN-[resultado].md` | `FEAT` · `FLOW` · `PLAT` · `OPS` · `FIX` |
| `ia/` | `PRD-VAI-[TIPO]-NNN-[resultado].md` | `FEAT` · `DOC` · `AGT` · `PRED` · `PLAT` |

Se nombra por resultado, no por pantalla: `tickets-soporte`, no `pantalla-tickets`. El número es correlativo dentro de su tipo y carpeta.

## Cómo se crean

Dos skills, una por carpeta:

```bash
/crear-prd-vivaru      # producto sin IA    → docs/prd/funcionales/
/crear-prd-ia-vivaru   # capacidades de IA  → docs/prd/ia/
```

Ambas empiezan por la misma puerta: **¿esto merece una PRD?** Un cambio de copy o un ajuste visual no la merece, y decirlo es parte del trabajo. La skill de IA añade una puerta previa propia: ¿la IA supera a una regla determinística? Si la respuesta es no, la PRD correcta es una funcional.

## Estado del portafolio

### Funcionales

| PRD | Estado | Nota |
|---|---|---|
| [PRD-V-FEAT-001 — Tickets de soporte](funcionales/PRD-V-FEAT-001-tickets-soporte.md) | **Productiva** | Desplegada y verificada de punta a punta el 2026-08-01, correo incluido |
| [PRD-V-FEAT-002 — Importación de datos del conjunto](funcionales/PRD-V-FEAT-002-importacion-datos-conjunto.md) | **Productiva** (`registrarImportacion` desplegada en `hogaru-1`, comprobado el 2026-08-17) | Mapeo de columnas por nombre, contenido y variedad; catálogo único de campos; XLSX con selección de la hoja que mejor encaja; orden entre las dos cargas; y telemetría por pista. Construye el hueco donde entra `PRD-VAI-FEAT-001`. Sin decisiones abiertas |

### IA

**Este párrafo decía, hasta el 14 de agosto de 2026, que no había «una sola línea de IA en el código» y que el programa estaba en Fase 0. Dejó de ser cierto y nadie lo actualizó.** Hoy existen el gateway (`functions/src/ai/gateway.ts`), la telemetría (`aiUsage`), las cuotas, el adaptador real de Vertex, el registro de feedback (`aiFeedback`) y el contexto del conjunto — **en producción desde el 15 de agosto de 2026**. El canario de comunicaciones está construido y probado con dos administradores reales.

**Y desde el 17 de agosto dejaron de estar inertes:** `ai-gateway`, `ai-pqrs-shadow` e `ia-proveedor-real` están **encendidas en producción**, con el modo sombra de PQRS clasificando en silencio. Las banderas de las capacidades visibles siguen apagadas, así que ningún usuario ve nada. El límite ya no es técnico: producción tiene dos conjuntos reales con cero tickets.

El estado paso a paso vive en `docs/hoja-de-ruta-ia.md`; el índice de lo pendiente, en `docs/pendientes.md`. El cotejo contra el código, en `docs/auditoria-prd-ia-ago2026.md`.

| PRD | Estado |
|---|---|
| `PRD-VAI-PLAT-001` — Gateway, auditoría y cuotas | Implementada. **En producción desde el 15 ago 2026**, inerte tras banderas |
| `PRD-VAI-FEAT-003` — Asistente de comunicaciones | Implementada, probada con dos administradores. **En producción, banderas apagadas.** Falta la línea base H2′ (tercer administrador) |
| [PRD-VAI-FEAT-002 — Asistente de PQRS](ia/PRD-VAI-FEAT-002-asistente-pqrs.md) | **F1–F3 hechas y F4 en producción** (17 ago 2026). Gold set de 152 casos, evaluación offline corrida, piloto con un administrador, y modo sombra desplegado y encendido en `hogaru-1`. Falta F5 (escala), que depende de que existan tickets reales. Las dos puertas de G7 y el criterio de afirmaciones de §9 tienen decisión firmada dentro |
| `PRD-VAI-FEAT-001` — Onboarding asistido | En espera. Su primera mitad **no necesita IA** y es `PRD-V-FEAT-002` (en staging) |
| `PRD-VAI-DOC-001` — Lectura de comprobantes | Bloqueada por falta de comprobantes reales. No se sintetiza |

Las otras cuatro siguen viviendo fuera del repositorio (Drive). Migrarlas a `ia/` sigue pendiente; hasta entonces la fuente de verdad de su alcance es Drive, con el costo de versionado que eso implica — que es exactamente lo que este README argumenta en su primera línea. Para `FEAT-002`, desde el 15 de agosto, **la fuente de verdad es el repo** y la copia de Drive queda como lectura.

## Documentos que gobiernan el programa de IA

No son PRD —son el marco que las ordena— y hoy viven fuera del repositorio, en `/Users/david/Claude Coworker/Hogaru/GPT/`:

- **`Estrategia_IA_Minima_Viable_Vivaru.md`** — la decisión ejecutiva: dos capacidades externas durante 12 meses (un modelo generativo económico y OCR documental), y el techo de costo de 2–3% del ingreso por conjunto.
- **`Plan_General_Implementacion_IA_Vivaru.md`** — el plan maestro: fases 0–6, puertas G0–G7, matriz de dependencias y backlog ejecutivo.

Esa carpeta no es un repositorio git, así que estos dos documentos no tienen historial de versiones. Conviene traerlos.

Resumen de ambos en la wiki: [[programa-ia]].

## Reglas del portafolio

1. Una PRD describe **resultado y reglas**, no implementación — salvo en su sección de arquitectura, que existe justamente para decidir eso.
2. Todo rol declara qué puede **y qué no**. La columna de lo prohibido es la que evita los agujeros.
3. Todo estado tiene dueño y transición de salida. Un estado sin dueño se atasca.
4. Los criterios de aceptación incluyen **los casos que deben fallar**.
5. Un `TBD` lleva la pregunta mínima que lo cierra. Un `TBD` sin pregunta es una decisión aplazada disfrazada de documento.
6. Cuando la implementación contradiga a la PRD, **gana la implementación** — y la PRD se corrige en el mismo commit.

La regla 6 es la que mantiene esto vivo. Una PRD que describe algo que ya no es cierto es peor que no tenerla, porque alguien la va a creer.
