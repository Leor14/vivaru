# Modelo de priorización — impacto y esfuerzo de cada necesidad

> **Qué es.** La regla con la que se valora cada necesidad de Vivaru —un requerimiento, un caso o
> defecto, una mejora, un frente o una PRD candidata— para ordenar el backlog: cuánto vale (para quien
> usa el producto y para el negocio), cuánto cuesta construirla de verdad, qué necesita antes y qué
> puede romper. **No se califica nada sin mirar antes el código, los datos y los documentos.**
>
> **Estado al 15 sep 2026: v0.3, PASA la calibración de esfuerzo (§9.1) a la tercera.** Faltan la doble
> valoración a ciegas (§9.2) y la falsación (§9.3) antes de darla por buena. Lo pidió David el 15 sep y
> aprobó los ocho cambios salidos de revisar el mercado (§12).
> - **v0.1 → v0.2.** La primera calibración no pasó: el esfuerzo salía inflado entre 3,3 y 8,6 veces, y la
>   confianza en 0,5 en todas (`docs/valoraciones/calibracion-2026-09-15.md`). Se pasó a horas, casos de
>   referencia, esperas y confianza solo sobre lo estimado.
> - **v0.2 → v0.3.** La segunda mejoró la escala (1,8 veces) pero perdió el orden, y cinco de seis
>   entregas elegidas por David salían en Pozo (`docs/valoraciones/calibracion-2026-09-15-segunda.md`).
>   David confirmó que las eligió **para llegar listos al primer cliente** y aprobó el mismo día tres
>   cambios: el criterio **«Día uno»** (§5.2), la tabla de **doce referencias** con cuánto existía ya
>   (§6.2) y el **umbral de impacto en 4** mientras no haya clientes (§7.2).
> - **v0.3, tercera pasada.** Seis entregas nuevas, las seis dentro del 50 % (el error más grande, 22 %),
>   sin sesgo y con el orden recuperado (ρ ≈ 0,94). Tres en Ganancia rápida y tres en Relleno, ninguna en
>   Pozo (`docs/valoraciones/calibracion-2026-09-15-tercera.md`). Sus seis entregas pasan a ser
>   referencias: la tabla tiene dieciocho.
>
> **Lo que NO es.** No decide: ordena y enseña lo que se gana y lo que se pierde con cada opción.
> **Elige David.** Tampoco sustituye a `crear-prd-vivaru`: la valoración va antes de preguntar si algo
> merece una PRD, y la PRD puede citar la ficha.

---

## 0. En una página

- **Se valora el problema, no la solución.** Primero se decide si el problema merece resolverse; cómo
  resolverlo viene después, y una misma necesidad puede tener dos soluciones con esfuerzos distintos.
- **Dos puertas antes de puntuar.** Lo **obligatorio** (ley, acceso indebido, integridad del dinero,
  datos personales) no compite: va por delante. Lo de **talla XS** no se puntúa: se agrupa y se hace.
- **Cinco pasos, y no se califica antes del tercero:** el expediente (§3), qué requiere y qué puede
  romper (§4), el impacto (§5), el esfuerzo (§6) y la decisión (§7).
- **Impacto en dos ejes, como pidió David:** valor al cliente final (cuatro criterios) y valor al negocio
  (cinco), de 0 a 3 cada uno, **con definición de cada nota**. Más la **urgencia** (el coste de esperar).
  El quinto del negocio, **«Día uno»**, es la estrategia de hoy —llegar listos al primer cliente— y
  **caduca** cuando llegue.
- **La confianza solo descuenta lo que es una estimación del mundo** —cuánto duele, cuánto vende—. El
  alcance, el desbloqueo y el cierre son **hechos del repositorio** y no llevan descuento.
- **Esfuerzo en horas de trabajo activo, interpolado entre las dos referencias más parecidas** de
  dieciocho entregas medidas en nuestro git (§6.2), y comprobado después por componentes. **El tiempo de David se cuenta como esperas**: lo que cuesta no son
  sus minutos, sino el calendario que corre mientras la entrega lo espera.
- **Puntuación = impacto ajustado ÷ horas.** Encima mandan cuatro reglas: lo obligatorio primero, lo que
  desbloquea antes que lo que depende, cerrar antes que abrir, y solo se elige lo que no está frenado.
- **Antes de fiarse del modelo, se comprueba** (§9): calibrar con entregas ya hechas, valorar dos veces a
  ciegas y ver cuánto coinciden, y falsarlo con casos de respuesta obvia.

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

Pasa la puerta si se cumple **una** de estas, con prueba de nivel 0,5 o más (§5.4). **Es la única puerta
de lo obligatorio**: ningún otro criterio manda aquí por sí solo.

- lo exige una **ley** del país del conjunto (México, Colombia o Ecuador) o la protección de datos;
- hay **acceso indebido** entre roles o entre conjuntos (el patrón de `FIX-004` y `CF8`). Un acceso
  *negado* —alguien que no puede hacer lo que debe— no es esto: va por el Dolor;
