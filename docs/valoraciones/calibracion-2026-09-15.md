# Calibración del modelo de priorización — 15 sep 2026

> **Qué es.** La prueba §9.1 de `docs/modelo-de-priorizacion.md` (v0.1): seis entregas ya construidas,
> valoradas a ciegas con el modelo y comparadas con lo que costaron de verdad.
>
> **Resultado: el modelo NO pasa.** El esfuerzo sale inflado entre 3,3 y 8,6 veces en las seis, aunque el
> orden relativo se conserva (ρ de Spearman 0,89). La confianza sale en 0,5 en las siete valoraciones,
> por un criterio que no mide impacto. Cuatro de las seis caen en «Pozo», y David eligió las seis.
> **Los cambios de §5 los aprobó David el mismo 15 sep y están APLICADOS en la v0.2 del modelo.** Estas
> seis entregas pasan a ser sus casos de referencia (§6.2 del modelo), así que la siguiente calibración
> usa entregas distintas.

---

## 1. Método

- **A ciegas.** Un agente por entrega. Cada uno solo podía leer el repositorio tal como estaba en el
  commit de partida (`git show <commit>:<ruta>`, `git grep … <commit>`) y el modelo del árbol actual. Tenía
  prohibido mirar `git log` posteriores, el traspaso, el roadmap y la bitácora. Los seis declararon lo que
  leyeron.
- **La ceguera no fue completa.** A los seis se les cargaron `CLAUDE.md` y la memoria, que dicen que
  esas entregas acabaron en producción. **Ninguno de los dos dice cuánto tardaron**, y la desviación va
  en la dirección contraria a la que empujaría ese sesgo: saber que se hizo rápido haría estimar menos,
  no más. La conclusión sobre el esfuerzo aguanta.
- **Coste real** medido en git: el reloj entre el commit de partida y el último commit de la entrega,
  con todos los commits de la ventana, no solo los que nombran el frente. Los ficheros salen de sus
  commits de construcción, y las intervenciones de David de las fichas y el traspaso. **Es un mínimo**:
  deja fuera lo que pasó antes del primer commit de un bloque y después del último, que puede sumar un
  10–30 %.

## 2. Esfuerzo: estimado frente a real

| Entrega | Partida | Estimado (sesiones · horas) | Real (horas de reloj activo · sesiones) | Horas: estimado ÷ real | Ficheros · líneas reales |
|---|---|---|---|---|---|
| FEAT-008, tres entregas | `4f4c32b` | 11,2 · 32 h | **3,7 h** · 1 | **8,6×** | 35 · +3.308 |
| FLOW-008 | `8094c59` | 10,8 · 14 h | **3,8 h** · 1 | **3,7×** | 36 · +4.744 |
| PLAT-005 | `e0e5406` | 9,6 · 12 h | **1,9 h** · 2 (con 15 h de espera) | **6,3×** | 27 · +1.412 |
| FIX-003 (UX-004) | `b959076` | 2,97 · 4 h | **0,6–1,0 h** · una fracción | **~5×** | 17 · +494 |
| H.51 y D2 | `ecc0d0c` | 3,1 · 5 h | **1,3–1,6 h** · 1 | **~3,4×** | 12 · +361 |
| H.31 y H.37 | `ec73649` | 2,1 · 3 h | **0,9 h** · una fracción (con 5,5 h de espera) | **~3,3×** | 5 · +104 |

- **Media geométrica del exceso: unas 4,7 veces en horas.** Las seis se desvían más del 50 %, así que
  el criterio de §9.1 obliga a reescribir.
- **El orden relativo sí se conserva**: ρ = 0,89, con solo dos cambios de puesto entre vecinos
  (FEAT-008 con FLOW-008, y FIX-003 con H.31–37). **Comparar tamaños funciona; la escala absoluta no.**
- **La sesión no sirve como unidad.** Una sola sesión se tragó una PRD de tres entregas en los dos
  ambientes (FEAT-008), y otra repartió la tarde entre tres frentes (FIX-003, ONB-002 y PH-003). Dura
  entre media hora y cuatro, así que no mide nada.
- **Es el fallo que describe `agent-estimation`**: anclar en tiempos humanos. El modelo lo prohibía
  (§6.5) y los seis agentes lo cometieron igual. Una prohibición escrita no basta: hacen falta **casos de
  referencia propios** con los que comparar.

### El tiempo de David no suma trabajo: suma espera

Los agentes estimaron entre 35 y 120 minutos de intervenciones por entrega. Lo que se midió es otra
cosa: **cuando David no estaba en la sesión, la entrega esperó**. PLAT-005 esperó 15 horas al iPhone y
H.31–37 esperó 5,5 horas al permiso de producción. FEAT-008 y FLOW-008, con David presente toda la tarde, no
esperaron. **Lo que cuesta es la espera en el calendario, no los minutos.**

## 3. Impacto: lo que dieron las valoraciones

