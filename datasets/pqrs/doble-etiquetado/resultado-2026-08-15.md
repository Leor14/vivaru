# Doble etiquetado del gold set de PQRS — 15 de agosto de 2026

Primera medición de acuerdo entre dos anotadores independientes sobre 20 casos
de la muestra ciega. **Anotador A:** el agente, que etiquetó los 152 casos del
conjunto. **Anotador B:** David, sin ver `gold-set.json` ni los ejemplos de la
taxonomía, contestando en lenguaje natural sobre el texto de cada mensaje.

Reproducible con `node scripts/acuerdo-pqrs.mjs --medir` sobre `muestra.tsv`.

## El resultado

| Eje | Acuerdo bruto | Kappa | Umbral | |
|---|---|---|---|---|
| `category` | 95% | **0,91** | 0,70 | ✓ |
| `tema` | 90% | **0,89** | 0,70 | ✓ |
| `type` | 55% | **0,42** | 0,70 | ✗ |
| `priority` | 40% | **0,08** | 0,60 | ✗ |

**`priority` con kappa 0,08 es acuerdo de azar.** Con tres valores y una
distribución centrada, dos personas que contestaran al tuntún sacarían
prácticamente lo mismo. No es que uno de los dos etiquete mal: es que la
definición no decide nada.

**Y el bruto vuelve a mentir donde se esperaba.** `type` da 55%, que suena a «la
mitad bien»; su kappa es 0,42. `priority` da 40% y su kappa es 0,08. La distancia
entre las dos columnas es la razón de medir con kappa, y aquí se ve sin discutir.

**Lo que sí queda validado:** `category` y `tema`. Son los dos ejes que se pueden
dar por buenos en los 152 casos sin volver a tocarlos.

## Por qué falla `type`: la definición no cubre el caso más común

Siete discrepancias, y **seis van en la misma dirección**: donde A puso `claim` u
`other`, B puso `petition`.

| Caso | A | B | El mensaje |
|---|---|---|---|
| `MX#192` | claim | petition | «La fuga sigue igual, tienen que entrar a cada departamento a checar» |
| `MX#3587` | claim | petition | «Desde el sábado no prende la luz de torre C. Favor de revisar» |
| `EC#3403` | claim | petition | «La puerta NO se cierra con el control!! ¿Va a permanecer abierta?» |
| `EC#890` | claim | petition | «Está saturado de CO2… Por favor apáguelo» |
| `MX#4700` | other | petition | «Usaremos un rato la alberca a partir de la 1pm» |
| `EC#2943` | other | petition | «Someto a votación en este chat» |
| `EC#4022` | claim | other | «Envío imágenes de una fuga de agua en el parqueadero» |

**El patrón es nítido: casi todos esos mensajes reportan un fallo Y además piden
algo.** «No prende la luz» es un servicio que falla —reclamo—; «favor de
revisar» es pedir —petición—. Las dos lecturas son correctas, y la definición
**no dice cuál gana**. Peor: ese formato —reportar y pedir en la misma frase— es
el más frecuente que hay en PQRS. La definición está incompleta justo donde más
se va a usar.

El caso `EC#4022` señala el otro agujero, el contrario: **reportar sin pedir
nada**. A lo llamó reclamo, B constancia. La definición tampoco lo resuelve.

## Por qué falla `priority`: no hay anclas, solo una frase

Doce discrepancias, y la dirección dice de qué se trata:

| Movimiento | Veces |
|---|---|
| A `low` → B `medium` | 5 |
| A `medium` → B `low` | 3 |
| A `medium` → B `high` | 2 |
| A `high` → B `medium` | 1 |
| A `high` → B `low` | 1 |

**B gravita al centro y A usa los extremos.** No es capricho: durante el
ejercicio B escribió espontáneamente «normal-mucho» y «normal-bajo» **tres veces
de cinco** en la primera tanda, antes de que nadie le hablara de escalas. Su
juicio es continuo y la escala del producto tiene tres peldaños, así que el punto
de corte lo pone quien etiqueta — y ahí no hay dos personas que coincidan.

