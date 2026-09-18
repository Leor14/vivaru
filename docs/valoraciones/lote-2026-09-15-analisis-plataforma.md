# Lote «Análisis de la plataforma» — 15 sep 2026

> **Fuente.** El documento «ANÁLISIS PLATAFORMA VIVARU» (14 páginas, 28 capturas), escrito por una
> **administradora de propiedad horizontal en Colombia** que recorrió el portal de administración del
> conjunto demo Santa María el 13 sep 2026. Lo que dice de su práctica vale **0,8** (§5.4 del modelo).
> **David decidió que cuenta como prospecto**: lo que pidió por escrito lleva Ingreso 2.
>
> **Cómo se valoró.** Seis agentes, uno por bloque de módulos, prepararon el expediente y las fichas con
> el modelo **v0.3** y la skill `valorar-iniciativa-vivaru`, leyendo el código en solo lectura. Después se
> **recalculó con la v0.4** (15 sep): cada estimación se multiplica por el nivel de su prueba, y el
> Ingreso sube a 2 en lo que ella pidió.
> - El cálculo está en `docs/valoraciones/recalculo-lote-2026-09-15.py`, con las notas de cada ficha.
>   **Primero reproduce las 37 valoraciones de la v0.3 sin ninguna diferencia**; así se sabe que las notas
>   se copiaron bien.
> - **Día uno activo**: los 10 conjuntos de producción son de ejemplo (medido el 15 sep con
>   `scripts/leer-monedas.mjs`).
>
> **Lo que no se midió:** cuántos tickets llevan la etiqueta sucia (L-21d), cuántos comunicados,
> encuestas y firmas hay, el tope de gasto de la IA, y staging. La Ley 675 no se pudo leer: los sitios
> oficiales rechazaron la conexión, así que cuenta como no leída (0,3).
>
> **Esto ordena; no decide.** Decide David.

---

## 0. Estado al 17 de septiembre de 2026 — qué está construido y qué sigue

**Las cinco fases del plan (`docs/plan-lote-analisis-plataforma.md`) están EN PRODUCCIÓN y vistas en
pantalla.** Esta sección se reescribe; las puntuaciones y las fichas de abajo son del 15 sep y no se
tocan — son el registro de cómo se decidió.

| Grupo | Cuántas | Estado |
|---|---|---|
| Obligatorio (§1.1) | 4 + 1 | **Resueltos**: `D-2b`, `D-2`, `D-3`, `D-1` (iba dentro de `L-23`) y `D-2c`, que apareció construyendo |
| Freno A (§1.2) | 11 | **4 resueltos** (`L-27`, `L-08a`, `L-21d`, `L-29`) · **7 sin planificar** |
| Decisión de David (§1.3) | 13 | **1 resuelta** (`L-04`) · **12 esperan** |
| No ahora (§1.3, las seis últimas) | 6 | Descartadas por ahora; cada ficha dice qué prueba las subiría |
| Terceros (§1.4) | 2 | `L-31` y `L-32b`, sin cambios |
| Puerta XS (§1.5) | 4 + tildes | **Todas hechas**; `L-17` sigue esperando el nombre |

**De las 36 necesidades del documento, 9 están resueltas** —`L-01a`, `L-02`, `L-11`, `L-12`, `L-04`,
`L-27`, `L-08a`, `L-21d` y `L-29`, más las tildes— y **27 siguen**. Fuera de la lista se arreglaron los
cinco defectos de acceso y **los estados que salían en inglés** en las insignias, que David sumó al ver
«Archived» al archivar un comunicado.

**Lo que sigue, por qué lo frena:**
- **Construidas y sin desplegar (6):** `L-22`, `L-24`, `L-20` y `L-07` **en producción desde el 18
  de septiembre y sin mirar en pantalla todavía**; `L-21` y `L-13` (bloque 3), sin commit. **Hasta
  verlas no cuentan como cerradas.**
- **Construible ya, sin planificar: ninguna.** El grupo A del lote queda construido entero.
- **Espera una decisión (13):** `L-17` (el más barato: media hora en cuanto haya nombre), `L-23` (el
  canal de correo, reclasificada el 17 sep), `L-08b`, `L-18`, `L-03`, `L-06`, `L-32`, `L-15`, `L-09`,
  `L-19`, `L-14`, `L-10` y `L-16`.
