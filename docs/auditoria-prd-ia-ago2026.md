# Auditoría del portafolio de IA — las cinco PRD contra el código

**Fecha:** 8 de agosto de 2026 · **Alcance:** las cinco `PRD-VAI-*` de Drive,
el plan maestro, la estrategia mínima viable y el código de este repo.
**No se modificó ninguna fuente.** Esto es el cotejo, no una decisión.

Existe un documento de transferencia,
`VIVARU_Priorizacion_IA_Transferencia.md`, que resume el programa. Esta nota lo
corrige en los puntos donde no coincide con las fuentes.

## Lo mínimo, si no se lee nada más

1. **Las cinco PRD son sólidas.** Están escritas contra el código real, con
   nombres de símbolo exactos. No hay que rehacerlas.
2. **Todo el portafolio está atascado en la misma puerta y por la misma razón:**
   nadie ha medido nada. G1 y G2 se desbloquean con un solo ejercicio.
3. **Solo quedan tres preguntas abiertas**, repetidas cinco veces: quién
   responde, cuánto se hace hoy, y cuánto cuesta.
4. **La Fase 2 de `FEAT-001` no necesita IA** y se puede construir ya. Es el
   único hallazgo que mueve el orden del programa.

## Fuentes, y cuáles siguen accesibles

