# Modelo de priorización — impacto y esfuerzo de cada necesidad

> **Qué es.** La regla con la que se valora cada necesidad de Vivaru —un requerimiento, un caso o
> defecto, una mejora, un frente o una PRD candidata— para ordenar el backlog: cuánto vale (para quien
> usa el producto y para el negocio), cuánto cuesta construirla de verdad, qué necesita antes y qué
> puede romper. **No se califica nada sin mirar antes el código, los datos y los documentos.**
>
> **Estado al 15 sep 2026: v0.1, SIN CALIBRAR.** Lo pidió David el 15 sep y aprobó los ocho cambios
> que salieron de revisar lo que hay en el mercado (§12). **David confirmó el mismo día los valores de
> §11**: el peso 50/50 entre cliente y negocio, el factor de la urgencia, la unidad de esfuerzo, los
> umbrales de los cuadrantes y el primer lote. La calibración de §9 puede ajustarlos, y cada ajuste se
> anota allí con su razón.
>
> **Lo que NO es.** No decide: ordena y enseña lo que se gana y lo que se pierde con cada opción. **Elige David.** Tampoco
> sustituye a `crear-prd-vivaru`: la valoración va antes de preguntar si algo merece una PRD, y la PRD
> puede citar la ficha.

---

## 0. En una página

- **Se valora el problema, no la solución.** Primero se decide si el problema merece resolverse; cómo
  resolverlo viene después, y una misma necesidad puede tener dos soluciones con esfuerzos distintos.
- **Dos puertas antes de puntuar.** Lo **obligatorio** (ley, seguridad, integridad del dinero, datos
  personales) no compite: va por delante. Lo de **talla XS** no se puntúa: se agrupa en un lote y se hace.
- **Cinco pasos, y no se califica antes del tercero:** el expediente (§3), qué requiere y qué puede
  romper (§4), el impacto (§5), el esfuerzo (§6) y la decisión (§7).
- **Impacto en dos ejes, como pidió David:** valor al cliente final y valor al negocio, cuatro criterios
  de 0 a 3 cada uno, **con definición de cada nota**. Más la **urgencia** (el coste de esperar) y la
  **confianza**, que baja la nota de lo que no está medido.
- **Esfuerzo en sesiones de trabajo, contando todo lo que conlleva**: construir, datos, verificar,
  desplegar y cerrar. Lleva coeficiente de riesgo y un recargo por integrar. **Y el tiempo de David se cuenta
  aparte**: permisos, validar en el navegador, reautenticar, decidir. Es el recurso escaso.
- **Puntuación = (valor + 2 × urgencia) × confianza ÷ esfuerzo.** Encima mandan cuatro reglas: lo
  obligatorio primero, lo que desbloquea antes que lo que depende, cerrar antes que abrir, y solo se
  elige lo que no está frenado.
- **Antes de fiarse del modelo, se comprueba** (§9): calibrarlo con entregas ya hechas, valorar dos veces
  a ciegas y ver cuánto coinciden, y falsarlo con casos de respuesta obvia.

---

## 1. Qué se valora

| Tipo | Ejemplo en Vivaru | Particularidad |
|---|---|---|
| **Requerimiento** | Un candidato de Habitanto (`A8`, parqueaderos) | Suele ser Nuevo o Parcial |
| **Caso o defecto** | Una rareza del contrato de la semilla (`H.41`, el logo) | El dolor se mide con probabilidad × gravedad (§5.1) |
| **Mejora** | Un ajuste a algo que ya funciona | Casi siempre cae en la puerta XS o en relleno |
| **Frente** | «Encender presupuesto en un conjunto real» | Se valora entero; si pasa de XXL, se parte |
| **PRD candidata** | Una ficha por escribir | La valoración va antes de la puerta «¿merece PRD?» |