- **Descartadas por ahora (6):** `L-26`, `L-30`, `L-25`, `L-28`, `L-05` y `L-01b`.
- **Terceros (2):** `L-31` (la ficha de Google de cada edificio) y `L-32b` (el chatbot, que se parte antes
  de valorarlo).

**Y lo que quedó fuera del lote y no se ha tocado:** los nueve defectos de §4 —entre ellos que **6 de 10
conjuntos de producción no tienen moneda**, y por eso Privada Las Palmas, que es de México, enseña pesos
colombianos—, las seis peticiones suyas que nunca tuvieron ficha (los documentos informativos visibles a
todos, el tiempo estimado de respuesta en PQRS, los colores de los formularios, la app como único canal de
reservas, los dos «no me queda claro este módulo» y el terracota, que ya estaba) y la fila que sugirió el
propio análisis: el coeficiente y la cuota en la carga masiva (~1,7 h, sin valorar).


### 0.1 El tablero de las 36 — una fila por petición, con su estado

**Leyenda:** ✅ construida y cerrada (en producción, vista en pantalla) · 🔵 **construida y sin
desplegar** (el código existe; no está en producción ni se ha visto en pantalla) · 🟢 se puede ya (nada
la frena salvo el turno) · 🟡 espera una decisión de David · ◇ descartada por ahora · ⏸ espera a un
tercero.

> **El 🔵 nació el 17 de septiembre por la tarde, y hace falta precisamente porque ✅ mentiría.** Cuatro
> peticiones están construidas y probadas en local y **no las ha visto nadie en producción**; llamarlas
> «cerradas» es el error que este documento le señala a la ficha de una PRD.

| Estado | Cuántas |
|---|---|
| ✅ Construidas y cerradas | **9** |
| 🔵 Construidas, sin desplegar | **6** |
| 🟢 Se puede ya, sin planificar | **0** |
| 🟡 Espera una decisión | **13** |
| ◇ Descartada por ahora | **6** |
| ⏸ Espera a un tercero | **2** |
| **Total del documento** | **36** |