- está en juego la **integridad del dinero**: un cobro, un saldo, un asiento o un recibo que puede quedar mal;
- hay **datos personales** expuestos o conservados de más.

Lo obligatorio va por delante de todo lo puntuado. Se le valora igual el esfuerzo, para planificarlo,
y el impacto, para ordenar entre obligatorios.

### 2.2 Lo pequeño no se puntúa

Pasa la puerta si **todo** esto es cierto: cabe en **media hora** de trabajo activo, no toca reglas,
dinero ni datos de producción, y no pide ninguna intervención de David. **Se agrupa en un lote de XS y
se hace**; puntuarlo cuesta más que construirlo. Los textos sin traducir de la `H.47` son el caso típico.

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

Cada criterio se puntúa de 0 a 3 **con la definición de su tabla**, y cada nota lleva su prueba. Los
criterios son de dos clases, y la diferencia importa para la confianza (§5.4):

- **Estimaciones del mundo** —Dolor, Obligación, Rodeo, Ingreso, Riesgo que quita, Día uno y
  Urgencia—: dicen cuánto duele, cuánto vende, cuánto urge, qué necesitará el primer cliente. Su prueba
  puede ser fuerte o débil.
- **Hechos del repositorio** —Alcance, Desbloqueo y Cierre—: se comprueban leyendo el código, las
  fichas y el traspaso. No son una opinión sobre el mundo.

Si dos personas leen la misma prueba y ponen notas distintas, la definición está mal escrita (§9.2).

### 5.1 Valor al cliente final (VC, de 0 a 12)

El cliente final es quien usa el producto: la administración (`tenant_admin`), el residente
(`resident`), la portería (`security_guard`) y el consejo (`committee`).

| Nota | **Dolor** *(estimación)* | **Obligación** *(estimación)* | **Rodeo** *(estimación)* | **Alcance** *(hecho)* |
|---|---|---|---|---|
| **0** | Sin prueba de que a alguien le duela | Ninguna | No hay rodeo: simplemente no se hace | Un rol, un caso raro |
| **1** | Molestia ocasional o cosmética: confunde, pero la tarea se completa | Buena práctica o expectativa del mercado (la competencia lo tiene) | Rodeo breve dentro del producto | Un rol, en uso habitual |
| **2** | Frena una tarea mensual, o da un dato equivocado que alguien lee | Lo pide el reglamento del conjunto, un contrato o **una promesa escrita del producto** (una pantalla que dice que hace algo que no hace) | Se hace fuera del producto (Excel, correo, WhatsApp) cada mes | Dos roles, o todos los residentes de un conjunto |
| **3** | Frena una tarea semanal o diaria, o hace decidir con un dato falso (dinero o acceso) | Lo exige una ley del país del conjunto | Se hace fuera cada semana, o el rodeo produce errores (volver a teclear, archivos aparte) | Tres roles o más, o todos los conjuntos |

**El Alcance cuenta a quién le duele el problema, no dónde existe la pantalla.** Una pantalla que tienen
todos los conjuntos pero cuyo defecto solo aparece con cierta configuración cuenta los conjuntos con esa
configuración. Y es estructural: sin clientes no hay usuarios que contar, así que no se usa el «alcance»
de RICE (usuarios por trimestre).

**Para un defecto, el Dolor depende de lo que hace el defecto:**

- **si bloquea una tarea** —alguien no puede hacer lo que debe—, se lee en la tabla general de arriba;
- **si da un dato o un estado equivocado**, sale de probabilidad × gravedad:

| | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **Gravedad (G)** | Cosmético | Confunde | Dato equivocado a la vista | Dinero, acceso indebido o datos perdidos |
| **Probabilidad (P)** | No pasa con datos reales | Raro | Con el uso normal | Siempre o casi siempre |

**Dolor = G si P ≥ 2; G − 1 si P = 1 (mínimo 0); 0 si P = 0.** Un defecto con G = 3 pasa por la puerta
de lo obligatorio **solo si cumple §2.1**, que es la única puerta.

### 5.2 Valor al negocio (VN, de 0 a 15)

| Nota | **Ingreso** *(estimación)* | **Riesgo que quita** *(estimación)* | **Desbloqueo** *(hecho)* | **Cierre** *(hecho)* |
|---|---|---|---|---|
| **0** | Ninguno: ni se ve en la demo ni lo pide nadie | Ninguno | No desbloquea nada | Abre un frente nuevo |
| **1** | Mejora la demo acompañada o la prueba de 15 días, sin ser decisivo | De imagen, menor (un texto en inglés, un formato raro) | Facilita una iniciativa | Extiende un frente abierto |
| **2** | Lo pide un prospecto o el canal por escrito; es un hueco contra Habitanto que se nota en la demo; **algo que falla a la vista durante la demo acompañada**; o amplía las unidades con plataforma completa | Un dato equivocado a la vista de un cliente, o la reputación del dominio de correo | Es requisito técnico o de datos de una iniciativa | Cierra un cabo de un frente abierto (un criterio sin cumplir, un cabo como T3.5) |
| **3** | Sin esto, una venta concreta no cierra o un cliente se va (bloquea la conversión o la renovación) | Dinero, acceso indebido, datos personales o riesgo legal | Es requisito técnico o de datos de dos o más, o de un P0 | Pone en uso algo desplegado y apagado, o cierra un frente entero |