| Fuente | Estado |
|---|---|
| `/Users/david/Claude Coworker/Hogaru/GPT/Estrategia_IA_Minima_Viable_Vivaru.md` | Accesible, leída completa |
| `/Users/david/Claude Coworker/Hogaru/GPT/Plan_General_Implementacion_IA_Vivaru.md` | Accesible, leído completo |
| [Carpeta de PRD en Drive](https://drive.google.com/drive/folders/1gOkJWp7-ihkAbUGM2VtD94_2ZtHDlRIF) | Accesible, **exactamente cinco archivos** |

Las cinco PRD se crearon el **1-ago-2026 a las 22:37** y se modificaron entre las
22:39 y las 22:46. Sin tocar desde entonces. Es un lote generado en una sesión de
nueve minutos: primer borrador, no especificación negociada.

**Corrección:** la carpeta de Drive **no** contiene la regla general ni la guía
de creación de PRD de IA, aunque el documento de transferencia diga que sí. Esos
dos artefactos viven en este repo como skill, en
`.claude/skills/crear-prd-ia-vivaru/SKILL.md`.

**Wiki de negocio duplicada, resuelta.** `Hogaru/Vivaru business - WIKI/` (90
archivos, incluye `diseno-comercial/`, `growth/`, `producto-detalle/`) es
superset de `Hogaru/vivaru-wiki-negocio/` (32 archivos). **La primera es la
canónica.** Conviene renombrar la segunda para que nadie la cite por error.

## Las puertas G0–G7, corregidas

El documento de transferencia las numera mal. Las cinco PRD, el plan maestro y el
uso real en este repo coinciden entre sí; solo la transferencia difiere. **Manda
esta columna:**

| | Transferencia (incorrecta) | Plan maestro, PRD y repo |
|---|---|---|
| G0 | Propósito y dueño | **Necesidad** — ¿la IA aporta más que reglas? |
| G1 | Datos | **Valor** — baseline y meta cuantitativa |
| G2 | Seguridad y arquitectura | **Datos** |
| G3 | Evaluación | **Riesgo** — fallback y kill switch |
| G4 | Economía | **Evaluación** |
| G5 | Piloto controlado | **Economía** |
| G6 | Evidencia de valor | **Piloto** |
| G7 | Escalamiento | Escala |

La transferencia además elimina «Riesgo» como puerta propia. La prueba de que
manda la del maestro está en este repo: `docs/pendientes.md` describe
`PRD-V-OPS-001` como bloqueada por «G1 no hay baseline», que es G1=Valor.

## Las PRD están escritas contra el código

Todo lo que declaran como baseline existe, con el nombre exacto:

| PRD | Símbolo declarado | Verificado |
|---|---|---|
| `DOC-001` | `approveReceiptAndRegisterPayment`, `PaymentReceipt`, `BillingStatement`, `PaymentReceiptsReviewPanel` | los cuatro |
| `FEAT-002` | `responseHistory`, `radicado`, `con_sla`, `buzon_simple` | los cuatro |
| `FEAT-003` | `canal_oficial`, `tablon_simple`, `startsAt`, `endsAt` | los cuatro |
| `FEAT-001` | `tenantUsers`, agrupaciones, importador CSV | sí; `papaparse` y `xlsx` ya son dependencias |

Las únicas colecciones ausentes —`importJobs`, `importMappings`,
`importErrors`— están marcadas en la propia PRD como «persistencia **propuesta**».
También correcto.

## Estado consolidado de las puertas

| Puerta | `PLAT-001` | `FEAT-003` | `FEAT-002` | `FEAT-001` | `DOC-001` |
|---|---|---|---|---|---|
| G0 Necesidad | superada | superada | superada | superada | superada |
| G1 Valor | falta cuantificar | falta baseline | falta baseline | falta baseline | falta baseline |
| G2 Datos | parcial | parcial | parcial | parcial | parcial |
| G3 Riesgo | diseñado | diseñado | diseñado | diseñado | diseñado |
| G4–G7 | pendiente | pendiente | pendiente | pendiente | pendiente |

Agrupados, los TBD son **tres preguntas repetidas cinco veces**: responsable
(5/5), baseline y volumetría (5/5), economía (5/5). Nada más está sin diseñar, y
dos de las tres las contesta el mismo conteo.

## Cuatro hallazgos

### 1. `FEAT-001` no es lo que el plan maestro cree, y una parte no necesita IA

Su PRD lo dice sin ambigüedad: *«La mayor parte del proceso se resuelve con
parsing, reglas, catálogo de campos y validaciones determinísticas. La IA solo
interviene cuando los encabezados o valores del archivo son ambiguos»*. Es
importación tabular de CSV y XLSX, con catálogo cerrado de campos destino y **una
sola llamada por grupo de columnas ambiguas, no una por fila**.

Su Fase 2 es, textualmente, *«parser, reglas y preview sin IA»*. Eso no depende
de `PLAT-001`, ni del proveedor, ni del presupuesto, ni de la política de datos.
`papaparse` y `xlsx` ya están instalados.

El plan maestro la puso tercera por «documentos heterogéneos, datos sensibles y
formatos heterogéneos» — un alcance que su propia PRD no tiene. **La premisa del
orden no se sostiene para esta iniciativa.** La recomendación es sacar esa Fase 2
del programa de IA y tratarla como producto normal: genera por sí sola el
baseline de activación que `FEAT-001` necesita para cerrar G1, y deja el hueco
exacto donde después entra el mapeo asistido. El orden del programa de IA no
cambia; comunicaciones sigue siendo el canario.

### 2. El baseline de `FEAT-001` está desactualizado por tres horas

La PRD dice «un recorrido de siete pasos de activación».
`src/lib/onboarding/steps.ts:554` dice: «Los pasos que miden puesta en marcha
real: **7 en la prueba, 10 en un cliente**». Hay dos recorridos, `trial` y
`cliente`, y la PRD no menciona el split.

Los cuatro pasos estructurales que nombra —agrupaciones, unidad, residente
titular, portería— son exactos y están en ese orden. Pero el «7» es el número del
trial, y `FEAT-001` va de poner en marcha un conjunto, que es el recorrido
`cliente`.

Importa **cómo** llegó el error: el track `cliente` se commiteó el 1-ago a las
17:30 (`cc9e780`) y la PRD se creó a las 22:37 del mismo día. Se escribió contra
la documentación, no contra el código, cinco horas después del merge. Sus KPI de
finalización y abandono hay que redefinirlos por track.

### 3. Ecuador no está en ningún dataset de evaluación

`DOC-001` pide *«comprobantes representativos de Colombia y México»* y monedas
*«COP/MXN»*. `FEAT-001` pide *«formatos de Colombia y México»*. Ecuador está en
`PAISES`, en el `areaServed` y en el enum de país fiscal `["EC","CO","MX"]`.

Es el mismo punto ciego que `docs/brief-legal-ecuador.md`, pero aquí muerde
distinto: `DOC-001` compara contra la moneda del tenant y emite una bandera
`moneda_inconsistente`. Un conjunto ecuatoriano opera en USD y sus comprobantes
bancarios no se parecen a los colombianos. **Un gold set sin Ecuador aprobaría
una capacidad que falla con el primer conjunto ecuatoriano.**

### 4. Las cinco dependen de un feature flag que no tiene lector

`PLAT-001` lo pone en su MVP. Las otras cuatro lo listan como dependencia ya
disponible: «Feature flag por tenant y plan». **No lo está.** `featureFlags` son
diez líneas de reglas en `firestore.rules:636` sin un solo consumidor en `src/`,
`functions/src/`, `components/` ni `features/`. Es trabajo real que ninguna PRD
presupuesta, y es requisito no negociable para todas.

Por lo mismo, el «35% de preparación» de la plataforma que cita el plan maestro
está optimista: no hay una sola línea de código de IA en el repo — ninguna
dependencia ni referencia a Gemini, Vertex, OpenAI, Genkit o Document AI.
`PLAT-001` es greenfield completo. Lo que sí existe y el plan acierta en contar:
App Check en cliente (`src/lib/firebase/app-check/index.ts`) y escritura de
`auditLogs` desde functions.

## Contradicciones entre las dos fuentes locales

El plan maestro y la estrategia mínima viable **no son dos redacciones del mismo
programa**. La transferencia adopta el plan y no señala la diferencia:

- **Secuencia.** El plan es secuencial: comunicaciones → PQRS → onboarding →
  comprobantes, 10–17 sprints. La estrategia corre onboarding + PQRS +
  comunicaciones **en paralelo** los días 16–35, y comprobantes en modo sombra
  los días 36–60.
- **Alcance de onboarding.** El plan imagina documentos heterogéneos; la
  estrategia, un CSV o Excel. La PRD le da la razón a la estrategia. Esto
  explica la diferencia de orden: hablaban de dos cosas distintas con el mismo
  nombre.
- **Proveedor.** El plan y la transferencia lo listan como decisión abierta. La
  estrategia ya lo cierra con argumentos: un solo LLM económico en Vertex y
  Document AI Enterprise OCR. **Hay que decidir si eso es una decisión o una
  recomendación**, y quitarlo de pendientes si es lo primero.

## El margen económico es más estrecho de lo que parece

La regla de la estrategia es `min(USD 3, 5% del ingreso del conjunto)`. Para casi
cualquier conjunto el que ata es **USD 3**. Su propio escenario «conservador» da
**USD 1.94–2.94/mes**: entre el 65% y el 98% del techo duro, en el mejor caso.

No hay holgura, y ese escenario asume 300 páginas de OCR al mes por conjunto —
que un conjunto de 200 unidades puede consumir solo en comprobantes, sin contar
reintentos ni documentos de varias páginas. **El caso económico no lo decide el
precio del token: lo decide el volumen de comprobantes.** La iniciativa que va al
final es la que determina si el programa entero es rentable, así que su volumen
conviene estimarlo ahora aunque se construya al final.

Detalle a verificar antes de G5: la estrategia cita «Gemini 3.5 Flash-Lite» a
USD 0.30 / 2.50 por millón de tokens. Esos son precios de la línea Flash, no de
Flash-Lite. El error va a favor —sobreestima—, pero el número no debe citarse
como verificado hasta cotejar el catálogo vigente de Vertex.

## Lo que NO hay que revisar

Para que nadie lo reabra: la frontera entre reglas, IA y persona está bien
resuelta en las cinco. Ninguna concede acción autónoma, las cinco declaran
fallback determinístico, y la sección anti-doble-conteo es coherente entre ellas.
`DOC-001` deja explícito que ninguna salida documental puede invocar
`approveReceiptAndRegisterPayment`. Eso está cerrado.

## Qué sigue

**Contar.** Volumen mensual de tickets, comprobantes y comunicaciones, y número
de conjuntos activos con actividad real. Sin ese dato no cierra G1 en ninguna de
las cinco, y además decide si los gold sets son alcanzables hoy: `FEAT-002` pide
150–250 tickets y `DOC-001` pide 100–200 comprobantes. Si el volumen no existe,
la Fase 0 no cierra por mucho presupuesto o proveedor que se decida.