| Id | Lo que pidió | Pág. | Estado | Dónde está |
|---|---|---|---|---|
| **L-01a** | Colores del panel: menta, violeta o terracota | 1 | ✅ | Fase 3 (`5aac90f`). El terracota ya estaba en la paleta |
| **L-02** | ¿Cuál es el formato del Excel para la carga masiva? | 1 | ✅ | Fase 3 (`5aac90f`): Excel y CSV, con parqueadero y bodega |
| **L-03** | Área y valor del seguro: «no lo veo necesario» | 1–2 | 🟡 | ¿Retirar, esconder o por país? |
| **L-04** | «No es porcentaje de copropiedad: es coeficiente» | 2 | ✅ | Fase 5: `country: CO` y `currency: COP` en Santa María |
| **L-05** | Exención de bloqueo por deuda, también en parqueadero | 2 | ◇ | Depende de `A8`; 3,75 h y 0,76 de puntuación |
| **L-06** | Tres figuras: propietario, residente y administrador del apartamento | 3 | 🟡 | ¿Recibe cobros, avisos o acceso? |
| **L-07** | Ver las unidades de un mismo dueño | 4 | 🔵 | Fase 6 bloque 2: «Dueños con varias unidades», de solo lectura. **Sin desplegar** |
| **L-08a** | Registrar la salida del visitante frecuente *(defecto)* | 4 | ✅ | Fase 4 (`eda51ad`), con la vigencia comprobada en la regla |
| **L-08b** | Que el residente cree su propio visitante frecuente | 4 | 🟡 | ¿Puede hacerlo él solo? |
| **L-09** | Foto del visitante para que el dueño apruebe | 4 | 🟡 | Cómo la lee el residente y cuánto se guarda |
| **L-10** | Personal de servicios por categoría, con horarios | 4 | 🟡 | ¿Catálogo del conjunto o personal por unidad? |
| **L-11** | Dos perfiles: administración y equipo de seguridad | 4, 7, 8 | ✅ | Fase 3: «la portería tiene su propio panel», en tres pantallas |
| **L-12** | La fecha que pone la plataforma al publicar | 4 | ✅ | Fase 3: columna «Publicado» en Comunicaciones |
| **L-13** | Cuántas personas vieron un comunicado | 5 | 🔵 | Fase 6 bloque 3: `communicationReads`, con «Sin registro» para los 40 de antes. **Sin desplegar** |
| **L-14** | Dejar registro si borran un comunicado | 5 | 🟡 | Qué se conserva (choca con protección de datos) |
| **L-15** | Clase de comunicado: noticia, general, cartera | 5 | 🟡 | La taxonomía |
| **L-16** | Servicios como clasificados, con la unidad en arriendo o venta | 5 | 🟡 | El nombre y quién publica |
| **L-17** | Un nombre más cercano para Encuestas | 6 | 🟡 | **El más barato: media hora en cuanto elijas el nombre** |
| **L-18** | «En propiedad horizontal nadie firma esos documentos» | 7 | 🟡 | El valor por defecto por país, y qué pasa con los acuerdos |
| **L-19** | Reservas con valor, depósito, aforo y protocolo | 7 | 🟡 | ¿El valor informa o genera un cargo? |
| **L-20** | Paquetería: quién lo trajo, en qué estado y el protocolo | 8 | 🔵 | Fase 6 bloque 2: empresa, estado de llegada y la entrega a la vista. **El protocolo, no** (pide otra carpeta del sistema). **Sin desplegar** |
| **L-21** | PQRS: evidencia de la solución y descargar en Excel | 9 | 🔵 | Fase 6 bloque 3: evidencia en carpeta solo-administración y Excel de lo filtrado. **Sin desplegar** |
| **L-21d** | PQRS enseña un id crudo y «Residente» *(defecto)* | 9 | ✅ | Fase 4 (`eda51ad`); en producción salen «T1-403» y los nombres |
| **L-22** | Subir el informe del contador sobre la cartera | 9 | 🔵 | Fase 6 bloque 1 (`3ed097a`). **Sin desplegar**: pide reglas de Storage y una function |
| **L-23** | Correo de cobro a todos los deudores | 9 | 🟡 | **Reclasificada el 17 sep:** su defecto `D-1` ya está, pero el canal de correo está cerrado por decisión y en Santa María **12 de 14 direcciones no reciben** |
| **L-24** | Tendencia de cartera mensual y acumulada | 9 | 🔵 | Fase 6 bloque 1 (`3ed097a`): **la mensual ya existía**; se añadió la acumulada. **Sin desplegar** |
| **L-25** | Consumo de zonas comunes con tendencia | 9–10 | ◇ | 2,0 h y 1,05 de puntuación |
| **L-26** | Matriz de mantenimientos para el consejo | 10 | ◇ | 2,6 h y 1,3 |
| **L-27** | Presupuesto del año, privado del administrador | 11 | ✅ | Fase 5: encendido en Santa María y visto abriendo |
| **L-28** | Convivencia: llamados de atención y descargos | 12 | ◇ | 3,3 h y 1,0 |
| **L-29** | Medir al guarda responsable de cada gestión | 13 | ✅ | Fase 4 (`eda51ad` y `4fc35ca`): `checkInBy`/`checkOutBy` y su regla |
| **L-30** | Reportes de vigilancia y novedades | 13 | ◇ | 2,8 h y 1,1; subiría si la minuta es diaria y en papel |
| **L-31** | Calificación del edificio unida a Google | 14 | ⏸ | La ficha de Google de cada edificio y sus términos |
| **L-32** | Números de emergencia del conjunto | 14 | 🟡 | ¿FAQ del conjunto o de la plataforma? ¿Quién redacta? |
| **L-32b** | Chatbot 24/7 | 14 | ⏸ | Corpus, tope de gasto; **se parte antes de valorarlo** |
| **L-01b** | Un tema de color más llamativo en todo el panel | 1 | ◇ | 2,6 h y 0,65 |

**Y siete cambios más que están en producción y NO venían en su lista** (los cinco de acceso salieron de
leer el código para valorar lo suyo): `D-2b` (un residente leía comunicados de otras unidades), `D-2` (su
aviso llegaba a todos), `D-1` (el aviso de mora al conjunto entero), `D-2c` (el adjunto se colaba por
Documentos), `D-3` (la categoría nacía en «otro»), las **tildes** de «Tipo de ocupación» y «Núcleo
familiar», y los **estados en inglés** de las insignias, que sumaste al ver «Archived».