**La unidad es la necesidad.** Si llega una solución («poner un botón que…»), se escribe primero el
problema que resuelve y se valora ese problema. Así lo hace la disciplina de «problema antes que
solución» (§12): priorizar funcionalidades directamente se salta la pregunta de si el problema merece
resolverse.

**Relación con lo que ya existe.** La prioridad P0–P3 de `docs/prd/candidatos-prd-desde-habitanto.md` se
queda como etiqueta de origen: P0 («desbloquea») pasa a ser el criterio *Desbloqueo* (§5.2). El freno
A/B/C del menú de `docs/pendientes.md` no se toca: es el filtro de §7. Y el horizonte y la prioridad del
backlog de Notion se derivan de la puntuación, no al revés.

---

## 2. Las dos puertas, antes de puntuar

### 2.1 Lo obligatorio no compite

Pasa la puerta si se cumple **una** de estas, con prueba de nivel 0,5 o más (§5.4):

- lo exige una **ley** del país del conjunto (México, Colombia o Ecuador) o la protección de datos;
- hay **acceso indebido** entre roles o entre conjuntos (el patrón de `FIX-004` y `CF8`);
- está en juego la **integridad del dinero**: un cobro, un saldo, un asiento o un recibo que puede quedar mal;
- hay **datos personales** expuestos o conservados de más.

Lo obligatorio va por delante de todo lo puntuado. Se le valora igual el esfuerzo, para planificarlo,
y el impacto, para ordenar entre obligatorios.

### 2.2 Lo pequeño no se puntúa

Pasa la puerta si **todo** esto es cierto: cabe en media sesión, no toca reglas, dinero ni datos de
producción, y no pide ninguna intervención de David. **Se agrupa en un lote de XS y se hace**; puntuarlo
cuesta más que construirlo. Los textos sin traducir de la `H.47` son el caso típico.

---

## 3. Paso 1 · El expediente: mirar antes de calificar

**Sin expediente no hay puntuación**: la necesidad queda «por analizar». Cada dato lleva fecha y de
dónde sale; lo que no se pudo medir se dice.

| Qué | Cómo se obtiene | Qué se anota |
|---|---|---|
| **Estado en el código** | Leyendo el código, en `src/`, `components/` y `features/` de la raíz y `functions/src/`. Los documentos no valen como fuente del estado | Nuevo · Parcial · Distinto, con la ruta del fichero y la función |
| **Los datos que lo alimentan** | Contando filas con los scripts de `functions/scripts/` (solo lectura), por conjunto y ambiente | Cuántas filas, en qué conjuntos, con qué banderas. **Encender no es poner en uso** |
| **De dónde sale el dolor** | La fuente, dicha en voz alta: la sesión con la administradora, la ley, la competencia, el recorrido de la demo o el código | Cuál es, con cita. Una pasada por las pantallas no dice qué duele: los huecos grandes fueron ley, dolor y rodeo |
| **Qué más lo toca** | El índice de PRD (`docs/prd/README.md`), la tabla de tomados de los candidatos, las rarezas del §H, el inventario de Notion | Solapes y fichas que ya lo declaran |

Tres reglas del expediente, porque ya costaron caras:

- **Buscar en todo el árbol**, no solo en `src/`: hay pantallas en `components/` y `features/` de la raíz.
- **Contar, no citar.** Un número copiado de otro documento se vuelve a medir; un número derivado
  («quedan N») lleva su regla escrita junto a él.
- **Clasificar por el catálogo, no por la forma**: un nombre de campo no dice qué contiene.

---

## 4. Paso 2 · Qué requiere y qué puede romper

Este paso contesta la segunda mitad de la petición —«lo que se requiere para construir cada una o lo
que puede llegar a afectar ese cambio»— y **alimenta directamente el esfuerzo** del paso 4.

### 4.1 Dependencias

Otras iniciativas que tienen que ir antes, datos que hay que sembrar, decisiones de David y terceros
(el abogado, Albert, un cliente real). **Cada dependencia abierta fija el freno**: una decisión de
David → B; un tercero o un dato que no tenemos → C.