**Ingreso, leído con el modelo de reventa.** El precio va por unidades con plataforma completa; en
México y Ecuador el canal compra y revende, en Colombia factura Qintilab; la demo es acompañada para
todos; la prueba de 15 días es herramienta, no etapa. De ahí las cuatro formas de tocar el ingreso:
**vender** (la demo, un prospecto), **convertir** (de la prueba al pago), **ampliar** (más unidades o
más conjuntos) y **retener** (la renovación). **Mientras no haya clientes, retener casi nunca pasa de
0,3 de confianza.**

**Desbloqueo cuenta requisitos técnicos o de datos, no el orden de un plan.** Que un plan propio ponga
algo «antes de la fase 3» no lo convierte en requisito: lo es si la otra iniciativa no puede
construirse o no puede funcionar sin él.

**Cierre** es el criterio de David del 24 ago: cerrar antes que abrir, y **lo desplegado y apagado
cuenta como abierto**. Encender suele ser el mejor retorno porque no cuesta código, pero no es
gratis en atención.

#### Día uno *(estimación; criterio temporal)*

**La estrategia de hoy, dicha por David el 15 sep: construir para llegar listos al primer cliente.**
Las dos calibraciones lo destaparon: el modelo habría dicho «no se hace» a la mayoría de las doce
entregas que David eligió, y lo que tenían en común era esto.

| Nota | Situación |
|---|---|
| **0** | Un conjunto puede operar sin esto su primer año |
| **1** | Lo pediría con el tiempo, cuando ya use el producto |
| **2** | **Una administradora lo usa cada mes**: la sesión con la administradora, el inventario de Habitanto o el marco legal lo muestran como parte de su mes |
| **3** | **Sin esto, el primer cliente no puede operar su primer mes en Vivaru**: cobrar, pagar a proveedores, conciliar, informar al consejo o controlar la portería |

- **La prueba más fuerte posible hoy es la sesión con la administradora** (`docs/sesion-administradora-habitanto.md`),
  que vale 0,8 (§5.4). El inventario de Habitanto, que salió de mirar pantallas, vale 0,5.
- **No se cuenta dos veces con el Ingreso.** El Ingreso mira la venta (la demo, un prospecto, un hueco
  que se nota); el Día uno mira la operación del primer mes. Algo puede tener Ingreso 2 porque se ve bien
  en la demo y Día uno 0 porque nadie lo necesita para operar, o al revés.
- **Caduca.** Cuando llegue el primer cliente, el criterio se retira: lo que necesita pasa a medirse como
  Dolor, Rodeo e Ingreso, con su propia prueba. Hasta entonces, **cada lote dice en su cabecera que
  valora con el Día uno activo.**

### 5.3 Urgencia: el coste de esperar (U, de 0 a 3) *(estimación)*

| Nota | Situación |
|---|---|
| **0** | Puede esperar sin coste |
| **1** | Su valor baja despacio: conviene este trimestre |
| **2** | Ventana de 1 a 3 meses fijada desde fuera: una demo agendada, una temporada, un plazo de contrato |
| **3** | Plazo externo en menos de un mes, o **el coste crece cada día**: un dato que se corrompe, dinero que se pierde, algo que caduca (el caso de `REVOPS-001E`, un conjunto creado sin atribución que ya no se reatribuye) |

**Solo cuentan fechas externas**: una demo con un prospecto, una ley, un contrato, un dato que se
estropea. El calendario de un plan propio no es urgencia.

Sale de WSJF (§12), que ordena por el coste de esperar. Va aparte del valor porque algo valioso sin
plazo puede esperar, y algo modesto con plazo no.

### 5.4 Confianza (C)

| Nivel | Prueba |
|---|---|
| **1,0** | **Medido o reproducido**: contado en la base, reproducido en pantalla con datos, visto en producción |
| **0,8** | **Lo dijo quien usa el producto**: la sesión con la administradora, un cliente o un prospecto, por escrito o grabado |
| **0,5** | **Leído**: en el código, en la ley, en la competencia o en el recorrido de la demo |
| **0,3** | **Especulación**: nadie lo dijo, nada lo midió |

