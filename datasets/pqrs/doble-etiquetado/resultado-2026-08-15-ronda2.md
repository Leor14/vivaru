# Segundo doble etiquetado del gold set de PQRS — 15 de agosto de 2026 (tarde)

Revalidación de `type` y `priority` tras reescribir sus definiciones. **Anotador
A:** el agente, con las etiquetas de `gold-set.json` re-etiquetadas contra el
árbol. **Anotador B:** David, sobre 20 casos que no había visto.

Reproducible con
`node scripts/acuerdo-pqrs.mjs --medir --muestra datasets/pqrs/doble-etiquetado/muestra-2.tsv`.

## Lo que se fijó ANTES de correr

Va primero a propósito: un criterio escrito después de ver el número no vale.

- **Umbrales sin tocar:** `type` 0,70 y `priority` 0,60, los mismos de la ronda 1.
- **Doble exclusión, 116 casos limpios de partida.** Fuera los 20 de la primera
  muestra —quemada— y fuera los **19 identificadores que `taxonomia.md` cita como
  ancla o ejemplo**: tres de ellos (`EC#2627`, `MX#3019`, `MX#604`) habían caído
  en el primer sorteo, y su etiqueta la imprime el propio documento. Medir sobre
  un ancla mide si el anotador sabe copiar.
- **Muestreo estratificado, semilla 20260815:** 5 `high` / 7 `medium` / 8 `low`,
  más 2 `other` forzados dentro de `low`. **`high` queda sobrerrepresentado 4×**
  sobre su prevalencia real (10 de 116), así que **el kappa de `priority` de esta
  ronda no es de prevalencia natural** y no se compara de frente con el 0,08.
- **B etiquetó con el árbol y las anclas delante**, no a ciegas. Decisión
  explícita: la pregunta abierta era si las definiciones corregidas son
  *aplicables*, no si coinciden con la intuición — eso ya se midió y dio 0,42.
  **Un aprobado raspando valdría menos que uno de la ronda 1**, porque B tenía el
  código a la vista.

## El resultado

| Eje | Acuerdo bruto | Kappa | Umbral | Ronda 1 | |
|---|---|---|---|---|---|
| `type` | 65% | **0,53** | 0,70 | 0,42 | ✗ |
| `priority` | 65% | **0,47** | 0,60 | 0,08 | ✗ |

**Los dos siguen suspendiendo. Los dos se movieron.**

**`priority` salió del azar**, y eso es el hallazgo con signo positivo del día:
0,08 era acuerdo de moneda al aire, 0,47 es desacuerdo real sobre casos
concretos. **Las anclas con casos hicieron lo que la frase no hacía.** El
desempate «gana el más bajo» no se llegó a usar: B no declaró ninguna duda.

**Y las marginales ya casi coinciden** — A puso 5/7/8, B puso 5 `high`, 9
`medium`, 6 `low`—, así que el patrón de la ronda 1 (B al centro, A a los
extremos) **desapareció**. Lo que queda no es un sesgo de escala: es ruido caso a
caso.

## `type` falla por lo mismo que la vez pasada, y eso es peor que fallar

Siete discrepancias. **Cuatro van en la misma dirección que en la ronda 1:**
donde A puso `claim` o `complaint`, B puso `petition`.

| Caso | A | B | El mensaje |
|---|---|---|---|
| `MX#730` | claim | petition | «pedir que quiten la basura del sótano… dificulta la maniobra» |
| `MX#6258` | claim | petition | «tienen que decirle al vigilante que cierre la llave de paso» |
| `MX#5457` | complaint | petition | «pusieron unos tubos estorbando… ojalá puedan hacer énfasis» |
| `EC#3738` | complaint | petition | «hace semanas quedó en venir… ¿me podría decir cuándo?» |
| `MX#4689` | claim | other | «no se ve nada raro… les recomiendo checar su estufa» |
| `EC#162` | suggestion | complaint | «no cuesta nada hacer la limpieza si se cae algo» |
| `MX#3959` | petition | complaint | «ya pregunté en la caseta y me dicen que no ha llegado» |

**La regla de precedencia —«reportar manda sobre pedir»— es exactamente la que no
prendió.** Y esta vez B la tenía escrita delante, así que la explicación cómoda
de la ronda 1 —«no la había leído»— ya no está disponible. Es la lección 9 otra
vez: cuando una conducta se repite con la causa supuestamente eliminada, la causa
era otra.

Los otros tres desacuerdos no forman patrón.

## El defecto de método, y su comprobación

**El mismo agente produce las etiquetas de A y media las de B.** B contesta en
lenguaje natural y el agente traduce; cuando la respuesta nombraba las dos
mitades («reporta y pide»), el agente ofrecía una horquilla de dos opciones **que
él mismo construía**. Eso es la lección 2 —la comprobación comparte el punto
ciego de lo que comprueba—, y se detectó a mitad del ejercicio, no al final.

**Se corrigió en marcha:** a partir del caso 11, en los ambiguos B nombra la
etiqueta él, sin horquilla. Y se midió el daño:

| Subconjunto | `type` | `priority` |
|---|---|---|
| Las 20 | 0,53 | 0,47 |
| Los 14 sin horquilla del agente | 0,51 | **0,66** |
| Los 6 con horquilla | 0,37 | **−0,00** |

**Salió al revés de lo temido: la mediación no infló el acuerdo, coincide con los
casos donde más se discrepa.** Explicación directa: el agente preguntaba
justamente en los casos ambiguos, así que el subconjunto mediado es el difícil
por construcción, no por contaminación.

**El 0,66 NO cuenta como aprobado.** El criterio era 20 casos y estaba fijado
antes de correr; cantar un subconjunto elegido después de ver el resultado es la
lección 8 exacta. `priority` da **0,47 y suspende**. El 0,66 es diagnóstico —dice
dónde mirar—, no resultado.

## El `high`, que es para lo que se sobremuestreó

| | Casos |
|---|---|
| `high` de A | `MX#4689` `MX#3983` `EC#3042` `MX#6258` `EC#3703` |
| `high` de B | `MX#730` `EC#3042` `MX#3441` `MX#6258` `EC#3703` |
| **Coinciden** | **3 de 5** |

**El criterio «recall de `high` ≥95%» de la PRD sigue sin ser evaluable**, pero ya
no por impresión: dos personas que conocen el producto marcan el mismo `high` tres
veces de cinco. Pedirle 95% a un modelo contra una referencia así es pedirle que
adivine qué anotador le tocó.

## Lo que apareció mirando el producto, y vale más que el kappa

Antes de reescribir ninguna definición se comprobó **qué hace el producto con
estos dos ejes**. La respuesta reencuadra el problema entero:

- **`type` no decide nada en el código.** Sus únicos usos son pintar la etiqueta
  en pantalla (`getTicketTypeLabel`) y llenar el desplegable de filtro de
  `/admin/pqrs`. Ningún plazo, ninguna asignación, ninguna ruta.
- **`priority` está declarado en `domain.ts` y usado en cero pantallas de PQRS.**
  Los usos de `priority` que hay en el repo son los tickets de soporte de
  superadmin, que son otra cosa.
- **La diferencia entre los dos está en lo escrito, no en lo construido:** de
  `priority` la PRD dice para qué sirve —revisión humana obligatoria en los
  `high`—; de `type` no hay nada en el repo que diga qué decide. **La PRD de PQRS
  vive en Drive**, así que esa pregunta no se puede cerrar desde aquí.

**Y hay un defecto vivo en producción.** El desplegable donde el residente elige
el tipo (`src/app/(resident)/resident/pqrs/page.tsx`) enseña las **definiciones
cruzadas**:

> `complaint` → «Queja: Inconformidad con un **servicio**»
> `claim` → «Reclamo: Corrección de un error o incumplimiento»

La taxonomía fija lo contrario —queja es de una **persona**, reclamo es de un
**servicio**— y documenta ese cruce como el error que costó rehacer el eje dos
veces. **La corrección se aplicó al gold set y no a la pantalla.** Todo `type`
que un residente elija hoy se elige bajo la definición equivocada, y el
desplegable además no ofrece `other`, que el gold set sí usa.

## Qué NO dice esta medición

- **No dice que B etiquete mal.** Dice que la definición admite dos lecturas y
  que la precedencia escrita no es la que aplica una persona real.
- **No dice que `priority` esté a punto.** 0,47 con `high` sobrerrepresentado y
  con el eje suspendido es «mejoró mucho y sigue sin servir para medir».
- **No autoriza a copiar las etiquetas de B.** Mismo argumento que la ronda 1:
  cambiar 152 casos para que coincidan con 20 fabrica un acuerdo que no se midió.
- **Y no quedan casos limpios de sobra para una tercera ronda barata:** el pool
  baja de 116 a 96, y solo 5 de ellos son `high`.

## Lo que sigue, en orden

1. **Arreglar el desplegable del residente**, con las definiciones de la
   taxonomía y `other` incluido. Es pequeño, y mientras siga así ensucia todo
   dato de `type` que produzca producción.
2. **Abrir la PRD de PQRS en Drive y decidir para qué sirve `type`.** Si solo
   llena un filtro, un kappa de 0,53 no bloquea nada y el eje deja de ser
   prioritario. Si decide algo, hay que resolver la precedencia — y las opciones
   son invertirla, quitarla, o que el modelo devuelva las dos lecturas y elija el
   administrador, que ya es cambiar la PRD y no la taxonomía.
3. **`priority` se lleva el esfuerzo de definiciones**, porque es el que tiene
   consecuencia escrita. Los siete desacuerdos de esta ronda son el material.
   *(Hecho la noche del mismo 15 — ver
   `definiciones-priority-2026-08-15.md`: dos golds corregidos, el enfado a
   bandera, la sección reescrita como preguntas en orden, y la tercera ronda
   aplazada por decisión.)*