### 4.2 Superficies que toca

Se marca cada una, con el fichero:

- [ ] **Portales**: `/admin`, `/resident`, `/guard`, `/superadmin`, el landing. Cada portal añadido
      multiplica el esfuerzo y las pruebas.
- [ ] **Callables**, **disparadores** y **cron** de `functions/src/`.
- [ ] **`firestore.rules`** y, aparte, **`storage.rules`**: son dos ficheros y se resuelven distinto.
- [ ] **Índices compuestos**, en las dos direcciones si hay `orderBy`. Un campo opcional en el `where`
      son dos consultas con dos índices.
- [ ] **Catálogo de banderas**, que vive en cinco sitios.
- [ ] **Espejos entre front y servidor**: el catálogo de avisos, la clave de unidad, `tenantOperable`
      y `assertTenantOperable`, `calcularSaldo`, el vocabulario por país. **Si cambias uno, cambias
      el otro.**
- [ ] **Avisos, correo y push.** Mirar a qué direcciones se escribe antes de abrir un camino de correo.
- [ ] **PDF y XLSX del servidor**, que ninguna suite lee.
- [ ] **Semillas y scripts** que escriben esa colección.
- [ ] **Documentación**: la wiki, el roadmap, la bitácora y el traspaso.

La lista completa de trampas vive en `wiki-producto/wiki/decisiones/trampas-conocidas.md` y en
`CLAUDE.md`; esta es la parte que decide el tamaño.

### 4.3 Radio

- **Quién gana o pierde acceso.** Si una regla restringe, se mide el radio antes (con
  `medir-radio-membresias.mjs`) y **el orden de despliegue se invierte**.
- **Qué datos se migran** y si el cambio es reversible: una bandera se apaga; una regla o una
  migración, no.
- **Si toca dinero**: entonces pasa por la puerta de §2.1 o, como mínimo, sube el coeficiente de riesgo.

### 4.4 Gemelos

Dónde más vive el mismo concepto. **Se busca el concepto, no quién llama a la función**: un `grep` del
nombre da los consumidores, no los que lo duplican. El camino hermano que ya lo hace bien suele estar
en el mismo fichero, y es la mejor pista de la talla.

---

## 5. Paso 3 · Impacto

Cada criterio se puntúa de 0 a 3 **con la definición de su tabla**, y cada nota lleva su prueba y
el nivel de esa prueba (§5.4). Si dos personas leen la misma prueba y ponen notas distintas, la
definición está mal escrita (§9.2).

### 5.1 Valor al cliente final (VC, de 0 a 12)

El cliente final es quien usa el producto: la administración (`tenant_admin`), el residente
(`resident`), la portería (`security_guard`) y el consejo (`committee`).

| Nota | **Dolor** | **Obligación** | **Rodeo** | **Alcance** |
|---|---|---|---|---|
| **0** | Sin prueba de que a alguien le duela | Ninguna | No hay rodeo: simplemente no se hace | Un rol, un caso raro |
| **1** | Molestia ocasional o cosmética: confunde, pero la tarea se completa | Buena práctica o expectativa del mercado (la competencia lo tiene) | Rodeo breve dentro del producto | Un rol, en uso habitual |
| **2** | Frena una tarea mensual, o da un dato equivocado que alguien lee | Lo pide el reglamento del conjunto, un contrato o **una promesa escrita del producto** (una pantalla que dice que hace algo que no hace) | Se hace fuera del producto (Excel, correo, WhatsApp) cada mes | Dos roles, o todos los residentes de un conjunto |
| **3** | Frena una tarea semanal o diaria, o hace decidir con un dato falso (dinero o acceso) | Lo exige una ley del país del conjunto | Se hace fuera cada semana, o el rodeo produce errores (volver a teclear, archivos aparte) | Tres roles o más, o todos los conjuntos |

