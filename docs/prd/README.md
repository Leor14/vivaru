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
| [PRD-V-FEAT-001 — Tickets de soporte](funcionales/PRD-V-FEAT-001-tickets-soporte.md) | En staging | Verificada por API. Falta recorrido visual y confirmar entrega de correo en producción |

### IA

Ninguna PRD de IA se ha escrito todavía en el repositorio, y **no hay una sola línea de IA en el código**: no existen `aiUsage`, gateway, adaptador de proveedor ni llamadas a ningún modelo. El programa está en Fase 0.

Existen cinco PRD de IA redactadas en Google Drive que aún no se han traído aquí:

| PRD | Alcance |
|---|---|
| `PRD-VAI-PLAT-001` | Gateway, auditoría y cuotas de IA |
| `PRD-VAI-FEAT-001` | Onboarding asistido |
| `PRD-VAI-DOC-001` | Lectura asistida de comprobantes |
| `PRD-VAI-FEAT-002` | Asistente de PQRS |
| `PRD-VAI-FEAT-003` | Asistente de comunicaciones |

Migrarlas a `ia/` es trabajo pendiente. Hasta entonces la fuente de verdad de su alcance sigue siendo Drive, con el costo de versionado que eso implica.

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