## 1. El lote ordenado (reglas de §7.3 del modelo; puntuaciones de la v0.4)

Horas de trabajo activo; las esperas (§6.5), aparte. IA = impacto ajustado. Umbral de impacto: 4.

**Las marcas dicen el estado al 17 sep** (ver §0): ✅ resuelta y en producción · ◐ resuelta a medias · sin
marca, pendiente. **Las puntuaciones no se recalculan al resolver una**: son el registro del 15 sep.

### 1.1 Lo obligatorio — reproducir y arreglar antes de nada

Leídos en el código con fichero y línea, **sin reproducir**. `D-2b` es obligatorio por decisión de
David (acceso indebido entre unidades, §2.1 de la v0.4). `D-3` lo será si su radio lo confirma.

| Id | Qué | Dónde |
|---|---|---|
| ✅ **D-2b** | **Cualquier residente del conjunto puede leer un comunicado dirigido a otras unidades.** `communications` cae en la regla comodín (`sameTenant`) y la audiencia solo se filtra en el navegador | `firestore.rules` ~l.553; `src/app/(resident)/resident/communications/page.tsx:86` |
| ✅ **D-2** | **El aviso de un comunicado dirigido llega a todos los residentes**: `onCommunicationCreated` no lee `audienceUnitIds` | `functions/src/index.ts:3156` |
| ✅ **D-3** | **La categoría por defecto al subir un documento es «otro», y los residentes la leen** (está en su lista blanca) | `src/app/(admin)/admin/documents/page.tsx:73`; `firestore.rules:1325` |

**Los tres están RESUELTOS y en producción** (fase 2, `9e4a052`), junto con **`D-1`** —el aviso de mora de
Cartera, que iba dentro de `L-23`— y **`D-2c`**, que apareció construyendo: el adjunto de un comunicado
dirigido se registraba en Documentos con una categoría que lee cualquier residente. Se reprodujeron primero
en el emulador, sin escribir datos (fase 1 del plan).

### 1.2 Se puede ya (freno A), por puntuación

| Id | Necesidad | IA | Horas | Puntuación | Cuadrante | Esperas |
|---|---|---|---|---|---|---|
| ✅ **L-27** | Presupuesto del año, privado del administrador: **ya existe y ya es privado**; en Santa María está apagado | 3,75 | 0,45 | **8,3** | Relleno | Encender la bandera en producción |
| ✅ **L-08a** | **Defecto: la portería no puede registrar la salida de un visitante frecuente** (la regla niega `inside→scheduled`, sin test). Desbloquea L-10 | con L-08: 5,85 | ~0,8 | — | **Ganancia rápida** | Permiso de reglas, sesión de portería |
| **L-22** | Subir el informe del contador sobre la cartera, forzando la categoría `financiero` | 3,1 | 0,85 | 3,65 | Relleno | Permiso |
| ✅ **L-21d** | **Defecto: PQRS enseña la unidad como un id crudo** («torre1-G1bW…») y al residente como «Residente» | 4,0 | 1,1 | 3,6 | **Ganancia rápida** | Push; corregir los datos es opcional y con permiso |
| ◐ **L-23** | Correo de cobro a los deudores. **Su defecto `D-1` ya está resuelto**; el correo, no. Incluye **el defecto D-1**: «Enviar aviso a residentes» dice «tienes cartera en mora» **a todos**, también a los que están al día (`billing/page.tsx:1255`) | 4,35 | 1,4 | 3,1 | **Ganancia rápida** | CLI de firebase, functions, correo real |
| **L-24** | Tendencia de cartera mensual y acumulada del año | 2,75 | 0,9 | 3,1 | Relleno | Push |
| **L-07** | Ver las unidades de un mismo dueño | 2,85 | 1,0 | 2,85 | Relleno | Push |
| **L-20** | Paquetería: qué empresa lo trajo, en qué estado llegó, la entrega a la vista y el protocolo | 3,1 | 1,2 | 2,6 | Relleno | Push, portería |
| ✅ **L-29** | Saber qué guarda hizo cada gestión: la entrada y salida por QR no guardan autor (**309 ingresos sin autor** en producción) | 4,15 | 1,8 | 2,3 | **Ganancia rápida** | Reglas (amplía), portería |
| **L-21** | PQRS: adjuntar evidencia de la solución y exportar el detalle a Excel | 3,75 | 1,8 | 2,1 | Relleno | `storage.rules`, residente |
| **L-13** | Cuántas personas vieron un comunicado | 2,35 | 1,5 | 1,6 | Relleno | Reglas, push |

