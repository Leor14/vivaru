# Segunda calibración del modelo de priorización — 15 sep 2026 (v0.2)

> **Qué es.** La repetición de §9.1 con la v0.2 de `docs/modelo-de-priorizacion.md` (`88b03f1`), sobre
> seis entregas **distintas** de las de la primera pasada, porque aquellas son ya los casos de
> referencia del modelo.
>
> **Resultado: la escala mejora mucho, pero el modelo aún no pasa.**
> - **Esfuerzo:** el exceso medio baja de 4,7 veces a 1,8. Tres de las seis quedan dentro del 50 % (una
>   solo por el tope de su rango), así que cumple la letra de §9.1 por un caso. **Pero pierde la
>   resolución**: cuatro de seis estimaciones son exactamente «L, 4 horas», y el orden relativo cae de
>   ρ = 0,89 a unos 0,4.
> - **Impacto:** la confianza sale en 0,5 en las seis, esta vez con razón (sin clientes, ninguna
>   estimación está medida ni dicha por un usuario). Con eso, **cinco de seis caen en Pozo**, y David
>   eligió las seis: §9.3 no pasa la dispersión.
>
> **Las propuestas de §5 esperan el sí de David.**

---

## 1. Método

- El mismo que la primera pasada (`docs/valoraciones/calibracion-2026-09-15.md`, §1): un agente por
  entrega, a ciegas desde el commit de partida, con el modelo v0.2 como única lectura del árbol actual.
- **La ceguera tampoco fue completa.** A los seis se les cargaron `CLAUDE.md` y la memoria, que cuentan
  cómo acabaron varias de estas entregas; ninguno de los dos da horas. Los seis lo declararon.
- **Coste real**, del reloj en `git log` entre el commit de partida y el cierre en producción, con todos
  los commits de la ventana.

## 2. Esfuerzo: estimado frente a real

| Entrega | Partida | Referencia elegida | Estimado | Real | Error |
|---|---|---|---|---|---|
| ONB-002, el padrón sin duplicados | `4eb3ceb` | FEAT-008 (L) | **4 h** | **2,35 h** | +70 % |
| PH-003, la visita sin avisar | `4613de4` | FLOW-008 (L) | **4 h** | **0,65 h**, más la validación con la portería al día siguiente y un arreglo | **+515 %** |
| FEAT-009, entregas 1 y 2 | `f618b3b` | FEAT-008 (L) | **3,3 h** | **1,2–2,9 h**: hay 1,7 h sin commits que pueden ser trabajo o pausa | +14 % a +175 % |
| FEAT-010, cuatro entregas | `ec9058b` | FEAT-008 (L) | **4 h** | **3,0 h** | +33 % |
| FLOW-007, entregas 1 y 2 | `99dc294` | FEAT-008 (L) | **4 h** | **3,9–4,4 h** | ≈ 0 % |
| FLOW-004, el expediente de conciliación | `9eaff65` | FLOW-008 (L) | **5 h** | **2,8 h** | +79 % |

- **Media geométrica del exceso: 1,8 veces**, frente a 4,7 de la v0.1. La escala absoluta ya casi está.
- **Dentro del 50 %: FLOW-007, FEAT-010 y FEAT-009** (esta, solo si se mide contra el tope de su rango).
  Fuera: ONB-002, PH-003 y FLOW-004. Tres de seis no son «más de la mitad», así que la letra de §9.1 se
  cumple, pero por un caso y con uno dudoso.
- **Las seis eligieron una referencia L**, y cuatro acabaron en 4 horas exactas. La tabla de referencias
  tiene un hueco entre 1,9 h (PLAT-005) y 3,7 h (FEAT-008): **todo lo que toca reglas o callables salta a
  la L.** Por eso el orden se pierde. La v0.1 descomponía y ordenaba bien pero en la escala equivocada;
  la v0.2 compara y acierta la escala pero no ordena.