«Por consecuencia de esperar, no por tono» **no es un criterio operativo**: no
dice cuánto es esperar, ni qué consecuencia cuenta.

**El desacuerdo más grande fue `MX#2481`** —A `high`, B `low`—, y es el mismo
caso que B declaró no haber entendido: mezcla control de acceso de gente de la
calle con dónde se dejan los paquetes. Un caso que un humano no entiende leyendo
con calma es una predicción bastante directa de que el clasificador tampoco.

## Lo que esto dice del producto, no del conjunto

**La PRD ya lo había previsto sin saberlo.** `suggestedPriority` viene con
`priorityReason` y `needsHumanReview` al lado, y el criterio de aceptación exige
revisión humana obligatoria para los `high`. Esta medición explica por qué eso
era necesario: **si dos personas que conocen el producto no coinciden en la
prioridad, exigirle al modelo un acierto alto es exigirle que adivine cuál de
las dos personas le tocó.**

La consecuencia práctica es que el criterio «recall de `high` ≥95%» **no se puede
evaluar todavía**. Antes hay que definir `high` de forma que dos personas lo
apliquen igual.

## Un defecto del método, anotado porque se repetirá

En `MX#1912` y `MX#5923` —los dos casos con hilo previo— **B etiquetó la
conversación en vez del mensaje**: atribuyó al ticket asuntos que estaban en los
mensajes anteriores, escritos por otras personas. Se aclaró y las etiquetas no
cambiaron, pero el defecto es real y es de cómo se presentó el caso.

**Predice un riesgo del producto:** el contrato de entrada de la PRD incluye
`responseHistory` «necesario para comprender el caso». Si un humano con el hilo
delante clasifica el hilo, el modelo con el mismo hilo hará lo mismo. Conviene
que el prompt separe explícitamente «el ticket a clasificar» de «el historial
para entenderlo».

## Qué NO se hace con esto

**No se copian las etiquetas de B sobre las de A.** El resultado no dice que B
tenga razón: dice que la definición admite las dos lecturas. Cambiar 152 casos
para que coincidan con 20 sería fabricar un acuerdo que no se midió.

**Y no se re-etiqueta nada antes de reescribir las definiciones.** El orden es:
arreglar `type` y `priority` en `taxonomia.md`, volver a etiquetar la misma
muestra con las definiciones nuevas, y anotar qué cambió. Ese registro vale tanto
como el número.

## Estado del conjunto

**`category` y `tema`: validados** (kappa 0,91 y 0,89 sobre 20 casos).
**`type` y `priority`: NO validados.** El gold set no se puede usar todavía para
medir esos dos ejes, y decirlo es lo único que impide que el número salga a
pasear como si significara algo.

## Lo que se hizo con esto (mismo día, más tarde)

**Se reescribieron las dos definiciones en `taxonomia.md`**: `type` es ahora un
árbol con orden de precedencia —reportar manda sobre pedir— y `priority` tiene
anclas con casos concretos y la prueba «¿esperar a mañana empeora el
resultado?». **Los 152 casos se re-etiquetaron contra el árbol: cambiaron 23**,
y no son una copia de las etiquetas de B — el árbol corrige a A en unos, a B en
otros, y a los dos en `EC#890`.

**La revalidación NO puede usar esta muestra, y conviene dejar escrito por
qué:** al discutir el árbol, B vio la tabla con lo que el árbol responde en los
siete casos de desacuerdo. Re-etiquetarlos ya no mediría acuerdo, mediría
memoria. **La segunda ronda necesita casos que B no haya visto** — hay 124
reales fuera de esta muestra, así que material sobra.

Hasta esa segunda ronda, `type` y `priority` quedan como **definiciones
corregidas sin validar**. La corrección tiene mejor pinta que la frase que
falló, pero «mejor pinta» es exactamente lo que el kappa existe para no tener
que creerse.