### 1.3 Esperan una decisión de David (freno B), por puntuación

| Id | Necesidad | Qué hay que decidir | IA | Horas | Punt. | Cuadrante |
|---|---|---|---|---|---|---|
| ✅ **L-04** | «Coeficiente de la unidad» en vez de «porcentaje de copropiedad» —así lo pide en la pág. 2, y esta ficha lo decía AL REVÉS hasta el 17 sep—: **Santa María no tenía país** (medido; sin país la pantalla dice «porcentaje de copropiedad» y con `CO` dice «coeficiente de copropiedad») | Poner `country: CO` (punto 4 del menú, permiso uno a uno) | 3,05 | ~0,5 | **6,1** | Relleno |
| **L-17** | Encuestas: un nombre más cercano. **El editor de formularios ya existe** | El nombre (con él, XS) | 2,2 | 0,5 | 4,4 | Relleno |
| **L-08b** | El residente crea su propio visitante frecuente | Si puede hacerlo él solo | 5,85 (con L-08a) | 1,5 | 3,9 | **Ganancia rápida** |
| **L-18** | **El reglamento pide firmas que en propiedad horizontal nadie da.** El modo sin firmas (`governance: informativo`) ya existe, pero el reglamento no lo consulta, y el panel avisa en rojo de «17 firmas pendientes» | El valor por defecto por país; qué pasa con la firma de acuerdos | 3,25 | 1,1 | 2,95 | Relleno |
| **L-03** | El alta de unidad pide área y valor del seguro, **que ningún código lee** | ¿Retirar, esconder o por país? Si incluye H.39, cierra el cabo de T3.5 | 2,5 | 0,85 | 2,9 | Relleno |
| **L-06** | Tercera figura: el administrador del apartamento (inmobiliaria). Es el candidato `A3` | ¿Recibe cobros, avisos o acceso? | 2,85 | 1,0 | 2,85 | Relleno |
| **L-32** | Números de emergencia y preguntas frecuentes del conjunto | ¿FAQ del conjunto o de la plataforma? ¿Quién redacta? | 3,6 | 1,3 | 2,8 | Relleno |
| **L-15** | Clase del comunicado (noticia, general, cartera) | La taxonomía | 2,6 | 1,0 | 2,6 | Relleno |
| **L-09** | Foto del visitante para que el residente apruebe | Cómo lee la foto el residente; cuánto se guarda | 3,35 | 1,3 | 2,6 | Relleno |
| **L-19** | Reservas con valor de alquiler, depósito, aforo en personas y protocolo | ¿El valor solo se informa o genera un cargo? | 4,5 | 1,9 | 2,4 | **Ganancia rápida** |
| **L-14** | Registro de comunicados borrados | Qué se conserva (choca con la protección de datos) | 2,35 | 1,1 | 2,1 | Relleno |
| **L-10** | Personal de servicios del edificio por categoría y con horario (`createVisitor` pierde hoy la categoría y la hora de fin) | ¿Catálogo del conjunto o personal por unidad (`A11`)? Va después de L-08a | 4,15 | 2,0 | 2,1 | **Ganancia rápida** |
| **L-16** | Servicios como clasificados de la copropiedad, incluida la unidad en arriendo o venta | El nombre; quién publica | 2,2 | 1,1 | 2,0 | Relleno |
| L-26 | Matriz de mantenimientos para el consejo y la copropiedad | Qué activos, qué periodicidad, quién la ve | 3,4 | 2,6 | 1,3 | Relleno |
| L-30 | Novedades y minuta de vigilancia | La taxonomía de novedades (`J1`/`J3`) | 3,15 | 2,8 | 1,1 | Relleno |
| L-25 | Consumo de las zonas comunes con tendencia (el producto mide por unidad) | ¿Dentro de Medidores o como vista sobre los egresos? | 2,1 | 2,0 | 1,05 | Relleno |
| L-28 | Convivencia: llamados de atención, descargos, tabla de medición | ¿Solo registro o proceso de descargos? | 3,4 | 3,3 | 1,0 | Relleno |
| L-05 | Exención por mora también en el parqueadero | Depende de `A8` (parqueaderos) | 2,85 | 3,75 | 0,76 | Relleno; Pozo al doble de horas |
| L-01b | Un tema de color más llamativo | Decisión de diseño | 1,7 | 2,6 | 0,65 | Relleno |

