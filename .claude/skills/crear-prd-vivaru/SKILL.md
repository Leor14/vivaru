---
name: crear-prd-vivaru
description: Crear, estructurar y revisar PRD de funcionalidad de producto de Vivaru que NO usa inteligencia artificial — nuevos módulos, cambios de proceso, permisos, notificaciones, herramientas internas y capacidades transversales. Úsala cuando haya que convertir una necesidad de negocio en una especificación ejecutable, decidir si algo merece una PRD o es solo un ticket, revisar una PRD existente, o definir alcance, roles, estados, datos, criterios de aceptación y despliegue. Palabras que la disparan: PRD, especificación, definición funcional, alcance, criterios de aceptación, story map, flujo, permisos, estados. Para iniciativas asistidas por IA usar en su lugar `crear-prd-ia-vivaru`.
---

# Crear PRD de producto para Vivaru

Convertir una necesidad de negocio en una especificación ejecutable, verificable y reversible. **El criterio de calidad es uno solo: que quien la lea pueda construirla sin volver a preguntar, y que quien la apruebe pueda decir que no.**

## El principio superior

> **Una PRD describe el resultado y las reglas, no la implementación.** Define qué tiene que ser cierto cuando esté hecho, quién puede hacer qué, y cómo se sabe que funcionó. La solución técnica se decide después y puede cambiar sin reescribir la PRD.

Corolario práctico: si una sección solo se puede escribir eligiendo la implementación, va en «Arquitectura y dependencias», que es donde esa decisión sí se declara y se justifica.

## Antes de escribir: mirar el código, no suponer

Vivaru está desplegado y en uso. **Verificar contra la implementación vigente es obligatorio.** La mitad de los errores caros de una PRD son afirmar que algo no existe cuando existe, o que existe cuando no.

Orden de fuentes:

1. La solicitud explícita de quien pide.
2. La implementación vigente: `src/`, `functions/src/`, `firestore.rules`.
3. La wiki del producto: `wiki-producto/wiki/index.md`.
4. `CLAUDE.md` y `docs/` para decisiones ya cerradas.
5. Supuestos, siempre etiquetados.

Lo no verificable se marca `TBD` con la pregunta mínima. **Nunca inventar** módulos, roles, colecciones ni capacidades.

Anclas del repositorio:

| Qué | Dónde |
|---|---|
| Roles del sistema | `src/lib/constants/roles.ts` |
| Permisos reales por colección | `firestore.rules` |
| Módulos y navegación del admin | `src/components/shared/admin-sidebar.tsx` |
| Navegación por rol | `src/lib/navigation/role-sidebar-groups.ts` |
| Variantes de módulo por conjunto | `src/lib/config/module-variants.ts` |
| Prueba contra cliente | `src/lib/config/trial-modules.ts` |
| Operaciones con lógica de servidor | `functions/src/index.ts` |
| Correo transaccional | `functions/src/email.ts` |

## Paso 0 · La puerta «¿esto merece una PRD?»

No todo la merece. Escribir una PRD para un cambio de copy es burocracia; no escribirla para algo que toca permisos es negligencia.

**Merece PRD** si cumple al menos dos:

- Toca **más de un rol** o más de un portal.
- Cambia **permisos, modelo de datos o reglas de Firestore**.
- Tiene consecuencias de **dinero, legales o de datos personales**.
- Introduce **estados** que alguien tendrá que operar.
- Envía **correo o notificaciones** a personas.
- Alguien va a **cuestionar la decisión después** y hará falta el porqué.

**No la merece** un cambio de texto, un ajuste visual, un arreglo acotado o algo que se explica en un párrafo. En ese caso decirlo y proponer el ticket, no la PRD.

## Paso 1 · Clasificar el tipo

Exactamente uno:

- **`FEAT`** — funcionalidad nueva dentro de un módulo existente.
- **`FLOW`** — cambio a un proceso de punta a punta que ya existe.
- **`PLAT`** — capacidad transversal: roles, permisos, notificaciones, auditoría, ciclo de vida del conjunto.
- **`OPS`** — herramienta interna: consola de superadmin, back-office, operación comercial.
- **`FIX`** — corrección estructural con suficiente alcance para merecer diseño.

## Paso 2 · Declarar los portales

Vivaru son cuatro portales con código, permisos y usuarios distintos. **Decir cuáles toca es la clasificación que más trabajo ahorra**, porque cada uno añadido multiplica el esfuerzo y las pruebas.