**Alcance es estructural, no medido**: sin clientes no hay usuarios que contar, así que no se usa el
«alcance» de RICE (usuarios por trimestre). Se cuentan roles, unidades y conjuntos que lo tocan.

**Para un defecto, el Dolor sale de probabilidad × gravedad**, no de la tabla:

| | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **Gravedad (G)** | Cosmético | Confunde | Dato equivocado a la vista | Dinero, acceso o pérdida de datos |
| **Probabilidad (P)** | No pasa con datos reales | Raro | Con el uso normal | Siempre o casi siempre |

**Dolor = G si P ≥ 2; G − 1 si P = 1 (mínimo 0); 0 si P = 0.** Un defecto con G = 3 y P ≥ 1 pasa
además por la puerta de §2.1.

### 5.2 Valor al negocio (VN, de 0 a 12)

| Nota | **Ingreso** | **Riesgo que quita** | **Desbloqueo** | **Cierre** |
|---|---|---|---|---|
| **0** | Ninguno: ni se ve en la demo ni lo pide nadie | Ninguno | No desbloquea nada | Abre un frente nuevo |
| **1** | Mejora la demo acompañada o la prueba de 15 días, sin ser decisivo | De imagen, menor (un texto en inglés, un formato raro) | Facilita una iniciativa | Extiende un frente abierto |
| **2** | Lo pide un prospecto o el canal por escrito; es un hueco contra Habitanto que se nota en la demo; o amplía las unidades con plataforma completa | Un dato equivocado a la vista de un cliente, o la reputación del dominio de correo | Es requisito de una iniciativa | Cierra un cabo de un frente abierto (un criterio sin cumplir, un cabo como T3.5) |
| **3** | Sin esto, una venta concreta no cierra o un cliente se va (bloquea la conversión o la renovación) | Dinero, acceso indebido, datos personales o riesgo legal | Es requisito de dos o más, o de un P0 | Pone en uso algo desplegado y apagado, o cierra un frente entero |

**Ingreso, leído con el modelo de reventa.** El precio va por unidades con plataforma completa; en
México y Ecuador el canal compra y revende, en Colombia factura Qintilab; la demo es acompañada para
todos; la prueba de 15 días es herramienta, no etapa. De ahí las cuatro formas de tocar el ingreso:
**vender** (la demo, un prospecto), **convertir** (de la prueba al pago), **ampliar** (más unidades o
más conjuntos) y **retener** (la renovación). **Mientras no haya clientes, retener casi nunca pasa de
0,3 de confianza.**

**Cierre** es el criterio de David del 24 ago: cerrar antes que abrir, y **lo desplegado y apagado
cuenta como abierto**. Encender suele ser el mejor retorno porque no cuesta código, pero no es
gratis en atención.

### 5.3 Urgencia: el coste de esperar (U, de 0 a 3)

| Nota | Situación |
|---|---|
| **0** | Puede esperar sin coste |
| **1** | Su valor baja despacio: conviene este trimestre |
| **2** | Ventana de 1 a 3 meses: una demo agendada, una temporada, un plazo de contrato |
| **3** | Plazo en menos de un mes, o **el coste crece cada día**: un dato que se corrompe, dinero que se pierde, algo que caduca (el caso de `REVOPS-001E`, un conjunto creado sin atribución que ya no se reatribuye) |

Sale de WSJF (§12), que ordena por el coste de esperar. Va aparte del valor porque algo valioso sin
plazo puede esperar, y algo modesto con plazo no.

### 5.4 Confianza (C)

| Nivel | Prueba |
|---|---|
| **1,0** | **Medido o reproducido**: contado en la base, reproducido en pantalla con datos, visto en producción |
| **0,8** | **Lo dijo quien usa el producto**: la sesión con la administradora, un cliente o un prospecto, por escrito o grabado |
| **0,5** | **Leído**: en el código, en la ley, en la competencia o en el recorrido de la demo |
| **0,3** | **Especulación**: nadie lo dijo, nada lo midió |