**Las seis últimas (puntuación de 1,3 o menos) no valen la pena ahora.** Cada ficha dice qué prueba las
subiría: por ejemplo, L-30 pasaría a Ganancia rápida si ella dice que la minuta es diaria y en papel.

### 1.4 Esperan a un tercero (freno C)

| Id | Necesidad | Qué falta | IA | Horas | Punt. | Cuadrante |
|---|---|---|---|---|---|---|
| **L-31** | Calificación del edificio unida a la de Google | La ficha de Google de cada edificio y sus términos | 1,3 | 2,4 | 0,54 | Relleno |
| **L-32b** | Chatbot 24/7 | Preguntas reales y corpus; el tope de gasto de IA. Iría por `crear-prd-ia-vivaru` | 3,0 | 8,0 | 0,38 | **Pozo** (se parte) |

### 1.5 Puerta XS: sin puntuar, se hacen juntas (menos de 2 horas en total)

- ✅ **L-01a:** añadir menta y violeta a los colores sugeridos del conjunto.
- ✅ **L-02:** enseñar el formato de la carga masiva fuera del asistente, en Excel y no solo en CSV, con
  parqueadero y bodega en «valores válidos».
- ✅ **L-11:** decir en Visitantes, Reservas y Paquetería que **la portería tiene su propio panel**. Los «dos
  perfiles» que ella pidió ya existen: es la clase «existe y no se ve» de la v0.4.
- ✅ **L-12:** enseñarle al administrador la fecha de publicación que pone la plataforma. El residente ya la
  ve.
- ✅ Tildes: «Tipo de ocupación» y «Núcleo familiar». **Y una más, sumada por David:** los estados que salían en inglés en las insignias («Archived», «Scheduled»).
- **L-17**, en cuanto David decida el nombre. **Sigue esperando.**

**Fila nueva que sugiere el bloque 1, sin valorar:** el coeficiente y la cuota en la carga masiva de
unidades (candidato `A13`). Unas 1,7 h, con Día uno 2.

---

## 2. Qué dice el lote, en conjunto

- **La mitad de lo que pide ya existe y no se ve, o se ve mal**: el presupuesto privado, los perfiles de
  portería, el modo sin firmas, el editor de encuestas y la fecha de publicación. El problema más
  repetido no es construir, es **enseñar**.
- **Los defectos pesan más que las mejoras.** De las seis Ganancias rápidas, cuatro son o contienen
  defectos: L-21d, L-29, L-08 (con L-08a) y L-23 (con D-1). Las otras dos, L-19 y L-10, esperan una
  decisión. Y los tres defectos de §1.1 van por delante de todo.
- **Casi todo es pequeño**: 22 de las 31 filas puntuadas cuestan menos de 2 horas.
- **Hay muchos frenos B**: 19 necesidades esperan una decisión de producto. La lista de §1.3, ordenada por
  puntuación, dice qué decisión vale más tomar primero.

## 3. Las tres señales de que un módulo sobra

- **Libro y fondos**: «no tan requerido; eso se da en los estados financieros o en la asamblea». Ella
  valora lo que se entrega —el informe de FLOW-007—, no la pantalla de trabajo. El Libro alimenta el
  informe, así que no se puede quitar.
- **Tesorería (FEAT-010)**: la misma frase. **Es una prueba de 0,8 de que para una administradora
  colombiana la tesorería no forma parte de su mes**: Día uno ≤ 1 en Colombia. Pesa contra seguir
  invirtiendo en ella o encenderla global.
- **Conciliación (FLOW-004)**: «manejo directo de contabilidad». **Choca con la administradora de
  Ecuador**, que concilia ella misma. En Colombia lo haría el contador, y ese rol no existe en el
  producto. Es el caso que llevó a leer el Día uno por país (v0.4).

## 4. Defectos vistos, además de los de §1

Leídos en el código, sin reproducir:
- **Seis de diez conjuntos de producción no tienen `currency`** en el documento del conjunto, entre ellos
  Santa María, Nogal y Palmas. Choca con la trampa de `CLAUDE.md`; puede que el script lea otro campo.
  Hay que confirmarlo (T5.0 del plan).