`ADMIN` · `RESIDENTE` · `PORTERIA` · `SUPERADMIN`

Marcar cuáles son alcance y cuáles solo se ven afectados. Si toca tres o cuatro, considerar partir la PRD por fases antes que por portal — un flujo a medias en un portal es peor que no tenerlo.

## Paso 3 · Nombrar y registrar

`PRD-V-[TIPO]-NNN — [resultado]`

Ejemplos: `PRD-V-FEAT-001 — Tickets de soporte al cliente`, `PRD-V-PLAT-002 — Ciclo de vida del conjunto`.

Se nombra por **resultado**, no por pantalla: «Tickets de soporte», no «Pantalla de tickets». El número es tentativo hasta validarlo contra el índice.

**Dónde vive el archivo:** `docs/prd/funcionales/PRD-V-[TIPO]-NNN-[resultado].md`, en kebab-case sin tildes. Versionada junto al código que especifica: cuando la PRD y la constante discrepan, la discrepancia se ve en el diff. Registrar la PRD en la tabla de estado de `docs/prd/README.md` al crearla, y actualizar esa fila cuando cambie de estado. Las PRD de capacidades con IA no van aquí — van a `docs/prd/ia/` con la skill `crear-prd-ia-vivaru`.

## Paso 4 · Encabezado

ID y nombre · tipo · portales · módulo · usuario principal y secundarios · responsable · estado · dependencias · riesgo · reversibilidad · fase o plan comercial aplicable.

## Paso 5 · Cuerpo

En este orden:

**1. Resumen ejecutivo** — problema, usuario, qué cambia y valor esperado. Cuatro frases. Si no cabe en cuatro, el alcance está mal cortado.

**2. Problema y baseline** — cómo se resuelve hoy, con qué costo en tiempo, errores o dinero, y con qué volumen. **Sin baseline no hay forma de saber si funcionó**; si no existe el dato, decirlo y proponer cómo medirlo antes de construir.

**3. Usuarios, roles y permisos** — por cada rol de Vivaru (`tenant_admin`, `resident`, `security_guard`, `superadmin`): qué ve, qué puede hacer, qué tiene **prohibido**. La columna de lo prohibido es la que evita los agujeros.

**4. Objetivo, alcance y exclusiones** — resultado esperado, qué entra, **qué no entra** y por qué. Las exclusiones explícitas son lo que impide que el alcance crezca en silencio.

**5. Flujo funcional** — camino feliz, validaciones, errores, casos límite y quién es notificado en cada paso. Mermaid cuando haya ramas.

**6. Estados y transiciones** — para todo lo que tenga ciclo de vida: estados posibles, quién puede provocar cada transición, cuáles son terminales y qué pasa con lo que queda a medias. **Un estado sin dueño es un estado que se queda atascado.**

**7. Contrato de datos y multi-tenancy** — colecciones, campos, tipos, obligatoriedad, quién escribe cada uno, retención y borrado.

Invariantes de Vivaru que hay que respetar y declarar:

- Todo documento de tenant lleva **`tenantId`**, y toda consulta de lista desde el cliente **debe filtrarlo**: las reglas de Firestore no filtran, rechazan. Una consulta sin `where("tenantId","==",...)` se deniega entera.
- Un conjunto en `suspended` o `expired` queda en **solo lectura** (`tenantOperable`). Decir explícitamente si esta funcionalidad es una excepción y por qué — el soporte, por ejemplo, lo es.
- Un ambiente en prueba tiene módulos en **vista previa** y no puede invitar personas reales. Decir cómo se comporta ahí.

**8. Reglas de negocio y validaciones** — lo que siempre debe ser cierto, redactado de forma verificable. «Un ticket cerrado no admite respuestas» es una regla; «el sistema debe ser robusto» no lo es.

**9. Notificaciones y correo** — quién se entera de qué, por qué canal y con qué remitente. En Vivaru el correo transaccional sale por `functions/src/email.ts` con el remitente verificado; los formularios del landing usan otra ruta. **No prometer plazos de respuesta** que el producto no controle.

**10. Criterios de aceptación** — en formato verificable, uno por regla y por camino de error. Quien pruebe tiene que poder marcar sí o no sin interpretar. Incluir los casos que **deben fallar**.