**La confianza de la valoración es la de la prueba más débil entre los criterios con nota 2 o 3**,
porque esos son los que cargan la puntuación. Una nota alta apoyada en una especulación no se compensa
con otras bien medidas. Mientras no haya clientes, casi nada pasará de 0,8, y el modelo tiene que
enseñarlo en vez de disimularlo.

**Una existencia leída no es un impacto medido.** Un defecto confirmado en el código existe con certeza;
cuánto muerde sin clientes es otra cosa. La confianza va sobre el impacto.

---

## 6. Paso 4 · Esfuerzo: todo lo que conlleva

### 6.1 La unidad: la sesión de trabajo *(confirmada, §11)*

Una **sesión** es una ventana de trabajo con Claude que acaba en un punto de corte limpio
(`CLAUDE.md`). Las tallas siguen la serie de Fibonacci, que obliga a comparar tamaños en vez de fingir precisión:

| Talla | XS | S | M | L | XL | XXL | Más |
|---|---|---|---|---|---|---|---|
| **Sesiones** | ≤ 0,5 | 1 | 2 | 3 | 5 | 8 | **Se parte en entregas** |

### 6.2 Los cinco componentes

Cada uno se estima en sesiones y con su coeficiente de riesgo:

| Componente | Qué incluye |
|---|---|
| **Construir** | El código de cada superficie marcada en §4.2 |
| **Datos** | Migrar, sembrar o rellenar hacia atrás; los scripts y su prueba en seco |
| **Verificar** | Los cuatro bancos, el emulador, el navegador con sesión, las pruebas que piden dos personas o un teléfono, y la falsación |
| **Desplegar** | Los dos ambientes, el orden (que se invierte si la regla restringe), las banderas y el encendido |
| **Cerrar** | El traspaso, el roadmap, la bitácora, la wiki, Notion y la memoria |

### 6.3 Coeficiente de riesgo e integración

| Coeficiente | Cuándo |
|---|---|
| **1,0** | Terreno conocido: hay un gemelo que ya lo hace bien |
| **1,3** | Pocas incógnitas: una o dos vueltas de más |
| **1,5** | Poco documentado o de infraestructura: reglas de Storage, App Hosting, emulador, índices |
| **2,0** | Posible callejón sin salida: un servicio externo, una ley sin abogado, un comportamiento sin documentar |

**Esfuerzo = Σ (componente × su coeficiente) × (1 + integración)**, con integración de **0 %** si toca
una superficie, **10 %** si toca dos o tres y **20 %** si toca cuatro o más. Las piezas funcionan solas y
se rompen al juntarlas.

### 6.4 El tiempo de David, aparte

Se cuentan **las intervenciones**, con una estimación en minutos:

- permisos de producción (uno por paso, nunca en bloque);
- validación en el navegador con su sesión;
- reautenticar una credencial (ADC, CLI de firebase, gcloud);
- decisiones de producto;
- la consola, Squarespace o cualquier cosa que solo él puede tocar;
- una conversación con un tercero.

**No entra en la división de la puntuación: es la capacidad.** Al armar un lote, se suman las
intervenciones y se comparan con el tiempo que David tiene; si no alcanza, se prefieren las necesidades
con menos intervenciones.

### 6.5 Cinco errores de estimación que el modelo prohíbe

1. **Anclar en tiempos humanos** («un desarrollador tardaría dos semanas»). Se parte de las sesiones.
2. **Acolchar a ojo.** Toda holgura es un coeficiente con su razón escrita.
3. **Confundir volumen con dificultad.** Quinientas líneas repetitivas no son difíciles; una línea de
   regla puede serlo.
4. **Olvidar la integración** y el cierre, que aquí es trabajo de verdad.
5. **Ignorar el cuello de botella de la persona**: un permiso de producción es una espera, no una
   sesión de más; va en §6.4.

---

## 7. Paso 5 · Decisión