**La confianza solo se calcula sobre las estimaciones del mundo** (§5), y es **la de la prueba más débil
entre las estimaciones con nota 2 o 3**, porque esas son las que cargan la puntuación. Si ninguna
estimación llega a 2, manda la más débil de las que tienen 1 o más; si ninguna tiene 1, C = 1,0, porque
lo único que queda son hechos.

**Los hechos no llevan descuento.** El Alcance de un cambio se comprueba leyendo qué roles y portales
toca; tratarlo como una prueba «leída» de 0,5 hundía la confianza de todas las valoraciones de la v0.1
(`docs/valoraciones/calibracion-2026-09-15.md`, §3).

**Una existencia leída no es un impacto medido.** Un defecto confirmado en el código existe con certeza;
cuánto muerde sin clientes es otra cosa. Mientras no haya clientes, casi ninguna estimación pasará de
0,8, y el modelo tiene que enseñarlo en vez de disimularlo.

---

## 6. Paso 4 · Esfuerzo: todo lo que conlleva

### 6.1 La unidad: la hora de trabajo activo

Una **hora de trabajo activo** es tiempo de reloj trabajando con Claude en la entrega: leer, construir,
probar, desplegar, verificar y cerrar. **No cuenta la espera** a que David dé un permiso o tenga un
teléfono a mano: eso va en §6.5.

La sesión **no sirve** como unidad: en la calibración del 15 sep, una sola sesión se tragó una PRD de
tres entregas en los dos ambientes, y otra repartió la tarde entre tres frentes.

| Talla | XS | S | M | L | XL | XXL | Más |
|---|---|---|---|---|---|---|---|
| **Horas** | ≤ 0,5 | 1 | 2 | 4 | 8 | 16 | **Se parte en entregas** |

### 6.2 Primero se compara con los casos de referencia

**Las horas se estiman con las entregas ya hechas**, antes de descomponer. Dieciocho, medidas en
`git log` en las tres calibraciones del 15 sep, ordenadas por horas reales:

| Referencia | Qué fue | Cuánto existía ya | Horas reales | Qué la hizo de ese tamaño |
|---|---|---|---|---|
| **PH-003** (30 ago) | Autorizar la visita que llega sin avisar | **Parcial con base**: la callable `registerWalkInVisit` y la lectura del residente ya estaban | **0,65**, más una espera (la portería, al día siguiente) y un arreglo | Tres portales, pero casi todo era cablear lo que había |
| **FIX-003 / UX-004** (30 ago) | Que dos indicadores digan qué ventana miden, sin tocar fórmulas | **Parcial**: la fórmula ya era única | **0,6–1,0** | Solo front, dos pantallas y un guardián |
| **H.31 y H.37** (13 sep) | Dos defectos del front: un orden que reventaba con un `Timestamp` y una hora mal leída | **Casi hecho**: arreglos de pocas líneas | **0,9** | Cinco ficheros, sin servidor ni reglas; gemelo bueno en el mismo módulo |
| **PLAT-004, entrega 1** (9 sep) | Conceder y retirar la marca de consejo | **Parcial con base**: el rol ya leía; gemelo completo en `updateOperationalUser` | **0,8–1,5** | Una callable con gemelo y una regla |
| **H.51 y D2** (14 sep) | Medidores abre en el último mes con lecturas, y 192 fotos de la semilla regeneradas en los dos ambientes | **Parcial**: la ilustración ya existía, sin escritor | **1,3–1,6** | Una pantalla y un escritor de semilla, con permiso por paso en producción |
| **FEAT-006** (1 sep) | Unir varias columnas del archivo en un campo de la persona, al importar | **Parcial con base**: el detector y las fixtures ya estaban | **1,5–2,0** | Una pantalla y el campo de telemetría en los dos lados, sin reglas |
| **PLAT-005** (29 ago) | Push al residente: SW, FCM, reglas de `pushTokens`, emisor e invitación | **Parcial**: el aviso ya pasaba por un solo embudo; no había SW | **1,9**, más una espera de 15 h | Infraestructura nueva; la prueba en un iPhone real esperó al día siguiente |
| **FEAT-004** (25 ago) | Estado de cuenta y paz y salvo: el cálculo, dos PDF, emitir y anular | **Parcial con base**: la pantalla, los datos y los gemelos de PDF ya estaban | **~2,0**, más el paso a producción al día siguiente | Dos callables y dos PDF, con gemelos |
| **FEAT-009** (10 sep) | Presupuesto contra ejecución, entregas 1 y 2 | **Nuevo, con lo ejecutado ya calculado** en el informe del consejo | **1,2–2,9** (1,7 h sin commits: dudosa) | Solo front y reglas, con gemelo para cada pieza |
| **ONB-002** (30 ago) | Ver y fusionar personas duplicadas sin dejar referencias colgando | **Nuevo, con gemelo completo** (`mergeUnits`) | **2,35** | Dos callables, un inventario de referencias y la fusión real en producción |
| **FLOW-004** (28 ago) | El expediente de conciliación: reglas del núcleo, callables, bandeja y relleno | **Parcial / Distinto**: el emparejado existía en el cliente | **2,8** | Del cliente al servidor, reglas que restringen y relleno en los dos ambientes |
| **FLOW-003** (26 ago) | Cobranza que llega: rastro de entrega, webhook, calendario y adjunto | **Parcial**: el embudo de envío y los procesos diarios ya estaban | **2,3–3,3** | La primera función HTTP, con su firma verificada a mano |
| **FEAT-010** (10 sep) | Tesorería, cuatro entregas: saldo por cuenta, traspasos, caja chica y su conciliación | **Nuevo, con gemelo** (presupuesto) | **3,0** | Colecciones nuevas y un cambio en la conciliación |
| **PLAT-006** (1–2 sep) | La puerta de buzones: salida y entrada, y los datos de producción | **Parcial con base**: la salida ya pasaba por un embudo y la lista de dominios inertes existía | **~3,2**, en dos sesiones | Dos puertas, reglas que restringen y operaciones de datos en producción |
| **FEAT-008** (9 sep) | Medición de consumos, tres entregas: servidor, reglas, Storage, pantalla, cobro y vista del residente | **Nuevo, con gemelos** para casi todo | **3,7** | Siete superficies y el camino del dinero |
| **FLOW-008** (3 sep) | Cuentas por pagar en cuotas: calendario, pagar y anular por callable, reglas endurecidas | **Nuevo** | **3,8** | Reglas que restringen, cinco consumidores de la deuda y cinco arreglos por el camino |
| **FEAT-007** (2 sep) | Modo oscuro elegible, tres entregas y canario | **Nuevo el mecanismo**; 815 usos de color sin migrar | **~3,8** (2,7 hasta producción apagada) | Volumen sin gemelo: cinco formas de color literal |
| **FLOW-007** (3 sep) | Informe mensual anclado al banco, entregas 1 y 2: el núcleo en los dos lados, el PDF firmable, el cron | **Parcial / Distinto**: el estado financiero existía, sin el saldo inicial | **3,9–4,4** | Espejo front-servidor, PDF nuevo, cron vivo y canario |

