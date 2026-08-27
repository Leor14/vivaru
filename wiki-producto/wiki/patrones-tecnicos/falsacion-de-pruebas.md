---
tags: [patron, pruebas, verificacion, calidad]
tipo: tecnica
fuentes: ["trampas-conocidas", "tests/firestore.rules.test.ts"]
fecha_creacion: 2026-08-27
fecha_actualizacion: 2026-08-27
---

# Falsación de pruebas — un verde solo vale si algo puede enrojecerlo

Una suite en verde no dice que el código esté bien: dice que **ninguno de sus casos distingue el
código bueno del malo**. Para saber cuál de las dos cosas es, hay que **romper el código a
propósito y comprobar que enrojecen exactamente las pruebas que deben**. Esta página existe porque
[[trampas-conocidas]] registra cuatro incidentes con la misma forma —la suite en verde y el
producto roto— y ninguno se habría visto escribiendo una prueba más.

## El procedimiento

1. Nombrar la conducta que la prueba dice vigilar.
2. Romper **esa** conducta en el código: invertir el orden, borrar el bloque de reglas, abrirlo de
   par en par.
3. Correr la suite y **contar cuántas enrojecen y cuáles**.
4. Restaurar. Si el número no es el esperado, el defecto está en la suite, no en el código.

El paso 3 es el que se salta. Que la prueba nueva pase, sola, no prueba nada; lo que prueba es el
contraste con las que siguieron pasando.

## Las cuatro formas de un verde que no vigila

**La suite ciega.** El estado de cuenta de `FEAT-004` tenía **once** pruebas y todas usaban cargos
que vencen en su propio mes; con esa entrada, ordenar por `period` o por `dueDate` da exactamente
el mismo resultado. Al revertir el orden a propósito **falló la prueba nueva y las once pasaron**:
ese contraste fue la prueba de que estaban ciegas.

**Una sola dirección.** El bloque de reglas de `emailDeliveries` se escribió con una prueba que
concede y seis que niegan. Borrarlo entero enrojeció **una**, porque sin regla Firestore deniega
igual. Hacen falta las dos direcciones —borrar la regla y abrirla de par en par—, y se corren con
el emulador según [[pruebas-reglas-emulador]].

**La primitiva equivocada.** `chartOfAccounts` tenía seis pruebas verdes que escribían con `setDoc`
mientras el producto creaba en transacción. No faltaba un caso: el banco probaba **otro camino**.
Ver [[integridad-financiera]] y el patrón de reglas en [[firebase-firestore]].

**La prueba parada.** Meses sin ejecutarse, con los fallos archivados como «preexistentes». Ocupaba
el lugar mental de la verificación sin hacerla, y escondía una prueba de [[reservaciones]] rota.

## Fuera de las pruebas

La misma exigencia gobierna cualquier afirmación de que algo **no** cambia. «Inerte» es una
predicción: comparar el antes con el después no la prueba si el «antes» ya se calcula con el código
nuevo. Hay que aplicar las dos reglas sobre los mismos datos y contar cuántos registros cambian de
lado —así apareció **uno de 89** que la comparación habría dado por inerte—. Vale igual para una
bandera encendida que no mueve nada ([[banderas-funcionalidad]]) y para un comando que termina con
código 0 sin haber hecho el trabajo: **el estado del recurso manda sobre la señal de éxito**,
criterio que [[roadmap-tecnico]] aplica a lo desplegado.

## Relaciones

- Véase también: [[trampas-conocidas]], [[pruebas-reglas-emulador]], [[absolute-bans]]
- Se conecta con: [[integridad-financiera]], [[firebase-firestore]], [[multi-tenancy]]

## Fuentes

- [[trampas-conocidas]] y `tests/firestore.rules.test.ts` en el repositorio de Vivaru.
