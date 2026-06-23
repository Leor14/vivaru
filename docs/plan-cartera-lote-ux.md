# Plan — Cartera "Crear nuevo cobro": reglas de negocio + flujo + UX (lote/programación)

> Estado: análisis y definición. Pendiente de ejecutar.

## Diagnóstico (lo que falla hoy)

1. **El selector "Unidad" (individual) sigue visible en modo Lote** (solo deshabilitado,
   mostrando "1011"). Confunde: parece que el lote va a una sola unidad. → debe **ocultarse**.
2. **Sin confirmación clara tras "Crear lote".** El lote inmediato SÍ crea N cobros (uno por
   unidad) que aparecen en la tabla de abajo y notifica a los residentes, pero: el checklist
   queda abierto, el toast desaparece y no se indica qué pasó ni dónde verlo → sensación de
   "no pasó nada".
3. **Guía insuficiente.** La descripción ("Registra cartera mensual por unidad…") no explica
   los dos destinatarios (una unidad / lote) ni qué hace "Programar para".
4. **Etiquetas de unidad duplicadas** en el checklist (T1-403 ×3, T2-201 ×4). Son **unidades
   duplicadas en el conjunto** (docs distintos, misma etiqueta). No es bug del form, pero
   ensucia la selección y **puede generar cobros dobles** a la misma unidad real.
5. **"Abono" visible en lote** (deshabilitado). No aplica a un lote → debe ocultarse.

## Reglas de negocio (matriz destinatario × tiempo)

| Destinatario | Inmediato | Programado (fecha futura) |
|---|---|---|
| **Una unidad** | Crea 1 cobro ahora. Abono permitido. Notifica a esa unidad (`billing_new`, con concepto). | Crea programación; el **cron** publica en la fecha y notifica individual. |
| **Lote (varias)** | Crea N cobros ahora (uno por unidad seleccionada). Abono N/A (0). **Aviso agrupado** (`billing_batch`). | Crea programación (isBatch); el cron publica en la fecha y envía el aviso agrupado. |

Reglas transversales:
- "Programar para" vacío = inmediato; con fecha futura = programado (no visible para el
  residente antes de la fecha).
- El lote arranca con **todas las unidades activas**; el admin **destilda** las que excluya.
- Concepto aplica a todos los cobros del envío.
- No se permite enviar un lote con **0 unidades** ni sin **Valor**.

## Flujo / UX correcto

**En modo Lote:**
- **Ocultar** el selector "Unidad" individual (el checklist ES el selector). Reflujo del grid.
- **Ocultar "Abono"** (no aplica). En "Una unidad" programada también se oculta (el abono solo
  tiene sentido en cobro individual inmediato).
- El checklist muestra "N de M unidades" con accesos "Todas / Ninguna" (ya existe).

**Guía contextual (copy):**
- Descripción nueva que explique en una línea: *"Elige a quién cobrar (una unidad o un lote),
  el concepto y el valor. Opcional: programa la fecha en que el cobro se publica y se notifica."*
- Microcopy bajo "Destinatario" y "Programar para" (qué hace cada uno).

**Confirmación + próximos pasos (tras crear):**
- **Lote inmediato** → toast + **banner inline persistente**: *"✓ Se crearon N cobros de
  {período}. Los residentes fueron notificados. Aparecen en la tabla de abajo."* + **reset**
  del formulario (vuelve a "Una unidad", valor a 0, checklist a todas).
- **Lote programado** → banner: *"✓ Lote programado para el {fecha} ({N} unidades). Puedes
  revisarlo o cancelarlo en 'Cobros programados'."*
- **Una unidad** (inmediato/programado) → su mensaje equivalente.

**Duplicados de unidad:**
- Corto plazo: en el checklist, **marcar las etiquetas repetidas** (p. ej. sufijo discreto) y
  un aviso "Hay unidades con el mismo nombre; revisa antes de cobrar al lote".
- Recomendado (frente aparte): **limpiar unidades duplicadas** en el módulo de residentes
  (causa raíz). El cobro doble real solo se evita eliminando los docs duplicados.

## Fases de ejecución

- **G1 — Modo Lote limpio:** ocultar "Unidad" individual y "Abono" en lote; reflow del grid;
  **reset del formulario tras crear** (cierra el checklist y vuelve a estado limpio).
- **G2 — Guía/copy:** descripción + microcopy de Destinatario y Programar.
- **G3 — Confirmación con próximos pasos:** banner inline persistente con resumen y dónde
  revisar (tabla para inmediato, "Cobros programados" para programado).
- **G4 — Duplicados (señalización):** marcar repetidos en el checklist + aviso. (Limpieza de
  datos = frente aparte en Residentes.)

## Decisiones a confirmar

1. Tras crear un lote, ¿**resetear** el formulario a "Una unidad" limpio (recomendado) o
   mantener el modo lote para crear otro?
2. Confirmación: ¿**banner inline persistente** (recomendado) además del toast?
3. Duplicados: ¿por ahora solo **señalizar/avisar** en el checklist (recomendado) y dejar la
   limpieza de unidades duplicadas como frente aparte en Residentes?
