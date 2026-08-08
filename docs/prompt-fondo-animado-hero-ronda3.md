# Correcciones al FondoHero — ronda 3

Pegar a partir de «═══». Lo de arriba es contexto.

La ronda 2 arregló todo lo que se le pidió. Queda un solo criterio sin cumplir
—el movimiento— y esta ronda trae el diagnóstico real, que no se podía ver
antes: el color está donde las capturas de producto lo tapan, y la estrategia
de «apartar el color del texto» es contraproducente en esta maqueta concreta.

---

═══════════════════ PEGAR A PARTIR DE AQUÍ ═══════════════════

Ronda 2 medida sobre la landing real. **Arreglaste tres de los cuatro
criterios, y con margen.** Esto NO se toca:

| Criterio | Ronda 1 | Ronda 2 |
|---|---|---|
| Subtítulo 390 px (mín. 4,5:1) | 3,61 ❌ | **5,56** ✅ |
| Subtítulo 768 px | 4,14 ❌ | **6,08** ✅ |
| Titular 390 px (mín. 7:1) | 5,50 ❌ | **8,47** ✅ |
| Cantos rectos visibles | los había | **cero** ✅ |
| 90 px superiores | 0,726 | **0,817** ✅ |
| `prefers-reduced-motion` | ✅ | ✅ |

`ellipse closest-side` era exactamente el arreglo: el salto máximo entre
píxeles vecinos es de **2 niveles** y no hay ni uno por encima de 4. La
consulta de medios en 1024 px, el `overflow: hidden` documentado y quitar
`will-change` también están bien resueltos.

Queda **un** criterio sin cumplir, y traigo el diagnóstico real.

---

## El movimiento sigue sin verse, y no es cuestión de velocidad

Medido en la mitad donde vive el texto, a 1440 px: **1,38 de media** en 12 s
(objetivo ≥3). Prácticamente igual que en la ronda 1 (1,18).

Pero el dato que importa es otro. Mapeé qué ocupa cada cosa dentro de la
sección, en porcentaje:

**Escritorio (1440×517)**

| Elemento | x | y | |
|---|---|---|---|
| Texto (titular, subtítulo, botones) | 8–48 % | 12–87 % | contraste crítico |
| Captura del dashboard | 52–92 % | 15–85 % | **OPACA** |
| Captura del teléfono | 80–91 % | 24–91 % | **OPACA** |

**Móvil (390×825)**

| Elemento | x | y | |
|---|---|---|---|
| Texto | 4–96 % | 8–65 % | contraste crítico |
| Captura del dashboard | 4–96 % | 69–96 % | **OPACA** |

Las capturas de producto son **blancas y opacas**, y cubren el **57 % de la
mitad derecha** en escritorio. La ronda 2 llevó todo el color justo ahí. Más de
la mitad del color que pintas está detrás de un pantallazo blanco.

Y en móvil directamente **no hay hueco**: entre el texto (8–65 %) y el
dashboard (69–96 %) se ocupa el 96 % de la altura. Solo quedan franjas de un
4 % arriba, abajo y en medio.

> Aviso: tu maqueta de previsualización usa tarjetas de producto pequeñas y
> semitransparentes. Las reales son grandes, blancas y opacas. Por eso esto no
> se podía ver desde la maqueta, y no es un fallo tuyo.

---

## La conclusión es contraintuitiva

**El fondo se ve, sobre todo, A TRAVÉS de la zona del texto.** Un titular y un
párrafo cubren de tinta un 10–15 % de su caja; el resto es fondo. En cambio una
captura de producto cubre el 100 % de la suya.

O sea que la zona de «contraste crítico» es, por área, **donde más fondo se
ve**, y las dos rondas la han ido vaciando de color para protegerla. Por eso el
resultado se lee quieto: el color vive donde no se ve, y donde se ve no hay
color.

Es exactamente lo que hace la referencia de stacker.ai: el color entra de lleno
en la zona del texto, y el texto se lee porque el fondo es **claro**, no porque
esté **vacío**.

---

## Hay mucho más margen del que estás usando

Calculé el suelo real de luminancia. Con el titular en `#0B3C5D` a 7:1, el
fondo bajo el texto puede bajar hasta **luminancia relativa 0,586**. El
subtítulo `#475569` a 4,5:1 permite hasta 0,574, así que **manda el titular:
0,59**.

Hoy el punto más oscuro bajo el texto es `#DAE3EF`, que es **luminancia 0,76**.

**Estás usando la mitad del rango disponible.** Como referencia, `#C6D2E8` tiene
luminancia 0,64 y sigue dando 7,6:1 al titular y 5,0:1 al subtítulo: bastante
más color del que hay ahora, con margen de sobra.

---

## Qué cambiar

1. **Mete color de verdad en la zona del texto.** Que los lóbulos la crucen en
   lugar de rodearla. El límite no es «que no llegue», es **luminancia ≥ 0,59
   en todo punto**, y de ahí hacia abajo tienes libertad.

2. **Baja el núcleo blanco o hazlo más pequeño.** Hoy es
   `rgba(255,255,255,0.68)` sobre una base que ya es casi blanca: su efecto neto
   es lavar la zona, no iluminarla. Que ilumine de verdad quiere decir que
   alrededor haya algo que iluminar.

3. **Saca color de detrás del dashboard.** La banda `x 52–92 %` en escritorio y
   `y 69–96 %` en móvil está tapada: lo que pintes ahí es trabajo perdido.
   Reparte hacia el borde izquierdo, la franja bajo los botones y los cantos
   superior e inferior.

4. **Acelera.** Ciclos de 29–52 s con `alternate` son 58–104 s de ida y vuelta.
   Bájalos a **18–34 s** y sube los recorridos de 10–16 % a **18–28 %** del
   tamaño de cada lóbulo. Sigue siendo ambiental; hoy es geológico.

5. **En móvil el problema es más agudo**, no menos: al no haber hueco libre, el
   único sitio donde el fondo se ve es la zona del texto. La consulta de medios
   de 1024 px debería mover el color **hacia dentro** del texto en móvil, no
   hacia abajo.

---

## Lo que NO hay que tocar

`ellipse closest-side` · `overflow: hidden` con su comentario · sin
`will-change` · cero dependencias y cero peticiones de red · solo `transform` y
`opacity` animados · `translate3d` · `prefers-reduced-motion` apagando la
animación entera · el grano estático · seguro en servidor · `aria-hidden` y
`pointer-events: none` · keyframes con prefijo propio · mismo fichero y misma
firma:

```tsx
export function FondoHero({ className }: { className?: string }) { … }
```

## Cómo lo voy a comprobar

1. **Contraste** en 390, 768, 1440 y 1920: sigue exigiéndose 4,5:1 al subtítulo
   y **7:1 al titular**. No es negociable, pero ahora sabes exactamente cuánto
   margen tienes: hasta luminancia 0,59.
2. **Cantos**: salto entre píxeles vecinos < 4 niveles. Hoy es 2. No lo pierdas.
3. **Movimiento en la mitad del texto**: ≥3 de media en 12 s (RGB, máximo de
   los tres canales). Hoy 1,38.
4. **Movimiento visible**: comparo dos capturas del hero real con 12 s de
   diferencia y tiene que notarse a simple vista, no solo en los números.
5. `prefers-reduced-motion` en `none`.

Si al meter color en la zona del texto ves que 7:1 en el titular te ahoga la
composición, **dímelo antes de resolverlo por tu cuenta**: hay margen para
discutir el tamaño o el peso del titular, que es una palanca que no has tenido.

═══════════════════ FIN DE LO QUE SE PEGA ═══════════════════
