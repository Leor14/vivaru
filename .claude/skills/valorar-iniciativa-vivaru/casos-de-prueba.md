# Casos de prueba de `valorar-iniciativa-vivaru`

Cada caso tiene una respuesta obvia. **Se corren al cambiar el modelo (`docs/modelo-de-priorizacion.md`)
o la skill**: un agente nuevo, que solo tenga la skill y el modelo, valora cada caso, y el resultado tiene
que coincidir con «Debe salir». Si un caso se mueve, la versión nueva está rota, aunque el resto parezca
bien.

Los tres primeros son la falsación de §9.3 del modelo. Los demás salieron de las tres calibraciones del 15
sep 2026 (`docs/valoraciones/`).

| # | Entrada | Debe salir | Por qué existe el caso |
|---|---|---|---|
| **C1** | **`H.47`** del contrato de la semilla: el estado «Scheduled» sin traducir y las columnas «Titulo» y «Categoria» sin tilde en dos listados de administración | **Puerta XS**: sin puntuar, al lote de XS | Lo pequeño no se puntúa (§2.2); puntuarlo cuesta más que hacerlo |
| **C2** | **`FLOW-006`**, la mora legal y el convenio de pago | **Freno C**, sea cual sea su puntuación, y **fuera de lo elegible hoy** | Espera al abogado ecuatoriano (`G5`). El freno va aparte de la puntuación (§7.3) |
| **C3** | «Un cobro se aplica al cargo de una unidad que no lo pagó; reproducido en staging» | **Puerta de obligatorio**, por integridad del dinero (§2.1) | Un defecto de dinero no compite |
| **C4** | «La portería no puede registrar la entrada de una visita del día: el botón está bloqueado» (la forma de `H.37`) | **No** pasa la puerta de obligatorio; Dolor **por la tabla general** (tarea diaria bloqueada → 3) | Un acceso *negado* no es un acceso *indebido*. En la primera calibración, un estimador dudó entre las dos puertas |
| **C5** | «Que el sistema vaya más rápido», sin ningún dato ni pantalla concreta | **«Por analizar»**, sin nota, diciendo qué falta medir | Sin expediente no hay nota (§3) |
| **C6** | Cualquier necesidad, valorada en un lote cuya cabecera dice que **ya hay un cliente real** | **Sin Día uno**: el criterio no se puntúa, y lo que necesita el cliente va a Dolor, Rodeo e Ingreso | El Día uno caduca con el primer cliente (§5.2) |
| **C7** | Una necesidad **«Parcial con base»**: tres portales, pero la callable y la regla ya existen | Horas **cerca de PH-003 o PLAT-004** (menos de 1,5 h), **no** una L de 4 h | «Cuánto existe ya» manda sobre el número de superficies. En la segunda calibración se estimó PH-003 en 4 h y costó 0,65 |
| **C8** | Cualquier necesidad cuyo estimador escriba «un desarrollador tardaría unos días» | La ficha **se rechaza**: las horas salen de las referencias de §6.2 | El anclaje en tiempos humanos infló la v0.1 hasta 8,6 veces |
| **C9** | Un lote de diez necesidades del menú de `docs/pendientes.md` | **No todas en el mismo cuadrante.** Si salen todas juntas, se informa como fallo de las definiciones, no como resultado | Una escala que no distingue pasa cualquier prueba (§9.3); la v0.2 puso cinco de seis en Pozo |
| **C10** | David pide «dime cuál hago primero» | La skill **ordena y enseña la comparación**, y **no elige**; si David dijo que espere a que él elija, espera | Decide David (§7.4) |

## Cómo se corren

1. Un agente por caso, con la skill y el modelo como únicas lecturas del árbol, y el repositorio en su
   estado actual para el expediente (en C1, C2 y C4 las rarezas y las fichas existen; C3, C5, C6, C8 y C10
   son entradas escritas a mano).
2. Cada agente devuelve la ficha o la decisión de puerta.
3. Se compara con «Debe salir». **Diez de diez**, o la versión no se da por buena.
4. El resultado se guarda en `docs/valoraciones/pruebas-de-la-skill-AAAA-MM-DD.md`, con la versión del
   modelo y de la skill.
