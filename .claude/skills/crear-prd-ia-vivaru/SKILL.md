---
name: crear-prd-ia-vivaru
description: Crear, estructurar, revisar y normalizar PRD de funcionalidades asistidas por IA en Vivaru — procesamiento documental, agentes conversacionales, modelos predictivos y plataforma de IA. Úsala cuando haya que convertir una oportunidad de IA en una PRD, decidir si una iniciativa realmente necesita IA, separar responsabilidades entre producto e inteligencia, revisar una PRD existente, mantener el portafolio de iniciativas, o definir criterios de evaluación, costos, intervención humana y despliegue. Palabras que la disparan: PRD de IA, agente, copiloto, OCR, extracción de documentos, modelo predictivo, LLM, prompt, evaluación, alucinación, costo por token.
---

# Crear PRD de IA para Vivaru

Convertir una oportunidad de IA en una especificación ejecutable, medible, segura y económicamente sostenible. Mantener separadas la experiencia de producto, el servicio de inteligencia y la plataforma compartida.

## La frontera obligatoria

Es el principio superior de todo lo que sigue:

> **Vivaru controla el proceso, los permisos y la modificación de datos. La IA extrae, clasifica, resume, recomienda o redacta.** Ninguna acción sensible se ejecuta por inferencia libre: exige una regla explícita, una autorización verificable o confirmación humana.

Son sensibles, como mínimo: aplicar pagos, modificar saldos, autorizar accesos, imponer sanciones, cambiar permisos, eliminar datos y enviar comunicaciones masivas.

## Antes de escribir: mirar el código, no suponer

Vivaru existe y está desplegado. **Verificar contra la implementación vigente es obligatorio, no opcional** — una PRD que inventa un módulo, un rol o una métrica hace perder más tiempo del que ahorra.

Consultar en este orden:

1. La solicitud explícita de quien pide.
2. La implementación vigente: `src/`, `functions/src/`, `firestore.rules`.
3. La wiki del producto: `wiki-producto/wiki/index.md` y sus enlaces.
4. `CLAUDE.md` y `docs/` para decisiones ya cerradas.
5. Supuestos, siempre etiquetados como tales.

Lo que no se pueda verificar se marca `TBD` con la pregunta mínima para resolverlo. **Nunca inventar** módulos, roles, colecciones, integraciones, métricas actuales ni capacidades desplegadas.

Anclas útiles del repositorio:

| Qué | Dónde |
|---|---|
| Roles y permisos | `src/lib/constants/roles.ts`, `firestore.rules` |
| Módulos y navegación | `src/components/shared/admin-sidebar.tsx` |
| Variantes por conjunto | `src/lib/config/module-variants.ts` |
| Prueba contra cliente | `src/lib/config/trial-modules.ts`, `src/features/tenant/use-tenant-trial.ts` |
| Callables existentes | `functions/src/index.ts`, `src/lib/firebase/callables.ts` |
| Correo transaccional | `functions/src/email.ts` |

## El flujo

### Paso 0 · Entender el contexto

Identificar módulo, usuario, proceso actual, problema, volumen, datos disponibles, decisión de negocio afectada y resultado esperado.

### Paso 1 · La puerta «¿necesita IA?»

Comprobar:

- ¿Reglas determinísticas, búsqueda, formularios o plantillas resuelven esto con calidad suficiente?
- ¿Existe un resultado medible que la IA pueda mejorar?
- ¿El error puede detectarse, corregirse y auditarse?
- ¿Hay un fallback manual o determinístico?
- ¿El costo variable cabe en el margen?

**Recomendar `sin IA` cuando una solución convencional baste.** Una preferencia tecnológica no es una necesidad de producto. Si la respuesta es «sin IA», derivar a la skill hermana `crear-prd-vivaru`.

### Paso 2 · Clasificar el tipo

Exactamente uno:

- **`FEAT`** — funcionalidad asistida por IA dentro de un flujo existente.
- **`DOC`** — extracción o validación de documentos.
- **`AGT`** — sistema conversacional que elige pasos o usa herramientas autorizadas.
- **`ML`** — modelo predictivo entrenado con datos históricos.
- **`PLAT`** — capacidad transversal: proveedores, cuotas, seguridad, auditoría, observabilidad.

No llamar *agente* a una clasificación, un resumen, un borrador o una llamada aislada a un LLM. No llamar *modelo ML* a un OCR ni a un prompt.

### Paso 3 · Clasificar el track

Exactamente uno:

