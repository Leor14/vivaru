# Tercera calibración del modelo de priorización — 15 sep 2026 (v0.3)

> **Qué es.** La repetición de §9.1 con la v0.3 de `docs/modelo-de-priorizacion.md`, sobre seis entregas
> que no estaban en ninguna de las dos pasadas anteriores. Las doce anteriores son las referencias del
> modelo.
>
> **Resultado: la v0.3 PASA §9.1 y la dispersión de §9.3.**
> - **Esfuerzo:** las seis quedan dentro del 50 % de las horas reales; el error más grande es un 22 %. El
>   exceso medio es de 1,0 veces, es decir, sin sesgo, y el orden relativo sale con ρ ≈ 0,94.
> - **Impacto:** tres en Ganancia rápida y tres en Relleno, ninguna en Pozo. El Día uno distingue (notas
>   0, 1 y 2), y no sube por igual todo lo que valora.
>
> **Falta, para dar el modelo por bueno:** la doble valoración a ciegas (§9.2) y la falsación con casos
> obvios (§9.3).

---

## 1. Método

- El de las dos pasadas anteriores: un agente por entrega, a ciegas desde el commit de partida, con el
  modelo v0.3 como única lectura del árbol actual.
- **La ceguera sigue sin ser completa.** `CLAUDE.md` y la memoria se cargan solos y cuentan cómo acabaron
  varias de estas entregas, aunque ninguno da horas. Los seis lo declararon. Uno de ellos (PLAT-006)
  recibió además por accidente una línea de `docs/pendientes.md` en un `git grep`.
- **Coste real**: el reloj en `git log` entre el commit de partida y el cierre en producción, con todos
  los commits de la ventana. **Tres de las seis tienen rango ancho** porque su ventana se mezcla con otros
  frentes (PLAT-004, FLOW-003 y FEAT-007); para el error se usa el punto medio del alcance pedido.

## 2. Esfuerzo: estimado frente a real

| Entrega | Partida | Dos referencias elegidas | Estimado | Real | Error |
|---|---|---|---|---|---|
| FEAT-004, estado de cuenta y paz y salvo | `958e110` | FEAT-009 y ONB-002 | **2,3 h** | **~2,0 h**, más el paso a producción al día siguiente | +15 % |
| FLOW-003, cobranza que llega | `3b326ff` | PLAT-005 y FLOW-007 | **3,0 h** | **2,3–3,3 h** | +7 % |
| PLAT-006, la puerta de buzones | `024cbb8` | PLAT-005 y FLOW-004 | **2,5 h** | **~3,2 h**, en dos sesiones | −22 % |
| FEAT-006, unir columnas en un campo | `493dded` | H.51 y FEAT-009 | **1,7 h** | **1,5–2,0 h** | −3 % |
| PLAT-004, entrega 1 | `7b86426` | PH-003 y PLAT-005 | **1,4 h** | **0,8–1,5 h** | +22 % |
| FEAT-007, modo oscuro (con canario) | `8d3ba81` | FEAT-009 y FEAT-008 | **3,3 h** | **~3,8 h** (2,7 hasta producción apagada) | −13 % |

- **Las seis dentro del 50 %.** Media geométrica del cociente: **1,0**, frente a 4,7 en la v0.1 y 1,8 en
  la v0.2.
- **El orden relativo vuelve**: ρ ≈ 0,94, con un solo cruce entre vecinas (FLOW-003 y PLAT-006).
- **Las seis interpolaron entre dos referencias**, y en las seis la descomposición por componentes salió
  más alta (entre 1,3 y 2,1 veces). Mandó la interpolación, como pide §6.2, y acertó. **PLAT-004 explicó
  por qué**: la suma cobra un coste fijo por cada superficie, y cuando hay gemelos ese coste casi
  desaparece. PH-003 lo demuestra (tres portales, 40 minutos).
- **«Cuánto existía ya» fue lo que más acercó**: PLAT-004 se comparó con PH-003 por tener la base hecha,
  y FEAT-007 se alejó de las pequeñas porque el grueso —815 usos de color— no tenía gemelo.

## 3. Impacto

| Entrega | E | H | C | Día uno | Impacto ajustado | Horas | Cuadrante | Freno |
|---|---|---|---|---|---|---|---|---|
| FEAT-004 | 5,5 | 2,0 | 0,5 | 2 | 4,75 | 2,3 | **Ganancia rápida** | A |
| PLAT-004, entrega 1 | 4,5 | 2,5 | 0,5 | 2 (sesión, 0,8) | 4,75 | 1,4 | **Ganancia rápida** | B (G5) |
| PLAT-006 | 5,0 | 2,0 | 0,5 | 0 | 4,5 | 2,5 | **Ganancia rápida** | B (D1–D3) |
| FLOW-003 | 4,5 | 1,0 | 0,5 | 2 (inventario, 0,5) | 3,25 | 3,0 | Relleno | A |
| FEAT-006 | 3,0 | 1,5 | 0,5 | 1 | 3,0 | 1,7 | Relleno | A |
| FEAT-007 | 1,5 | 2,5 | 0,3 | 0 | 2,95 | 3,3 | Relleno | A |

- **Ninguna en Pozo**, cuando en la v0.2 cayeron cinco de seis. Las seis las eligió David, y el modelo
  habría dicho que sí a tres y «entre frentes» a las otras tres. No hay ninguna que rechazara.
- **El Día uno distingue**: 2 en lo que el primer cliente usa cada mes (el estado de cuenta, el informe
  que aprueba el consejo), 0 en lo que protege las demos (PLAT-006) o es preferencia (FEAT-007).
- **La confianza sigue casi constante en 0,5**, y es lo esperable sin clientes. FEAT-007 baja a 0,3
  porque ninguna estimación llega a 2 y la más débil es especulación.
- **El freno funciona aparte de la puntuación**: PLAT-004 y PLAT-006 puntúan alto y el modelo dice que
  no se podían elegir sin una decisión de David.

## 4. Lo que la pasada destapó

1. **Una ley citada de memoria recibió 0,5.** El estimador de FEAT-004 citó la Ley 675 «de memoria, sin
   verificar». Una prueba que nadie ha leído es especulación: **0,3**. Propuesta abajo.
2. **Los rangos anchos del coste real** —cuando una ventana mezcla frentes— son el límite de esta forma
   de medir. Para las referencias, el punto medio basta; para una calibración más fina haría falta
   anotar el frente en cada commit.

## 5. Siguientes pasos

- **Aplicado** (es la regla de §6.2, aprobada en la v0.2: «cada entrega nueva, con su coste medido,
  entra en la tabla»): estas seis pasan a ser referencias, y la tabla tiene dieciocho.
- **Propuesto, pendiente del sí de David:** en §5.4, «**una ley, una norma o un dato citado sin leer la
  fuente vale 0,3**, no 0,5».
- **Pendiente para dar el modelo por bueno:** §9.2 (diez necesidades valoradas por dos agentes, para
  medir el acuerdo) y §9.3 (H.47 → XS; FLOW-006 → freno C; un defecto de dinero reproducido →
  obligatorio). Las dos se pueden hacer con el primer lote real: el menú de `docs/pendientes.md` y las
  rarezas del §H.
