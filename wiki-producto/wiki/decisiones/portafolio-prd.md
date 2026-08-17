---
tags: [decision, proceso, documentacion]
tipo: decision
fuentes: ["docs/prd/README.md", "crear-prd-vivaru", "crear-prd-ia-vivaru"]
fecha_creacion: 2026-08-01
fecha_actualizacion: 2026-08-17
---

# Portafolio de PRD — dónde viven y por qué ahí

Las especificaciones de producto viven en `docs/prd/`, versionadas junto al código que describen:

```
docs/prd/funcionales/   → producto sin IA        → PRD-V-
docs/prd/ia/            → capacidades asistidas  → PRD-VAI-
```

## Por qué en el repositorio y no en Drive

Cuando la PRD dice «máximo 5 MB por adjunto» y `SUPPORT_LIMITS.maxAttachmentBytes` dice lo mismo, ambas afirmaciones viajan en el mismo commit. En un documento externo esa pareja se separa el primer día que alguien cambia uno de los dos lados, y a partir de ahí nadie sabe cuál manda.

El costo se veía en las cinco PRD de IA que solo existían en Google Drive: sin historial, sin diff, sin relación con el código. **Desde el 15 de agosto de 2026 una está versionada** y ya cobró el beneficio: entre el 15 y el 17 acumuló nueve decisiones fechadas y firmadas que en Drive se habrían perdido. Quedan cuatro por migrar. Ver [[programa-ia]].

Drive sigue siendo útil para **leer y comentar** —el equipo comercial no abre el repositorio— pero como copia, no como original.

## Por qué dos carpetas

Una PRD de IA responde preguntas que una funcional no tiene: con qué datos se evalúa, cuánto cuesta cada ejecución, qué pasa cuando el modelo se equivoca y quién confirma antes de guardar. Mezclarlas obligaría a arrastrar esas secciones vacías por todo el portafolio.

La diferencia se ve en las puertas: la funcional usa G0–G6; la de IA añade **G4 Evaluación**, porque una demostración que funciona no prueba que la solución funcione. Detalle en [[plan-general-ia]].

## Dos skills

`crear-prd-vivaru` y `crear-prd-ia-vivaru`, cada una escribe en su carpeta. Ambas empiezan por la misma puerta: **¿esto merece una PRD?** Un cambio de copy o un ajuste visual no la merece, y decirlo forma parte del trabajo. La de IA añade una puerta previa propia: ¿la IA supera a una regla determinística? Si no, la PRD correcta es funcional.

Ambas obligan a verificar contra la implementación vigente —`src/`, `functions/src/`, `firestore.rules`— antes de afirmar nada. La mitad de los errores caros de una PRD son decir que algo no existe cuando existe. Anclas útiles: [[autenticacion-roles]] para roles, [[firebase-firestore]] para permisos reales, [[modulos-variantes]] para variantes por conjunto.

## La regla que mantiene esto vivo

> Cuando la implementación contradiga a la PRD, **gana la implementación** — y la PRD se corrige en el mismo commit.

Una PRD que describe algo que ya no es cierto es peor que no tenerla, porque alguien la va a creer. La de [[soporte]] se actualizó así: al terminar la construcción se resolvieron sus 13 `TBD` y se añadió una sección con los cinco hallazgos que la especificación no podía anticipar —entre ellos que las reglas de Storage suman permisos en vez de restarlos, recogido en [[trampas-conocidas]]—.

## Estado

| Carpeta | PRD | Estado (17 ago 2026) |
|---|---|---|
| `funcionales/` | PRD-V-FEAT-001 · tickets de soporte | **En producción.** Las seis callables desplegadas. Ver [[soporte]] |
| `funcionales/` | PRD-V-FEAT-002 · importación de datos del conjunto | **En producción.** El paso de mapeo es determinista, no asistido |
| `ia/` | PRD-VAI-FEAT-002 · asistente de PQRS | **Versionada y fuente de verdad** sobre su copia de Drive. F1–F3 hechas, F4 (sombra) en producción |
| `ia/` | gateway · onboarding · comprobantes · comunicaciones | Solo en Drive. Cuatro por migrar |

Ver también [[estado-modulos]] para el estado de los módulos ya construidos.