### 7.1 La puntuación

```
VC     = Dolor + Obligación + Rodeo + Alcance                  (0–12)
VN     = Ingreso + Riesgo que quita + Desbloqueo + Cierre     (0–12)
Valor  = 0,5 × VC + 0,5 × VN                                    (0–12)   ← pesos de §11
CdE    = Valor + 2 × U                                          (0–18)   ← factor de §11
Impacto ajustado = CdE × C
Puntuación       = Impacto ajustado ÷ Esfuerzo (sesiones)
```

**Ejemplo ilustrativo, con números inventados para enseñar la cuenta** (no es la valoración de nada):
VC = 7, VN = 5 → Valor = 6. U = 1 → CdE = 8. C = 0,5 → Impacto ajustado = 4. Esfuerzo = 2 sesiones
× 1,3 × 1,10 = 2,86. **Puntuación = 4 ÷ 2,86 = 1,4.**

### 7.2 El cuadrante *(umbrales de §11, a ajustar con la calibración)*

| | Esfuerzo < 3 sesiones | Esfuerzo ≥ 3 sesiones |
|---|---|---|
| **Impacto ajustado ≥ 6** | **Ganancia rápida:** primero | **Apuesta:** se planifica y se parte |
| **Impacto ajustado < 6** | **Relleno:** entre frentes | **Pozo:** no se hace sin una razón nueva |

### 7.3 Cuatro reglas por encima de la puntuación

1. **Lo obligatorio primero** (§2.1).
2. **Lo que desbloquea va antes que lo que depende**, aunque puntúe menos: una pieza de poco valor que
   destraba tres de mucho sale primero.
3. **Cerrar antes que abrir.** Entre dos con puntuaciones parecidas (diferencia menor al 25 %), va
   primero la que cierra. Si esta regla contradice una recomendación anterior, **se dice en voz alta**.
4. **Solo se elige lo que no está frenado.** Lo construible (A) se puede elegir hoy. Lo que espera una
   decisión de David (B) va a su lista **ordenado por puntuación**, que dice qué decisión vale más la pena tomar
   primero. Lo que espera a un tercero (C) espera.

**Solo se comparan puntuaciones del mismo lote.** Una puntuación de hoy y una de hace un mes pueden
haberse hecho con pruebas distintas.

### 7.4 Decide David

El modelo propone un orden y, cuando dos opciones compiten por la misma capacidad, enseña la
comparación:

```markdown
## Qué se gana y qué se pierde: [A] frente a [B]
- A: puntuación · cuadrante · freno · qué se gana · qué cuesta esperarla
- B: lo mismo
- Qué inclina la balanza: [la regla de §7.3 que aplica, la capacidad de David, una fecha]
Decide David.
```

---

## 8. La ficha de valoración

Una por necesidad. Las pequeñas caben en una fila de la tabla del lote; las grandes llevan ficha entera.

```markdown
### [Id] — [Título, por resultado]
**Tipo:** requerimiento · caso/defecto · mejora · frente · PRD candidata   **Valorado:** [fecha], [quién]

**Problema** (sin la solución): …
**Solución propuesta**, si la hay: …

**Puertas:** obligatorio [sí/no, por qué] · XS [sí/no]

**Expediente**
- Estado en el código: Nuevo / Parcial / Distinto — [ruta:función]
- Datos: [qué se contó, cuánto, dónde, fecha, script]
- De dónde sale el dolor: [fuente, con cita]
- Solapes: [fichas, candidatos, rarezas]

**Qué requiere y qué puede romper**
- Dependencias: … → freno [A/B/C]
- Superficies: [la lista de §4.2 marcada]
- Radio: [acceso · migración · dinero · reversibilidad]
- Gemelos: …

**Impacto**
| Criterio | Nota | Prueba | Nivel |
|---|---|---|---|
| Dolor (o G × P) | | | |
| Obligación | | | |
| Rodeo | | | |
| Alcance | | | |
| Ingreso | | | |
| Riesgo que quita | | | |
| Desbloqueo | | | |
| Cierre | | | |
| **Urgencia** | | | |
**Confianza:** [nivel de la prueba más débil entre las notas de 2 o 3]

**Esfuerzo**
| Componente | Sesiones | Coeficiente | Por qué |
|---|---|---|---|
| Construir | | | |
| Datos | | | |
| Verificar | | | |
| Desplegar | | | |
| Cerrar | | | |
Integración: [0/10/20 %] · **Total: N sesiones** · Intervenciones de David: [lista, minutos]

**Resultado:** puntuación · cuadrante · freno · reglas de §7.3 que aplican
**Qué cambiaría la valoración:** [la prueba que la movería, y hacia dónde]
**Sensibilidad:** ¿cambia el orden si el esfuerzo fuera el doble?
```