- **`VIVARU`** — experiencia, proceso, interfaz, roles, permisos, persistencia.
- **`AI-SERVICE`** — inferencia, extracción, generación, predicción, evaluación.
- **`AI-PLATFORM`** — enrutamiento, proveedores, cuotas, auditoría, seguridad, operación transversal.

Una PRD vive en un solo track. Los demás se describen como dependencias, nunca como alcance propio.

### Paso 4 · Decidir si se separan PRD

Mantener el contrato de IA **dentro** de la PRD `VIVARU` cuando la llamada sea acotada, no reutilizable y evolucione con la funcionalidad.

Separar una PRD `AI-SERVICE` cuando el servicio: se reutilice en más de una funcionalidad, tenga evaluación/operación/versionado propios, requiera pipeline o dataset propio, o represente costo o riesgo material.

Declarar frontera, entradas, salidas y costos compartidos en ambas. **Evitar el doble conteo.**

### Paso 5 · Nombrar y registrar

`PRD-VAI-[TIPO]-NNN — [resultado]`

Ejemplos: `PRD-VAI-DOC-001 — Lectura de comprobantes`, `PRD-VAI-AGT-001 — Copiloto administrativo`.

El número es tentativo hasta validarlo contra el índice maestro. No reutilizar identificadores retirados.

**Dónde vive el archivo:** `docs/prd/ia/PRD-VAI-[TIPO]-NNN-[resultado].md`, en kebab-case sin tildes. Registrar la PRD en la tabla de estado de `docs/prd/README.md` al crearla.

Antes de escribir, leer los dos documentos que gobiernan el programa —`Estrategia_IA_Minima_Viable_Vivaru.md` y `Plan_General_Implementacion_IA_Vivaru.md`, hoy en `/Users/david/Claude Coworker/Hogaru/GPT/`— porque fijan restricciones que ninguna PRD individual puede contradecir: un solo proveedor generativo, techo de costo de 2–3% del ingreso del conjunto, confirmación humana obligatoria antes de toda mutación, y aislamiento por `tenantId` en cada ejecución, contexto, archivo y métrica.

Existen cinco PRD de IA ya redactadas en Google Drive (`PLAT-001` gateway, `FEAT-001` onboarding, `DOC-001` comprobantes, `FEAT-002` PQRS, `FEAT-003` comunicaciones). **Antes de crear una nueva, comprobar si ya existe allí** — el trabajo pendiente es migrarlas a `docs/prd/ia/`, no duplicarlas.

### Paso 6 · Encabezado

ID y nombre · tipo y track · módulo · usuario principal y secundarios · responsable · estado · dependencias · riesgo · estado de los datos · fase o plan comercial aplicable.

### Paso 7 · Cuerpo común

En este orden:

1. **Resumen ejecutivo** — problema, usuario, intervención de IA, valor esperado y **qué decisión permanece humana**.
2. **Problema y baseline** — proceso actual, tiempo, errores, costo, volumen, alternativa sin IA.
3. **Usuarios, roles y permisos** — alcance por rol, visibilidad, autorización, acciones prohibidas.
4. **Objetivo, alcance y exclusiones** — resultado, incluido, no incluido, canales, idiomas, límites del MVP.
5. **Flujo funcional y experiencia** — entrada, validaciones, inferencia, revisión, persistencia, error, escalamiento. Mermaid para flujos no triviales.
6. **Frontera reglas / IA / persona** — asignar explícitamente cada decisión.
7. **Contrato de datos y multi-tenancy** — fuentes, esquemas, campos, `tenantId`, aislamiento, sensibilidad, retención, correcciones.
8. **Contrato de IA** — tarea, clase de modelo, contexto, salida estructurada, rechazo, timeout, reintento, fallback, versionado.
9. **Evaluación y aceptación** — dataset, casos normales/ambiguos/adversos, métricas, umbrales, errores intolerables.
10. **Economía y consumo** — unidad, volumen, costo unitario, costo por tenant, cuota, alertas, impacto en margen.
11. **Arquitectura y dependencias** — interfaz, backend, almacenamiento, servicio IA, jobs, integraciones, logs, flags, kill switch.
12. **Seguridad, riesgos y mitigaciones** — privacidad, alucinación, abuso, prompt injection, proveedor, calidad, sobrecosto.
13. **Despliegue, rollback y Story Map** — modo sombra, piloto, beta, condición de salida, rollback, actividades MVP y posteriores.

### Paso 8 · Anexo por tipo

**`DOC`** — tipos documentales, campos, calidad de imagen, validaciones cruzadas, umbrales por campo, cola de revisión, precisión por campo, costo por documento o página.