**El procedimiento:**

1. **Buscar las dos referencias más parecidas**, en este orden: **cuánto existe ya** (lo que más separó
   las entregas: PH-003 tocaba tres portales y costó 40 minutos porque casi todo estaba), si toca dinero
   o reglas que restringen, y cuántas superficies.
2. **Interpolar sus horas**, sin redondear a una talla: si se parece a las dos por igual, el promedio; si
   más a una, más cerca de esa. Las tallas de §6.1 son para hablar, no para puntuar. En la segunda
   calibración, redondear a «L, 4 h» igualó cuatro entregas que costaron entre 2,35 y 4,4 horas.
3. Descomponer en los cinco componentes (§6.3) para comprobar. **Si la descomposición y la interpolación
   difieren en más del doble, se escribe por qué** y manda la interpolación salvo razón concreta.

**Las referencias crecen**: cada entrega nueva, con su coste medido, entra en la tabla.

### 6.3 Los cinco componentes, para comprobar

| Componente | Qué incluye |
|---|---|
| **Construir** | El código de cada superficie marcada en §4.2 |
| **Datos** | Migrar, sembrar o rellenar hacia atrás; los scripts y su prueba en seco |
| **Verificar** | Los cuatro bancos, el emulador, el navegador con sesión, las pruebas que piden dos personas o un teléfono, y la falsación |
| **Desplegar** | Los dos ambientes, el orden (que se invierte si la regla restringe), las banderas y el encendido |
| **Cerrar** | El traspaso, el roadmap, la bitácora, la wiki, Notion y la memoria |

### 6.4 Coeficiente de riesgo e integración

| Coeficiente | Cuándo |
|---|---|
| **1,0** | Terreno conocido: hay un gemelo que ya lo hace bien |
| **1,3** | Pocas incógnitas: una o dos vueltas de más |
| **1,5** | Poco documentado o de infraestructura: reglas de Storage, App Hosting, emulador, índices |
| **2,0** | Posible callejón sin salida: un servicio externo, una ley sin abogado, un comportamiento sin documentar |

**Horas = Σ (componente × su coeficiente) × (1 + integración)**, con integración de **0 %** si toca una
superficie, **10 %** si toca dos o tres y **20 %** si toca cuatro o más. Esta cuenta **comprueba** la
talla de §6.2; no la sustituye.

### 6.5 El tiempo de David: las esperas

Lo que cuesta de David no son sus minutos: es **la espera**. En la calibración, con David presente toda
la tarde, FEAT-008 y FLOW-008 no esperaron nada; PLAT-005 esperó 15 horas a un iPhone y H.31–37 esperó
5,5 horas a un permiso de producción.