La línea «qué cambiaría la valoración» es la más útil del lote: dice qué prueba conviene conseguir
primero.

---

## 9. Cómo se comprueba el modelo antes de fiarse de él

Un verde no vale sin falsación, y una escala que no distingue pasa cualquier prueba. Tres pruebas, en
este orden:

### 9.1 Calibración con lo ya construido

Se valoran **seis a ocho entregas de la bitácora** como si no estuvieran hechas, con el expediente que
había antes de construirlas, y se compara con lo que costaron de verdad: sesiones (días con commits
del frente en `git log`) e intervenciones de David (el traspaso y la bitácora). Candidatas, por
variedad de talla:

- la compuerta de morosos en reservas (`H1`, «la más barata»);
- Medidores abriendo en el último mes con lecturas (`H.51`, `bb238da`);
- medición de consumos (`FEAT-008`);
- cuentas por pagar en cuotas (`FLOW-008`);
- push en iPhone (`PLAT-005`);
- las ventanas del Panel de Control (`UX-004`).

**Criterio:** si en más de la mitad el esfuerzo real se desvía más del 50 % de la estimación, se
reescriben las tallas o los coeficientes. Y el orden que da el modelo tiene que parecerse al que
eligió David; donde no se parezca, se busca el criterio que falta.

### 9.2 Doble valoración a ciegas

**Diez necesidades, valoradas por dos agentes independientes con el mismo expediente.** Todo criterio
en el que difieran más de un punto en más del 30 % de los casos tiene la definición mal escrita, y se
reescribe. Es la lección del gold set de PQRS: con definiciones vagas, dos calificadores coincidieron
poco más que al azar (kappa 0,47).

### 9.3 Falsación con casos de respuesta obvia

Tienen que salir donde se espera; si no, el modelo está roto:

- **`H.47`** (textos sin acento) → puerta XS, sin puntuar.
- **Una necesidad bloqueada por el abogado** (`FLOW-006`) → freno C, **sea cual sea su puntuación**.
- **Un defecto de dinero reproducido** → puerta de obligatorio.
- **La dispersión**: en un lote de diez, las puntuaciones no pueden salir todas en el mismo cuadrante.
  Si salen, las definiciones no distinguen.

Estos casos serán además **las pruebas de la skill** (§10), como hace `orchestkit` con las suyas.

---

## 10. Dónde vive y cómo se mantiene

- **Este documento es la regla.** Se cambia aquí y en ningún otro sitio; lo demás lo cita.
- **Las valoraciones**, un fichero por lote: `docs/valoraciones/lote-AAAA-MM-DD.md`, con la tabla del lote
  y las fichas grandes debajo. **Por escribir.**
- **La skill `valorar-iniciativa-vivaru`** ejecuta los cinco pasos y produce la ficha, como las de
  PRD. Lleva los casos de §9.3 como pruebas. **Por escribir.**
- **Notion:** columnas nuevas en «Backlog e inventario detallado» (impacto ajustado, esfuerzo,
  confianza, puntuación, freno). **Pide el permiso de David** antes de tocar el esquema.