**`AGT`** — objetivo, conocimiento autorizado, herramientas permitidas, permisos por herramienta, memoria, citas, confirmaciones, escalamiento, límites de conversación, defensa contra prompt injection, presupuesto por conversación.

**`ML`** — variable objetivo, unidad de predicción, horizonte, etiquetas, features y procedencia, baseline, separación temporal, prevención de fuga, métricas, umbrales, consumidor, explicabilidad, drift, reentrenamiento, estimabilidad.

**`PLAT`** — aislamiento por tenant, secretos, ruteo, esquemas, versionado de prompts, cuotas, presupuestos, anonimización, auditoría, feature flags, kill switch, reintentos, fallback, métricas operativas.

**`FEAT`** — el contrato de IA va en el cuerpo común; separar `AI-SERVICE` solo si el Paso 4 lo exige.

### Paso 9 · Controlar la economía

Calcular, o dejar la fórmula, para: costo por acción · acciones por tenant al mes · costo mensual por tenant · porcentaje del ingreso absorbido por IA · escenario normal y escenario de abuso.

Objetivo inicial recomendado: **menos del 2–3% del ingreso**, alerta al 5%, salvo que se defina otro criterio. Es política recomendada, no hecho contractual.

### Paso 10 · Las puertas

`G0 Necesidad` la IA supera la alternativa convencional · `G1 Valor` hay baseline y métrica · `G2 Datos` existen y pueden usarse · `G3 Riesgo` hay validación, auditoría y fallback · `G4 Evaluación` supera pruebas offline · `G5 Economía` cabe en el margen y tiene cuotas · `G6 Piloto` funciona en sombra o con tenants limitados · `G7 Escala` mantiene calidad, seguridad y costo.

**No presentar como lista para desarrollo** algo que no supere G0–G3. **No presentar como lista para producción** algo que no supere G4–G6.

### Paso 11 · Verificar el portafolio

Revisar colisión de identificadores, dependencias previas, componentes compartidos, fronteras entre soluciones hermanas, costos ya contabilizados, estado vigente frente a historia, supuestos anulados y coherencia con roles, módulos y datos reales.

Mantener el índice maestro con: ID, solución, tipo, track, módulo, usuario, valor, datos, riesgo, costo unitario, estado y dependencias.

## Estados permitidos

`Idea → Discovery → Lista para PRD → Piloto → Modo sombra → Beta → Productiva → Pausada o retirada`

Conservar solo el estado vigente en el portafolio principal. Mover lo reemplazado al historial sin borrar decisiones relevantes.

## Reglas no negociables

- Una PRD, un solo track.
- La frontera reglas / IA / persona, siempre explícita.
- Datos y contexto aislados por tenant.
- Validar salidas estructuradas **antes** de persistirlas.
- Incluir fallback y rollback.
- No autorizar acciones sensibles por inferencia libre.
- No diseñar ML sin variable objetivo, etiquetas y baseline.
- No diseñar un agente sin herramientas, permisos y límites explícitos.
- No elegir proveedor por moda: describir primero la capacidad requerida.
- No prometer autonomía, precisión ni ahorro sin criterio de evaluación.
- No duplicar costos ni componentes compartidos.
- Etiquetar recomendaciones, supuestos y campos `TBD`.

## Formato de salida

Según lo pedido: clasificación y justificación del uso de IA · la PRD completa o la revisión con hallazgos · PRD relacionadas si hay que separar · dependencias y fronteras anti-doble-conteo · riesgos, métricas, costo y puertas pendientes · preguntas abiertas **solo** cuando cambien materialmente el alcance.

Lenguaje ejecutivo y verificable. Las recomendaciones se presentan como recomendaciones; los hechos, como hechos.

## Checklist de cierre

- [ ] Superó la puerta «¿necesita IA?»
- [ ] Tipo y track explícitos
- [ ] ID sin colisión, o marcado como tentativo
- [ ] Problema, baseline y KPI medibles
- [ ] Alcance y exclusiones definidos
- [ ] Roles, permisos e intervención humana claros
- [ ] Frontera reglas–IA–persona documentada
- [ ] Contrato de datos con tenant, sensibilidad y retención
- [ ] Contrato de IA con salida, rechazo y fallback
- [ ] Métricas y umbrales permiten aprobar o rechazar
- [ ] Costo por acción y por tenant calculado o estimable
- [ ] Arquitectura, dependencias y componentes compartidos declarados
- [ ] Seguridad, despliegue y rollback cubiertos
- [ ] Anexo por tipo completo
- [ ] Sin doble conteo ni supuestos obsoletos
