---
name: valorar-iniciativa-vivaru
description: Valorar y priorizar necesidades de Vivaru —requerimientos, defectos o rarezas, mejoras, frentes o PRD candidatas— con el modelo de impacto y esfuerzo del repositorio (`docs/modelo-de-priorizacion.md`). Mira el código, los datos y los documentos antes de calificar; analiza qué requiere cada una y qué puede romper; estima el impacto para el cliente final y para el negocio, y el esfuerzo en horas comparando con entregas ya medidas; y deja una ficha por necesidad y el orden del lote. Úsala cuando haya que priorizar el backlog, armar el menú de lo que sigue, comparar frentes, estimar cuánto cuesta o cuánto tarda algo, o saber qué afecta un cambio. Palabras que la disparan: priorizar, prioridad, impacto, esfuerzo, estimar, cuánto cuesta, cuánto tarda, backlog, qué sigue, qué hacemos primero, valorar, puntuar, análisis de impacto, qué rompe, qué requiere. No escribe la PRD (para eso, `crear-prd-vivaru` o `crear-prd-ia-vivaru`) y no elige: ordena, y decide David.
---

# Valorar una necesidad de Vivaru

Convertir una necesidad en una valoración que se pueda comprobar: cuánto vale, cuánto cuesta, qué requiere, qué rompe y qué la frena. **El criterio de calidad es uno solo: que otra persona, con las mismas pruebas, llegue a las mismas notas.**

## El principio superior

> **La regla vive en `docs/modelo-de-priorizacion.md`; esta skill la ejecuta.** Leer el modelo entero antes de valorar y anotar su versión (está en su cabecera). Las escalas, las definiciones de cada nota, la fórmula, los umbrales y la tabla de referencias **se leen de ahí, no de esta skill**. Si algo de aquí contradice al modelo, manda el modelo, y se avisa a David de la discrepancia.

El modelo se calibró tres veces contra entregas reales antes de escribir esta skill. **Las dos primeras versiones fallaban** —el esfuerzo salía inflado hasta 8,6 veces, y la mayoría de lo que David eligió caía en «no se hace»—, así que saltarse un paso del modelo no es un atajo: es volver a una versión que ya se sabe que falla. Historia en `docs/valoraciones/calibracion-2026-09-15*.md`.

## Antes de empezar

1. **`git status` y la rama.** La valoración lee el código de la rama en la que se está.
2. **Leer el modelo entero** y anotar su versión.
3. **Comprobar si el «Día uno» sigue activo.** Caduca cuando llega el primer cliente real (§5.2 del modelo). Se mira, no se recuerda: `node scripts/leer-monedas.mjs hogaru-1` enseña cada conjunto y si es de ejemplo. **Un conjunto sin marcar no se da por cliente ni por demo: se pregunta a David.**
4. **Definir el lote**: una necesidad o varias. Un lote es lo que se va a comparar entre sí; **solo se comparan puntuaciones del mismo lote** (§7.3).

## Paso 0 · El problema, sin la solución

Escribir en una o dos frases **qué problema** hay y **a quién le pasa**. Si llega una solución («poner un botón que…»), se escribe el problema que resuelve y se valora ese problema; la solución va aparte. Una misma necesidad puede tener dos soluciones con esfuerzos distintos, y entonces son dos filas.

## Paso 1 · Las dos puertas (§2 del modelo)

- **Obligatorio** (§2.1): ley, acceso **indebido**, integridad del dinero o datos personales, con prueba de 0,5 o más. No compite: va por delante. Un acceso **negado** no es esto: va por el Dolor.
- **XS** (§2.2): media hora o menos, sin reglas, dinero ni datos de producción, y sin intervención de David. No se puntúa: se agrupa en el lote de XS y se hace.

## Paso 2 · El expediente (§3): mirar antes de calificar

**Sin expediente no hay nota.** La necesidad queda «por analizar» y se dice qué faltó.

- **Estado en el código**: Nuevo · Parcial · Distinto, con ruta y función. **Buscar en todo el árbol**: `src/`, `components/` y `features/` de la raíz, `functions/src/`, `firestore.rules` y `storage.rules`. Una búsqueda limitada a `src/` ya produjo una afirmación falsa.
- **Los datos**: contar con los scripts de solo lectura de `functions/scripts/` y `scripts/`, con fecha. **Si un script falla por credenciales** (ADC, CLI de firebase o gcloud), se dice a David y se sigue sin ese dato, marcado como no medido. La reautenticación la hace él.
- **De dónde sale el dolor**: la sesión con la administradora (`docs/sesion-administradora-habitanto.md`), la ley, la competencia, el recorrido de la demo o el código. Se cita.
- **Qué más lo toca**: `docs/prd/README.md`, la tabla de tomados de `docs/prd/candidatos-prd-desde-habitanto.md`, las rarezas del §H del contrato de la semilla, el menú de `docs/pendientes.md`.

**La valoración es de solo lectura.** No escribe datos, ni banderas, ni reglas, ni Notion, en ningún ambiente.

## Paso 3 · Qué requiere y qué puede romper (§4)

Recorrer la lista de superficies de §4.2 del modelo y marcar cada una con su fichero. Después, las dependencias (que fijan el freno: una decisión de David → **B**; un tercero o un dato que no tenemos → **C**; nada abierto → **A**), el radio (quién gana o pierde acceso, qué se migra, si toca dinero, si se puede revertir) y los gemelos (**se busca el concepto, no quién llama a la función**).

