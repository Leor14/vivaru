# v2 de `pqrs-asistir`: la regla contra afirmar acciones — lectura

16 de agosto de 2026 (corrida en UTC del 17, 03:04). Un solo cambio sobre la v1:
**una regla dura nueva en `reglasDuras`**, sin tocar esquemas, prompts ni
catálogos. 152 casos del gold set, `p1-minima`, proveedor real, **USD 0,1435**.

**Titular: la regla corta las afirmaciones de acción en dos tercios —de 21,1% a
6,6%— sin mover la clasificación ni una puerta dura. Y no llega a cero, que es
lo que pide §9.**

## De dónde sale la regla

La v1 ya prohibía **prometer** y **citar**: «no prometas solución, compensación,
sanción ni plazo, y no cites normas, leyes o hechos que no estén en el ticket o
su historial». El modelo cumplía las dos **mientras afirmaba acciones propias**:
«estamos verificando con el equipo de mantenimiento» no es una promesa ni una
cita, así que no la tocaba ninguna de las dos prohibiciones. El hueco estaba en
la forma del acto, no en su contenido.

La v2 lo nombra:

> No afirmes acciones de la administración que no consten en el historial: ni
> hechas («hemos coordinado con mantenimiento»), ni en curso («estamos
> verificando»), ni iniciadas («se ha programado la inspección»). Si no consta,
> el borrador acusa recibo, pide lo que falte y dice qué se hará; nunca lo que ya
> se hizo.

## El contador, y por qué «44 de 152» no era una línea base

**Las 44 de la Fase 2 no se pueden reproducir.** Fueron una lectura a mano cuyo
criterio nunca se escribió, y los ejemplos que cita mezclan dos familias
distintas: «hemos activado el protocolo» —una acción dada por hecha— y
«procederemos a programar la inspección», que en su borrador completo es
condicional («*una vez contemos con esta información*, procederemos a…»). El 44
sigue valiendo por lo que hizo —señalar un problema real— y no como cifra
comparable.

El criterio de ahora está **escrito y congelado antes de correr la v2**, que es
la única forma de que la comparación signifique algo, y vive en
`functions/scripts/medir-afirmaciones-pqrs.mjs` con **autoprueba de 11 casos que
corre siempre antes de contar** — cinco que debe atrapar, cinco que no debe
marcar y uno que debe separar. Sin eso sería el quinto instrumento del programa
que falla antes que la cosa medida.

Dos familias, a propósito:

- **A — acción afirmada.** La administración ya hizo algo, lo está haciendo o lo
  inició. **Es la puerta.** Los 152 casos del gold set tienen **historial vacío**
  (comprobado), así que aquí ninguna acción puede constar: toda afirmación de
  esta familia está sin sustento por construcción, sin juzgar caso por caso.
- **B — compromiso operativo futuro.** «Procederemos a revisar su estado de
  cuenta». Se reporta y **no bloquea**: prometer trabajo futuro es lo que hace
  una administración, y casi todos son condicionales.

Y el detector usa **formas verbales explícitas, no raíces**: con raíces, «hemos
recibido su **report**e» cuenta como «reportar» y el conteo salta a 109 de 152.
El acuse de recibo es un acto de habla sobre el mensaje, siempre verdadero.

## Los números

| | v1 | v2 | |
|---|---|---|---|
| **A · acción afirmada** | 32/152 · 21,1% | **10/152 · 6,6%** | **−69%** |
| B · compromiso futuro | 45/152 · 29,6% | 59/152 · 38,8% | +14 casos |
| `category` | 115/140 · 82,1% | 116/140 · 82,9% | +1 caso |
| `type` | 99/140 · 70,7% | 97/140 · 69,3% | −2 casos |
| `priority` | 110/152 · 72,4% | 109/152 · 71,7% | −1 caso |
| inyección | 8/8 | **8/8** | igual |
| `buzon_simple` nulls | 12/12 | **12/12** | igual |
| guardrail de `high` | 32/32 | **32/32** | igual |
| recall de `high` | 18/19 · 94,7% | 18/19 · 94,7% | igual |
| costo por asistencia | USD 0,00089 | USD 0,000944 | igual orden |

**La clasificación no se movió.** Los tres ejes cambian ±2 casos, y a temperatura
0,2 el modelo no es determinista: eso es ruido, no efecto. Era el riesgo real del
cambio —en F2, la versión que explicaba la frontera de `category` la **giró** en
vez de afinarla y tumbó `type` nueve puntos— y no se materializó. **Una regla que
solo habla del borrador no toca la clasificación**, ahora medido y no supuesto.

## Los diez que quedan, y por qué el prompt ya no es la palanca

**Ocho de los diez son «estamos verificando» o «estamos revisando»** — la frase
que **la propia regla cita como prohibida, con esas palabras exactas**. Nombrarle
el ejemplo al modelo no impide que lo escriba.

De los diez, **seis ya fallaban en la v1 y cuatro son nuevos**, así que tampoco
es un subconjunto duro y estable: hay rotación, consistente con un
comportamiento que la regla suprime sin eliminar.

**La conclusión es que insistir con el prompt no lo va a cerrar.** Es la misma
pared que encontró `category` en F2: cada instrucción mueve la frontera entera y
la siguiente frase no compra lo que la anterior no compró. Para llegar al 0 que
pide §9 hace falta algo determinista, y hay dos formas, las dos baratas y con
decisión de producto dentro:

1. **Comprobación en el servidor, después de validar el esquema.** El mismo
   criterio congelado, aplicado al `draftResponse` antes de devolverlo. Si marca,
   forzar `needsHumanReview: true`. Usa un campo que ya existe, no cambia el
   esquema, y compone con el guardrail de `high`. Su costo: diluye el significado
   de `needsHumanReview`, que hoy dice «no tengo bastante para decidir, o propuse
   prioridad alta».
2. **Señalarlo en la pantalla**, resaltando la frase concreta dentro del borrador
   en vez de un aviso general al lado. El aviso general **ya se probó con una
   persona en la sesión del 16 y no cambió la conducta**: publicó literal.

**Lo que NO se recomienda es otra vuelta de prompt.**

## Estado del criterio de lanzamiento

§9 pide «0 promesas, plazos o hechos no sustentados en los casos que se lean a
mano». Con el criterio congelado: **6,6% en el gold set**, contra 21,1% antes.
**Sigue sin cumplirse.** No es motivo para revertir la regla —es estrictamente
mejor y no cuesta nada— sino para no dar el criterio por resuelto con ella.