- `createTicket` y `createPackage` fabrican `unit-<slug>` desde la etiqueta cuando falta `unitId`. Es la
  trampa de FIX-002.
- La fecha de un comunicado programado es la de su creación (gemelo de H.50).
- El reglamento cuenta sus firmas de una forma y las enseña de otra.
- `billingResponsiblePersonId` lo lee el servidor y ninguna pantalla lo escribe.
- La ocupación tiene dos vocabularios: «Propietario ocupante / Arrendatario» en el alta y «Propietario
  residente / Inquilino» en la importación.
- La invitación de varios días del residente crea un pase de un solo día; `visitasEsperadasHoy` enseña
  un frecuente solo el primer día; `data-retention.ts` no cubre las fotos de `visitor-notes`.
- La PRD de FEAT-009 (línea 60) sigue diciendo que el consejo solo entra en Documentos: está obsoleta
  desde el 11 sep.

## 5. Qué cambiaría las valoraciones

- **Reproducir D-1, D-2, D-2b y D-3** en el emulador (fase 1 del plan).
- **Preguntarle a ella tres cosas**:
  - si arma cada mes el informe de PQRS y la tendencia de cartera en Excel (subirían L-21 y L-24);
  - si la minuta de vigilancia es diaria y en papel (L-30 pasaría a Ganancia rápida);
  - si su manual de convivencia fija horarios del personal de servicio (L-10 subiría su confianza).

## 6. Hallazgos para el modelo

Los encontraron los seis agentes; varios, más de uno por su lado.

| # | Hallazgo | Estado |
|---|---|---|
| 1 | **Cierre** no tenía nota para mejorar algo ya cerrado (tres bloques) | **Aplicado en la v0.4** |
| 2 | **Ingreso 2**: ¿una administradora que evalúa la demo es prospecto? (tres bloques) | **Decidido por David: sí** |
| 3 | **Día uno** no distinguía por país (Colombia y Ecuador chocan en la conciliación) | **Aplicado en la v0.4**. Siguen abiertos: la fricción frente a la capacidad que falta, y qué es lo mínimo de «controlar la portería» |
| 4 | **§6.2 no tenía referencia de encender una bandera** ni de solo datos | **Aplicado en la v0.4** (encender una bandera); falta una referencia de solo datos |
| 5 | **Faltaba la clase «ya existe y no se ve»** | **Aplicado en la v0.4** |
| 6 | **Confianza**: falta un nivel para «práctica conocida del sector que nadie dijo»; una ley que no se pudo leer quedó en 0,3 | Pendiente |
| 7 | **Un defecto que rompe una promesa escrita** carga a la vez el Dolor y la Obligación con una sola causa | Pendiente |
| 8 | **Alcance**: no dice cómo contar una tarea que pasa una vez por conjunto | Pendiente |
| 9 | **La regla de confianza no era monótona** (lo destapó aplicar el «es prospecto») | **Aplicado en la v0.4**: cada estimación por su nivel |

## 7. Qué cambió con el recálculo (v0.3 → v0.4)

- **De 4 a 6 Ganancias rápidas.** Entran **L-23**, porque su Ingreso sube a 2 y ya no depende de
  reproducir D-1, y **L-10**. Salen del umbral: nada.
- **L-21d baja de 5,5 a 4,0** y sigue siendo Ganancia rápida. Con la regla vieja, su prueba más fuerte
  (un Ingreso medido a 1,0) tapaba que su Dolor y su Rodeo solo están leídos en el código.
- **L-27 pasa a ser la primera** (8,3): tres cuartos de hora para algo que ella pidió y ya existe.
- **Lo que tenía casi todo en 1 con prueba de 0,8 sube** (L-26, L-28 y L-30, de ~2 a ~3,3 de impacto),
  porque antes lo descontaba entero la prueba más débil. **Siguen últimas**: cuestan de 2,6 a 3,3 horas.
- **Los grupos no cambian.** Los fijan el freno y la puerta de lo obligatorio, no la puntuación.

La prueba de dispersión (§9.3) se cumple: de 31 filas puntuadas, seis Ganancias rápidas, 24 Rellenos y un
Pozo. La concentración en Relleno se explica sobre todo porque casi todo cuesta menos de 4 horas.