Se cuentan **los puntos de espera**: cada momento en que la entrega no puede seguir sin David.

- un permiso de producción (uno por paso, nunca en bloque);
- una validación en el navegador con su sesión, o en un teléfono;
- reautenticar una credencial (ADC, CLI de firebase, gcloud);
- una decisión de producto;
- la consola, Squarespace o cualquier cosa que solo él puede tocar;
- una conversación con un tercero.

**Si David está en la sesión, un punto de espera cuesta minutos; si no, cuesta calendario**: de horas a
un día. **Las esperas no entran en la división de la puntuación**: se usan para planificar. Al armar un
lote se suman, y si David no va a estar, se prefieren las necesidades con menos esperas o se agrupan
las suyas en un solo momento. Los minutos se siguen anotando.

### 6.6 Cinco errores de estimación que el modelo prohíbe

1. **Anclar en tiempos humanos** («un desarrollador tardaría dos semanas»). Se compara con las
   referencias de §6.2; la v0.1 lo prohibía solo con palabras, y los seis estimadores lo hicieron igual.
2. **Acolchar a ojo.** Toda holgura es un coeficiente con su razón escrita.
3. **Confundir volumen con dificultad.** Quinientas líneas repetitivas no son difíciles; una línea de
   regla puede serlo.
4. **Olvidar la integración** y el cierre, que aquí es trabajo de verdad.
5. **Meter las esperas en las horas.** Un permiso de producción es una espera (§6.5), no trabajo.

---

## 7. Paso 5 · Decisión

### 7.1 La puntuación

La confianza descuenta solo las estimaciones; los hechos entran enteros:

```
Estimaciones  E = 0,5 × (Dolor + Obligación + Rodeo) + 0,5 × (Ingreso + Riesgo que quita + Día uno) + 2 × U
Hechos        H = 0,5 × Alcance + 0,5 × (Desbloqueo + Cierre)
Impacto ajustado = H + E × C                                           (0–19,5)
Puntuación       = Impacto ajustado ÷ Horas
```

Los pesos son los de §11: 50/50 entre cliente final y negocio, y la urgencia al doble. Con C = 1, el
impacto ajustado es exactamente el coste de esperar de la v0.1: `0,5 × VC + 0,5 × VN + 2 × U`.

**Ejemplo ilustrativo, con números inventados para enseñar la cuenta** (no es la valoración de nada):
Dolor 2, Obligación 1, Rodeo 2, Alcance 2; Ingreso 1, Riesgo 1, Día uno 2, Desbloqueo 0, Cierre 1;
U = 1. E = 0,5 × 5 + 0,5 × 4 + 2 = 6,5. H = 0,5 × 2 + 0,5 × 1 = 1,5. C = 0,8 (la prueba más débil entre
las estimaciones con nota 2). Impacto ajustado = 1,5 + 6,5 × 0,8 = 6,7. Horas = 2 (interpoladas entre dos
referencias y confirmadas por componentes). **Puntuación = 6,7 ÷ 2 = 3,4.**

### 7.2 El cuadrante *(umbrales de §11)*

| | Menos de 4 horas | 4 horas o más |
|---|---|---|
| **Impacto ajustado ≥ 4** | **Ganancia rápida:** primero | **Apuesta:** se planifica y se parte |
| **Impacto ajustado < 4** | **Relleno:** entre frentes | **Pozo:** no se hace sin una razón nueva |

**El umbral de impacto es 4 mientras no haya clientes.** Sin clientes, casi ninguna estimación pasa de
0,5 de confianza, y con eso el impacto ajustado de doce entregas elegidas por David quedó entre 1,25 y
4,75: un umbral de 6 no lo alcanzaba casi nada. **Se revisa cuando llegue el primer cliente**, el mismo
día en que caduca el Día uno (§5.2).

### 7.3 Cuatro reglas por encima de la puntuación

1. **Lo obligatorio primero** (§2.1).
2. **Lo que desbloquea va antes que lo que depende**, aunque puntúe menos: una pieza de poco valor que
   destraba tres de mucho sale primero.
3. **Cerrar antes que abrir.** Entre dos con puntuaciones parecidas (diferencia menor al 25 %), va
   primero la que cierra. Si esta regla contradice una recomendación anterior, **se dice en voz alta**.
4. **Solo se elige lo que no está frenado.** Lo construible (A) se puede elegir hoy. Lo que espera una
   decisión de David (B) va a su lista **ordenado por puntuación**, que dice qué decisión vale más la
   pena tomar primero. Lo que espera a un tercero (C) espera.

**Solo se comparan puntuaciones del mismo lote.** Una puntuación de hoy y una de hace un mes pueden
haberse hecho con pruebas distintas.

### 7.4 Decide David

El modelo propone un orden y, cuando dos opciones compiten por la misma capacidad, enseña la
comparación:

```markdown
## Qué se gana y qué se pierde: [A] frente a [B]
- A: puntuación · cuadrante · freno · esperas · qué se gana · qué cuesta esperarla
- B: lo mismo
- Qué inclina la balanza: [la regla de §7.3 que aplica, si David va a estar, una fecha]
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
| Criterio | Clase | Nota | Prueba | Nivel |
|---|---|---|---|---|
| Dolor (tabla general, o G × P) | estimación | | | |
| Obligación | estimación | | | |
| Rodeo | estimación | | | |
| Alcance | hecho | | | — |
| Ingreso | estimación | | | |
| Riesgo que quita | estimación | | | |
| Día uno | estimación | | | |
| Desbloqueo | hecho | | | — |
| Cierre | hecho | | | — |
| Urgencia | estimación | | | |
**E:** … · **H:** … · **Confianza:** [la regla de §5.4] · **Impacto ajustado:** …

**Esfuerzo**
- Las dos referencias más parecidas (§6.2): [cuáles, y cuánto existía ya en cada una] → **N horas**
  interpoladas
- Comprobación por componentes:
| Componente | Horas | Coeficiente | Por qué |
|---|---|---|---|
| Construir | | | |
| Datos | | | |
| Verificar | | | |
| Desplegar | | | |
| Cerrar | | | |
  Integración: [0/10/20 %] · total por componentes: … h · [si difiere en más de una talla, por qué]
- **Esperas:** [lista de puntos de espera, con minutos si David está]

**Resultado:** puntuación · cuadrante · freno · esperas · reglas de §7.3 que aplican
**Qué cambiaría la valoración:** [la prueba que la movería, y hacia dónde]
**Sensibilidad:** ¿cambia el orden si las horas fueran el doble?
```

La línea «qué cambiaría la valoración» es la más útil del lote: dice qué prueba conviene conseguir
primero.

---

## 9. Cómo se comprueba el modelo antes de fiarse de él

Un verde no vale sin falsación, y una escala que no distingue pasa cualquier prueba. Tres pruebas, en
este orden:

### 9.1 Calibración con lo ya construido

Se valoran **entregas de la bitácora** como si no estuvieran hechas, a ciegas —con el repositorio tal
como estaba antes de construirlas—, y se compara con lo que costaron de verdad: las horas de reloj en
`git log` y las esperas del traspaso y la bitácora.

**Criterio:** si en más de la mitad las horas reales se desvían más del 50 % de la estimación, se
reescriben las tallas, las referencias o los coeficientes. Y el orden que da el modelo tiene que
parecerse al que eligió David; donde no se parezca, se busca el criterio que falta.

**Primera pasada, 15 sep 2026 (v0.1): NO PASÓ.** Seis entregas: H.31 y H.37, FIX-003, H.51 y D2,
PLAT-005, FEAT-008 y FLOW-008. El esfuerzo salió inflado entre 3,3 y 8,6 veces en las seis, aunque el
orden relativo se conservó (ρ = 0,89); la confianza, en 0,5 en todas las valoraciones. De ahí salieron
los cambios de la v0.2, y **esas seis entregas son ahora las referencias de §6.2**, así que **no pueden
volver a calibrar**: la siguiente pasada usa entregas distintas. Detalle:
`docs/valoraciones/calibracion-2026-09-15.md`.

**Segunda pasada, 15 sep 2026 (v0.2): mejora, pero no pasa.** Seis entregas nuevas: ONB-002, PH-003,
FEAT-009, FEAT-010, FLOW-007 y FLOW-004.
- **Esfuerzo:** el exceso medio baja de 4,7 a 1,8 veces, y tres de seis quedan dentro del 50 %. Pero las
  seis compararon con una referencia L y cuatro acabaron en «4 horas» exactas, así que el orden
  relativo se pierde (ρ ≈ 0,4).
- **Impacto:** la confianza sale en 0,5 en todas, esta vez porque sin clientes nada está medido, y cinco
  de seis caen en Pozo.
- Detalle y propuestas en `docs/valoraciones/calibracion-2026-09-15-segunda.md`.

**Una pregunta abierta de las dos pasadas:** el modelo habría dicho «no se hace» a la mayoría de las
doce entregas que David eligió (FLOW-008, PLAT-005, FEAT-010, PH-003 entre ellas). Si las eligió por algo
que el modelo no pregunta —dos estimadores lo llamaron «llegar listos al primer cliente»—, ese es el
criterio que falta. **David lo confirmó el 15 sep: las eligió para llegar listos al primer cliente.**
Entra como el criterio «Día uno» de la v0.3 (§5.2).

**Tercera pasada, 15 sep 2026 (v0.3): PASA.** Seis entregas nuevas: FEAT-004, FLOW-003, PLAT-006,
FEAT-006, PLAT-004 (entrega 1) y FEAT-007.
- **Esfuerzo:** las seis dentro del 50 % (el error más grande, 22 %), sin sesgo (cociente medio 1,0) y
  con el orden recuperado (ρ ≈ 0,94). Las seis interpolaron, y en las seis la descomposición salió más
  alta: mandó la interpolación y acertó.