- **Cuándo se revalora:** cuando cambia la prueba —llega un cliente, se mide algo, aparece un plazo— y
  antes de armar cada menú de `docs/pendientes.md`. Una valoración vieja se marca con su fecha, no se
  cita como si fuera de hoy.

---

## 11. Los valores de partida

**Confirmados por David el 15 sep 2026**, tal como se recomendaron. La calibración de §9.1 puede
ajustarlos; si lo hace, el cambio se anota aquí con su fecha y su razón.

| Qué | Valor | Por qué ese |
|---|---|---|
| Peso cliente / negocio | **50 / 50** | La confianza ya castiga el valor al cliente no medido; subir el negocio lo castigaría dos veces |
| Factor de la urgencia | **2 × U** | Una urgencia de 3 (plazo legal) pesa la mitad de la escala de valor |
| Unidad de esfuerzo | **Sesiones**, y las intervenciones de David aparte | Es como se trabaja aquí; lo escaso es la atención de David |
| Umbrales del cuadrante | **Impacto ajustado 6 · esfuerzo 3 sesiones** | A ojo; los fija la calibración |
| Primer lote después de calibrar | **El menú de `pendientes.md` y las rarezas del §H** | Es entre lo que se elige ahora; los 82 candidatos de Habitanto van después |

**Y una duda del recuento, previa al primer lote:** el menú cuenta 28 rarezas sin decidir
(`H.21`–`H.50`, salvo `H.31` y `H.37`), pero `H.1`–`H.20` también dicen «quedan para decidir aparte» y
no se encontró dónde se decidieron. El lote las incluye salvo que David diga lo contrario.

---

## 12. De dónde salen las ideas

Revisado el 15 sep 2026 con `find-skills`: ocho búsquedas y las fuentes completas de las candidatas con
buena reputación. **Ninguna mira el estado de la plataforma antes de calificar ni analiza qué rompe un
cambio en el código**, y ninguna específica de priorización pasa de 150 instalaciones. No se instaló
ninguna. De las que tienen licencia MIT se toma el método; de las que no la declaran, solo la idea.

| Idea | De dónde | Licencia |
|---|---|---|
| Confianza en cuatro niveles ligados a la prueba; el coste de esperar (WSJF) para lo que tiene plazo; «decide la persona»; solo comparar dentro del mismo objetivo; la skill con sus propias pruebas | `yonatangross/orchestkit`, skill `prioritization` | MIT |
| Tallas de esfuerzo en Fibonacci; los cuadrantes de valor y esfuerzo | `alirezarezvani/claude-skills`, `product-manager-toolkit` y `senior-pm` | MIT |
| Esfuerzo en unidades del agente, coeficientes de riesgo de 1,0 a 2,0, recargo por integrar, el cuello de botella de la persona aparte | `zhanghandong/agent-estimation` | MIT |
| Las formas de tocar el ingreso (vender, convertir, ampliar, retener); «lo de menos de una semana no se puntúa: se hace»; «qué tendría que cambiar» | `deanpeters/product-manager-skills`, `feature-investment-advisor` | No declarada: solo la idea |
| Sin datos de uso, RICE no sirve: su «alcance» los necesita | `deanpeters/product-manager-skills`, `prioritization-advisor` | No declarada: solo la idea |
| Primero el problema, después la solución | `borghei/claude-skills`, `prioritization-frameworks` | No declarada: solo la idea |
| Probabilidad × gravedad para los defectos | Matriz de riesgo e impacto (`tech-debt-tracker`, `alirezarezvani`) | MIT |

**Lo propio de Vivaru, que no existe en el mercado:** el expediente leído del código y de los datos
(§3), el análisis de lo que rompe con nuestras trampas (§4), la puerta de lo obligatorio con nuestras
definiciones (§2.1), la calibración con nuestra bitácora (§9.1) y la prueba de acuerdo entre
calificadores (§9.2).