**11. Arquitectura y dependencias** — aquí sí se decide implementación, y una decisión es obligatoria:

> **¿Escritura directa desde el cliente, o Cloud Function?**
> Callable si hay lógica de negocio, permisos cruzados, correo, escritura en varias colecciones o algo que el cliente no debe poder falsificar. Escritura directa si es un CRUD que las reglas pueden proteger por completo. **Elegir mal aquí es la causa más común de agujeros de permisos en este producto.**

Declarar además: colecciones nuevas y sus reglas, índices, jobs programados, feature flags y componentes compartidos.

**12. Riesgos y mitigaciones** — de datos, de permisos, de adopción, de operación y de coste. Para cada uno, qué señal lo detecta.

**13. Despliegue, rollback y Story Map** — orden de despliegue (en Vivaru: **reglas → functions → front**; al revés la interfaz llama a lo que aún no existe), cómo se revierte, qué se valida en staging y qué solo se puede validar en producción. Actividades del MVP y de fases posteriores.

## Paso 6 · Las puertas

- **`G0 Necesidad`** — el problema existe y está medido.
- **`G1 Valor`** — hay baseline y una métrica que dirá si funcionó.
- **`G2 Datos y permisos`** — el modelo y los roles están definidos y son consistentes con lo que ya existe.
- **`G3 Riesgo`** — hay validación, auditoría y forma de revertir.
- **`G4 Aceptación`** — los criterios permiten aprobar o rechazar sin discusión.
- **`G5 Operación`** — está claro quién opera esto cada día y con qué herramienta.
- **`G6 Escala`** — aguanta el volumen esperado sin degradar coste ni experiencia.

No presentar como **lista para desarrollo** algo que no supere G0–G3. No presentar como **lista para producción** algo que no supere G4–G5.

`G5` es la que más se olvida: una funcionalidad que nadie atiende es una funcionalidad que se pudre.

## Paso 7 · Verificar el portafolio

Colisión de identificadores · dependencias previas · componentes compartidos · solapamiento con soluciones hermanas · coherencia con roles, módulos y datos reales · supuestos que ya quedaron anulados.

## Estados permitidos

`Idea → Discovery → Lista para PRD → En desarrollo → En staging → Productiva → Pausada o retirada`

## Reglas no negociables

- La PRD describe **resultado y reglas**, no implementación — salvo en la sección que existe para eso.
- Todo rol tiene declarado lo que puede **y lo que no**.
- Todo estado tiene dueño y transición de salida.
- Todo dato de tenant lleva `tenantId`, y toda consulta de lista lo filtra.
- Decidir y justificar **cliente directo contra callable**.
- Criterios de aceptación verificables, incluyendo los que deben fallar.
- Declarar el comportamiento en conjuntos **suspendidos, vencidos y en prueba**.
- Incluir rollback. Si algo no es reversible, decirlo en primera línea.
- No prometer plazos de respuesta humana desde el producto.
- Etiquetar recomendaciones, supuestos y `TBD`.
- Si la solución obvia es una regla determinística, **no inventar complejidad**.

## Formato de salida

Según lo pedido: la clasificación y por qué merece PRD · la PRD completa o la revisión con hallazgos · dependencias y solapamientos · riesgos, métricas y puertas pendientes · preguntas abiertas **solo** cuando cambien materialmente el alcance.

Lenguaje ejecutivo y verificable. Recomendaciones como recomendaciones, hechos como hechos.

## Checklist de cierre

- [ ] Superó la puerta «¿merece una PRD?»
- [ ] Tipo y portales explícitos
- [ ] ID sin colisión, o marcado como tentativo
- [ ] Problema, baseline y métrica de éxito
- [ ] Alcance y exclusiones definidos
- [ ] Por cada rol: qué puede y qué NO
- [ ] Estados con dueño y salida
- [ ] Contrato de datos con `tenantId`, retención y borrado
- [ ] Comportamiento en suspendido, vencido y en prueba
- [ ] Reglas de negocio redactadas de forma verificable
- [ ] Notificaciones con canal y remitente, sin promesas de plazo
- [ ] Criterios de aceptación, incluidos los casos que deben fallar
- [ ] Decisión cliente/callable tomada y justificada
- [ ] Orden de despliegue y rollback
- [ ] Quién opera esto a diario
- [ ] Sin solapamiento ni supuestos obsoletos