- **Impacto:** tres en Ganancia rápida y tres en Relleno, ninguna en Pozo. El Día uno distinguió (0, 1
  y 2).
- Esas seis pasan a ser referencias. Detalle: `docs/valoraciones/calibracion-2026-09-15-tercera.md`.

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
  Si salen, las definiciones no distinguen. La v0.1 la rozó: cuatro de seis en Pozo.

Estos casos serán además **las pruebas de la skill** (§10), como hace `orchestkit` con las suyas.

---

## 10. Dónde vive y cómo se mantiene

- **Este documento es la regla.** Se cambia aquí y en ningún otro sitio; lo demás lo cita.
- **Las valoraciones y las calibraciones** viven en `docs/valoraciones/`, un fichero por lote o por
  pasada, con la tabla y las fichas grandes debajo.
- **La skill `valorar-iniciativa-vivaru`** (`.claude/skills/valorar-iniciativa-vivaru/`, escrita el 15
  sep 2026) ejecuta los cinco pasos y produce la ficha, como las de PRD. **No copia las reglas: las lee
  de este documento.** Lleva sus pruebas en `casos-de-prueba.md`: los casos de §9.3 y los que salieron
  de las calibraciones. Vive solo en el repositorio, no en `~/.claude/skills/`: dos copias son dos sitios
  donde envejecer.
- **Notion:** columnas nuevas en «Backlog e inventario detallado» (impacto ajustado, horas, esperas,
  confianza, puntuación, freno). **Pide el permiso de David** antes de tocar el esquema.
- **Cuándo se revalora:** cuando cambia la prueba —llega un cliente, se mide algo, aparece un plazo— y
  antes de armar cada menú de `docs/pendientes.md`. Una valoración vieja se marca con su fecha, no se
  cita como si fuera de hoy.

---

## 11. Los valores de partida

**Confirmados por David el 15 sep 2026.** La calibración puede ajustarlos; cada ajuste se anota aquí con
su fecha y su razón.

| Qué | Valor | Por qué ese |
|---|---|---|
| Peso cliente / negocio | **50 / 50** | La confianza ya descuenta el valor al cliente no medido; subir el negocio lo descontaría dos veces |
| Factor de la urgencia | **2 × U** | Una urgencia de 3 (plazo legal) pesa la mitad de la escala de valor |
| Unidad de esfuerzo | **Horas de trabajo activo**, y las esperas de David aparte | **Cambiado el 15 sep** (era «sesiones»): la sesión dura entre media hora y cuatro, y no mide nada |
| Umbral de esfuerzo del cuadrante | **4 horas** (talla L) | **Cambiado el 15 sep** (eran 3 sesiones): las entregas grandes de referencia costaron unas 4 horas |
| Umbral de impacto del cuadrante | **4, mientras no haya clientes** | **Cambiado el 15 sep** (era 6): sin clientes la confianza es 0,5 en casi todo, y doce entregas elegidas quedaron entre 1,25 y 4,75. Se revisa con el primer cliente |
| Criterio «Día uno» | **Activo, hasta el primer cliente** | **Añadido el 15 sep**: David eligió las doce entregas de referencia para llegar listos al primer cliente, y el modelo no lo preguntaba |
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
| Esfuerzo en unidades del propio trabajo, no en tiempos humanos; coeficientes de riesgo de 1,0 a 2,0; recargo por integrar; el cuello de botella de la persona aparte; **estimar contra ejemplos de calibración** | `zhanghandong/agent-estimation` | MIT |
| Las formas de tocar el ingreso (vender, convertir, ampliar, retener); «lo de menos de una semana no se puntúa: se hace»; «qué tendría que cambiar» | `deanpeters/product-manager-skills`, `feature-investment-advisor` | No declarada: solo la idea |
| Sin datos de uso, RICE no sirve: su «alcance» los necesita | `deanpeters/product-manager-skills`, `prioritization-advisor` | No declarada: solo la idea |
| Primero el problema, después la solución | `borghei/claude-skills`, `prioritization-frameworks` | No declarada: solo la idea |
| Probabilidad × gravedad para los defectos | Matriz de riesgo e impacto (`tech-debt-tracker`, `alirezarezvani`) | MIT |

**Lo propio de Vivaru, que no existe en el mercado:** el expediente leído del código y de los datos
(§3), el análisis de lo que rompe con nuestras trampas (§4), la puerta de lo obligatorio con nuestras
definiciones (§2.1), la separación entre hechos y estimaciones en la confianza (§5.4), los casos de
referencia medidos en nuestro git (§6.2), la calibración con nuestra bitácora (§9.1) y la prueba de
acuerdo entre calificadores (§9.2).