| Entrega | VC | VN | U | C | Impacto ajustado | Cuadrante |
|---|---|---|---|---|---|---|
| FEAT-008 | 8 | 3 | 1 | 0,5 | 3,75 | Pozo |
| FLOW-008 | 6 | 5 | 1 | 0,5 | 3,75 | Pozo |
| PLAT-005 | 5 | 1 | 1 | 0,5 | 2,5 | Pozo |
| FIX-003 | 7 | 4 | 1 | 0,5 | 3,75 | Relleno (en la frontera) |
| H.51 y D2 | 3 | 3 | 1 | 0,5 | 2,5 | Pozo (en la frontera) |
| H.31 | 7 | 7 | 2 | 0,5 | 5,5 | Relleno |
| H.37 | 11 | 7 | 2 | 0,5 | 6,5 | Ganancia rápida |

- **La confianza sale en 0,5 en las siete.** Casi siempre por el mismo motivo: el Alcance es un hecho del
  código (qué roles y portales toca), su prueba siempre es «leída», y con la regla de la prueba más
  débil hunde toda la valoración. En FEAT-008 decide el cuadrante: con el Alcance a 0,8 pasa de Pozo a
  Apuesta.
- **Cuatro de seis en Pozo, y David eligió las seis.** Los umbrales están justo donde caen las
  estimaciones infladas, y la confianza aplastada deja el impacto ajustado casi siempre por debajo de 6.
  §9.3 lo avisaba: si las puntuaciones no distinguen, las definiciones están mal.

## 4. Definiciones que los agentes encontraron ambiguas

1. **Alcance**: no queda claro si «todos los conjuntos» es dónde existe la pantalla o a quién le duele
   (FIX-003).
2. **La puerta de lo obligatorio para defectos**: §5.1 manda allí todo defecto con G = 3, pero §2.1 habla
   de acceso *indebido*, y en H.37 el acceso estaba *negado*.
3. **Ingreso**: «rompe la demo» no encaja en ninguna nota (H.31).
4. **Confianza sin notas de 2 o más**: la regla no dice qué hacer (H.51).
5. **Urgencia y Desbloqueo con plazos internos**: el orden de un plan propio subió los dos criterios de
   H.31–37 a 2.

## 5. Cambios al modelo — APROBADOS por David el 15 sep y aplicados en la v0.2

1. **Unidad de esfuerzo: horas de trabajo activo**, no sesiones. Tallas: XS ≤ 0,5 h · S 1 h · M 2 h ·
   L 4 h · XL 8 h · XXL 16 h; si pasa de ahí, se parte.
2. **Estimar comparando con casos de referencia propios**, que son las entregas de esta tabla con su
   coste real. FIX-003 y H.31–37 son S; H.51 y D2, M; PLAT-005, M más una espera; FEAT-008 y FLOW-008,
   L. Se compara primero y se descompone después, porque comparar es lo que funcionó.
3. **El tiempo de David se cuenta como esperas**: cuántos puntos de la entrega necesitan a David. Si
   no está en la sesión, cada uno suma calendario. Los minutos se siguen anotando.
4. **La confianza solo se aplica a lo que es una estimación del mundo**: Dolor, Obligación, Rodeo,
   Ingreso, Riesgo que quita y Urgencia. **Alcance, Desbloqueo y Cierre son hechos del repositorio**: se
   comprueban leyendo y no llevan descuento. Si ninguna estimación llega a 2, manda la más débil de las
   que tienen 1 o más.
5. **Las cinco definiciones de §4, afinadas:**
   - el Alcance cuenta a quién le duele, no dónde está la pantalla;
   - G = 3 es dinero, acceso indebido o datos perdidos, y un bloqueo va por la tabla general del Dolor;
   - la única puerta de lo obligatorio es la de §2.1;
   - Ingreso 2 incluye «falla a la vista en la demo acompañada»;
   - Urgencia y Desbloqueo no cuentan plazos ni órdenes de un plan propio: solo fechas externas y
     requisitos técnicos o de datos.
6. **El umbral de esfuerzo del cuadrante, en 4 horas** (talla L). El de impacto se vuelve a mirar con los
   cambios aplicados, antes de moverlo.

**Para comprobar que los cambios bastan, se repite esta calibración con agentes nuevos** y la misma
ceguera, y después se hace §9.2.

## 6. Dos elecciones de David que el modelo no habría hecho

Aun con los cambios de §5, **FLOW-008 y PLAT-005 seguirían en Pozo**:
- **FLOW-008**: su Riesgo que quita va con prueba leída. Si se midiera en los datos, pasaría a Apuesta.
  Eso es el modelo funcionando: dice qué prueba conseguir.
- **PLAT-005**: ninguna estimación suya llega a 2, y su prueba más fuerte es «leída».

Si David las eligió por algo que el modelo no pregunta (preparar la demo, llegar listos al primer
cliente, lo que dijo la administradora), **ese es el criterio que falta**, y §9.1 manda buscarlo antes
de dar el modelo por bueno.