- **PH-003 enseña qué variable falta: cuánto existe ya.** Su callable, `registerWalkInVisit`, existía, y
  la regla del residente ya concedía la lectura. El agente comparó por superficies tocadas y no por el
  tamaño del cambio sobre lo que había.

## 3. Impacto

| Entrega | E | H | C | Impacto ajustado | Horas estimadas | Cuadrante |
|---|---|---|---|---|---|---|
| ONB-002 | 2,5 | 1,0 | 0,5 | 2,25 | 4 | Pozo |
| PH-003 | 4,5 | 2,0 | 0,5 | 4,25 | 4 | Pozo |
| FEAT-009 | 5,5 | 1,5 | 0,5 | 4,25 | 3,3 | Relleno |
| FEAT-010 | 1,5 | 0,5 | 0,5 | 1,25 | 4 | Pozo |
| FLOW-007 | 4,5 | 2,5 | 0,5 | 4,75 | 4 | Pozo |
| FLOW-004 | 4,0 | 1,5 | 0,5 | 3,5 | 5 | Pozo |

- **La confianza ya no la hunde el Alcance**: sale 0,5 porque las estimaciones con nota 2 están
  «leídas», y sin clientes no pueden estar de otra forma. **Pero entonces C no distingue: es un factor
  común que multiplica todo por 0,5.** Con él, el impacto ajustado de estas seis va de 1,25 a 4,75, y
  **el umbral de 6 queda fuera de alcance** para casi cualquier cosa hasta que haya clientes.
- **Cinco de seis en Pozo y una en Relleno**, y la única que se libra lo hace por las horas, no por el
  impacto. Sumadas a la primera pasada, **el modelo habría dicho «no se hace» a la mayoría de las doce
  entregas que David eligió.**
- **Dos agentes, cada uno por su lado, nombraron el criterio que falta**: FEAT-010 («el modelo no tiene
  un criterio para "llegar listos al primer cliente"») y PH-003 («un Pozo que David elige igual»). Es la
  misma pregunta que dejó abierta la primera pasada con FLOW-008 y PLAT-005.

## 4. Lo que queda claro

1. **La escala del esfuerzo ya está razonablemente bien**; lo que falla es la **resolución**, por el hueco
   de la tabla de referencias y porque no se pregunta cuánto existe ya.
2. **Sin clientes, la confianza es una constante.** Un umbral absoluto de impacto pensado para
   confianzas de 0,8–1,0 no sirve hasta que las haya.
3. **Falta un criterio, o David elige con uno que el modelo no conoce.** Doce entregas elegidas y la
   mayoría en Pozo no se arreglan tocando umbrales: primero hay que saber por qué se eligieron.

## 5. Propuestas — PENDIENTES DEL SÍ DE DAVID

1. **La tabla de referencias pasa de 6 a 12 entregas**, las de las dos pasadas, con sus horas medidas
   **y una columna nueva: cuánto existía ya** (Nuevo, Parcial con base o casi hecho). Se estima con las
   horas de las dos referencias más parecidas, sin redondear a la talla; las tallas quedan para hablar,
   no para puntuar.
2. **El umbral de impacto baja de 6 a 4 mientras no haya clientes**, con la nota de que se revisa el día
   que llegue el primero, porque la confianza subirá. Con 4, esta pasada separa tres y tres.
3. **Antes de tocar criterios, David contesta la pregunta abierta**: por qué eligió FLOW-008, PLAT-005,
   FEAT-010 y PH-003. Si la respuesta es «llegar listos al primer cliente», se decide si es un criterio
   nuevo o si pesa más lo que ya existe (Obligación 1, «la competencia lo tiene»; Ingreso 2, «hueco
   contra Habitanto»).
   **Contestada por David el 15 sep: «las elegí para llegar listos al primer cliente».** Queda por
   decidir cómo entra en el modelo.
4. **Una tercera pasada, con entregas que no estén en ninguna de las dos** —quedan medibles FEAT-004,
   PLAT-004, PLAT-006, FEAT-006, FEAT-007 o FLOW-003—, cuando estén aplicadas 1 a 3.
