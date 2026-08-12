# Línea base — redactar una comunicación a mano

Paso 2.1 de `docs/hoja-de-ruta-ia.md`. Medido el **12 de agosto de 2026**.

**Sin línea base no hay proyecto, hay opinión.** Esto es lo que costaba antes, y
es lo único que va a permitir decir si la IA mejoró algo — o decidir apagarla
sin discutir con nadie.

## Qué se midió

8 comunicaciones, todas **reconstruidas** en una sesión sobre situaciones reales
del corpus vecinal, por **un administrador**. Se hicieron empezando por las
difíciles, para que el efecto aprendizaje no inflara el resultado.

## El resultado

**Mediana: 9,5 minutos por comunicación.** Media 9,4. Rango de 5 a 16.

| Fase | Minutos | Peso | ¿La toca la IA? |
|---|---|---|---|
| 1 · Reunir los hechos | 27,5 | **37%** | No |
| 2 · Redactar | 33,5 | **45%** | Sí |
| 3 · Revisar | 14,0 | **19%** | En parte |

Por dificultad, las difíciles cuestan **2,5 veces** lo que las fáciles (13,2 min
contra 5,3), pero **el reparto entre fases apenas cambia** — 31–38% en reunir
hechos en los tres grupos. Eso significa que el techo del ahorro es parecido en
las fáciles y en las difíciles.

## El techo del ahorro

La IA solo puede tocar la fase 2 y parte de la 3:

| Escenario | Ahorro |
|---|---|
| Redactar baja a cero, revisar igual | **45%** |
| Y además revisar baja a la mitad | 54% |
| Redactar baja a cero pero **revisar sube 50%** | 35% |

Ese último escenario no es pesimismo gratuito: **con un borrador de máquina hay
que verificar que no inventó nada**, y eso puede costar más que releer lo que
uno mismo escribió.

## El número que hay que mirar de frente

Con 3,7 comunicaciones al mes por conjunto —medido sobre 29 meses de corpus— y
un ahorro realista del 25–35% sobre 9,5 minutos:

> **Entre 9 y 12 minutos ahorrados por conjunto al mes.**

**Sobre ahorro de tiempo, los números no justifican la funcionalidad.** Dicho
sin adornos, porque es justo para esto que existe la línea base.

Eso no significa retirarla. Significa que **si el piloto se plantea para
demostrar ahorro de tiempo, va a fracasar aunque la herramienta sea buena.** La
hipótesis de valor tiene que ser otra, y hay tres candidatas que este dato no
descarta:

- **Calidad y consistencia.** Que ninguna comunicación salga sin fecha, sin zona
  afectada o sin decir qué debe hacer el residente.
- **Quien escribe no siempre es el administrador.** Un tercio de los avisos los
  escribe el comité, gente menos entrenada. Su línea base probablemente es peor
  y más variable — y no está medida.
- **Que se comuniquen más cosas.** Si redactar cuesta menos, quizá se avisa de
  cosas que hoy no se avisan.

Ninguna de las tres se demuestra con un cronómetro. Requieren otro piloto y
otras métricas.

## Lo que este dato NO dice

**La fase 1 está subestimada, y bastante.** Cuatro de los ocho casos empezaron
sin todos los datos —faltaba la hora del plomero, el horario del herrero, el
conteo de extintores— y aun así la fase 1 promedió 4,1 minutos. Ese es el tiempo
de **darse cuenta de que falta y preguntar**, no el de obtener la respuesta. En
la vida real esa espera son horas.

De ahí sale una distinción que conviene tener clara:

- **Esfuerzo del administrador** — es lo que mide esta tabla, y es lo que la IA
  puede reducir.
- **Tiempo hasta que el aviso sale** — lo domina el plomero, no la redacción.
  **La IA no lo mejora.**

Si alguien espera que la IA haga que los avisos salgan antes, va a decepcionarse.

**Otras limitaciones, dichas para que nadie las descubra tarde:**

- n = 8, **una sola persona, un solo edificio**. Orden de magnitud, no
  estadística — que es exactamente lo que el plan pedía en este paso.
- Reconstruida: se sabía el desenlace y no había presión real.
- Las dificultades bajaron a la vez que los tiempos, así que **no se puede
  separar el efecto aprendizaje del efecto dificultad**.
- Las dos últimas columnas —si la corrigieron, si llegaron preguntas— están
  vacías. Se llenan solas con las que ocurran en vivo, y son **la mitad de la
  comparación**: no basta con ir más rápido, hay que no empeorar.

## Lo que apareció sin buscarlo

Las dos situaciones más difíciles (dificultad 5) eran **decisiones, no
redacciones**. Y en las dos, el administrador decidió lo contrario de lo que
asume hoy el conjunto de evaluación:

| Situación | Qué hizo el administrador |
|---|---|
| Morosidad, con el comité pidiendo «que les dé vergüenza» | Informó **solo el agregado**. Descartó identificar departamentos y ofreció atención privada |
| El claxon de madrugada de T1-11 | Contactó **en privado**, sin señalarla ante la comunidad |

Nadie se lo sugirió. Lo eligió dos veces, y en una de ellas **en contra de una
petición explícita del comité**.

El conjunto de evaluación, con las decisiones de producto del 11 de agosto,
espera hoy lo contrario: que el borrador **incluya** `T1-11` y `T2-14`. Ver
`datasets/evaluacion/README.md`.

**No es una contradicción que se resuelva sola.** Puede que la capacidad deba
existir aunque el default sea la discreción. Pero tal como está, el conjunto
empujaría al producto hacia una conducta que el profesional que hace este
trabajo rechazó cuando pudo elegir.

## Qué falta para cerrar G1

Tres o cuatro comunicaciones **en vivo**. Son las únicas que miden bien la fase 1
y las dos columnas de calidad. Con eso, la puerta G1 se puede responder con dato
y no con impresión.