## Paso 4 · Impacto (§5)

Una fila por criterio, con **clase**, **nota**, **prueba** y **nivel**:

- **Estimaciones del mundo**: Dolor, Obligación, Rodeo, Ingreso, Riesgo que quita, Día uno y Urgencia. Llevan nivel de prueba.
- **Hechos del repositorio**: Alcance, Desbloqueo y Cierre. Se comprueban leyendo; **no llevan descuento**.

La nota sale de la **definición escrita** de cada una en el modelo, no de la impresión. Para un defecto, el Dolor sale de probabilidad × gravedad si da un dato equivocado, y de la tabla general si bloquea una tarea. La confianza se calcula con la regla de §5.4; mientras no haya clientes, casi siempre saldrá 0,5, y hay que decirlo, no disimularlo.

**Si una necesidad no encaja en ninguna definición, no se fuerza la nota**: se pone la más cercana y se anota en el lote como hallazgo de la definición. Así se afinó el modelo tres veces.

## Paso 5 · Esfuerzo (§6)

1. **Elegir las dos referencias más parecidas** de la tabla de §6.2, en este orden: **cuánto existe ya**, si toca dinero o reglas que restringen, y cuántas superficies.
2. **Interpolar sus horas**, sin redondear a una talla.
3. **Comprobar por componentes** (§6.3 y §6.4). Si difiere de la interpolación en más del doble, escribir por qué; manda la interpolación salvo razón concreta. **La descomposición sale alta casi siempre** —cobra un coste fijo por superficie que desaparece cuando hay gemelos—, y en la tercera calibración la interpolación acertó las seis.
4. **Contar las esperas** (§6.5) aparte: cada punto en que la entrega necesita a David. **No entran en las horas.**

**Prohibido anclar en tiempos humanos** («un desarrollador tardaría…»). Es el error que infló la v0.1, y los seis estimadores lo cometieron aunque el modelo lo prohibía por escrito.

## Paso 6 · Decisión (§7)

Puntuación, cuadrante y freno. Encima, las cuatro reglas de §7.3, en orden: lo obligatorio primero; lo que desbloquea antes que lo que depende; cerrar antes que abrir; **solo se elige lo que no está frenado**. Si dos necesidades compiten por la misma capacidad, se enseña la comparación de §7.4.

**La skill no elige.** Propone un orden y dice qué inclinaría la balanza. **Decide David**, y cuando pide «espera a que yo elija», se espera.

## Paso 7 · Guardar

- **El lote va a `docs/valoraciones/lote-AAAA-MM-DD[-tema].md`.** Cabecera: fecha, versión del modelo, si el Día uno está activo, quién valoró y qué no se pudo medir. Después, la tabla del lote y las fichas con la plantilla de §8 del modelo.
- **Cuando una necesidad valorada se construye**, se mide su coste real en `git log` y se propone añadirla a la tabla de referencias de §6.2. Así crece la tabla.
- **Una cifra derivada** («quedan N») lleva su regla y su lista en el fichero, o acabará en cuatro versiones.
- **Commit y push, solo con el sí de David** en el chat.

## Un lote grande

Con cinco necesidades o más, la valoración se puede repartir entre agentes: uno por necesidad, cada uno con el modelo y su necesidad, y la ficha como formato de vuelta. **Cuesta tokens: se dice cuántos agentes y se pregunta antes.** Para la prueba de acuerdo de §9.2, dos agentes independientes por necesidad, con el mismo expediente.

## Reglas no negociables

- Sin expediente, no hay nota.
- Toda nota lleva su prueba y su nivel; lo no medido se dice.
- Los hechos, sin descuento; las estimaciones, con confianza.
- Las horas, por interpolación entre referencias medidas; las esperas, aparte.
- El freno va aparte de la puntuación; solo se elige lo construible.
- La valoración es de solo lectura, en todos los ambientes.
- La skill ordena; David decide.
- Si el modelo y la skill discrepan, manda el modelo, y se avisa.

## Formato de salida

**En el chat:** la tabla del lote ordenada —necesidad · impacto ajustado · horas · puntuación · cuadrante · freno · esperas—, qué cambiaría la valoración de las primeras, las comparaciones que hagan falta y lo que no se pudo medir.

**En disco:** el fichero del lote (Paso 7).

## Las pruebas de esta skill

`casos-de-prueba.md`, en esta misma carpeta, lleva los casos de respuesta obvia de §9.3 del modelo y los que salieron de las calibraciones. **Al cambiar el modelo o esta skill, se corren**: cada caso, valorado por un agente nuevo que solo tenga la skill y el modelo, tiene que salir donde dice el caso. Si uno se mueve, la versión nueva está rota, aunque el resto parezca bien.

## Checklist de cierre

- [ ] Versión del modelo anotada, y Día uno comprobado (activo o caducado)
- [ ] El problema escrito sin la solución
- [ ] Las dos puertas aplicadas
- [ ] Expediente con rutas, datos con fecha (o marcados como no medidos) y fuente del dolor
- [ ] Superficies, dependencias, radio y gemelos; freno A/B/C
- [ ] Diez criterios con clase, nota, prueba y nivel; confianza por la regla de §5.4
- [ ] Horas interpoladas entre dos referencias, comprobadas por componentes; esperas aparte
- [ ] Puntuación, cuadrante y reglas de §7.3
- [ ] «Qué cambiaría la valoración» en cada necesidad
- [ ] Lote guardado en `docs/valoraciones/`; nada escrito en ningún ambiente
