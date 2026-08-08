# Correcciones al FondoHero — ronda 2

Pegar a Claude Design a partir de «═══». Todo lo de arriba es contexto tuyo.

Origen de los números: monté el componente en el landing real y medí con
Playwright + sharp, ocultando el contenido para fotografiar solo el fondo y
descartando el banner de cookies, que falseaba la primera medición.

---

═══════════════════ PEGAR A PARTIR DE AQUÍ ═══════════════════

Monté el `FondoHero` que me diste en la landing real y lo medí. La base es
buena y no quiero que la rehagas: cero dependencias, cero peticiones de red,
6,2 KB, solo anima `transform`, seguro en servidor, `aria-hidden` con
`pointer-events: none`, keyframes prefijados y `prefers-reduced-motion`
apagando la animación —verificado, `animation-name: none`—. El movimiento
existe y se percibe: 3,82 niveles de diferencia media y 29 de máxima en 12
segundos.

Hay tres defectos. Los dos primeros tienen causa localizada; el tercero es de
composición y es el importante.

---

## 1. Los lóbulos tienen el borde visible

En la captura del fondo aislado se ven **líneas rectas** cortando las manchas.
No es banding: es el canto de las cajas.

La causa es aritmética. Usas:

```css
background: radial-gradient(circle at center, rgba(75,95,212,0.55) 0%, rgba(75,95,212,0) 62%);
width: 62%; height: 90%;
```

`circle` sin palabra clave de tamaño resuelve a `farthest-corner`. En el hero
a 1440 px esa caja mide 893×465 px. La distancia del centro a la esquina es
503 px, así que el degradado llega a transparente a 62 % × 503 = **312 px del
centro**. Pero la caja solo llega a **233 px** por arriba y por abajo. El
color todavía está a media opacidad cuando la caja se acaba, y el canto de la
elipse se ve como una línea.

Horizontalmente no pasa porque el semiancho es 446 px, mayor que 312.

**Arreglo:** que el desvanecido termine siempre dentro de la caja, en todas
las proporciones. Lo directo es `radial-gradient(ellipse closest-side, …)`,
que ancla el final del degradado al borde más cercano; así deja de depender
de las proporciones de la caja. Si prefieres seguir con `farthest-corner`,
la parada transparente tiene que caer por debajo de la relación
`semieje-menor / distancia-a-la-esquina` del lóbulo más achatado, y hay que
recalcularla cada vez que se cambie un tamaño. Recomiendo `closest-side`.

Con `closest-side`, `border-radius: 9999px` deja de hacer falta: el propio
degradado ya es transparente en el borde.

---

## 2. El contraste falla en móvil y en tablet

Medido sobre el peor píxel del fondo dentro de la caja del texto:

| Ancho | Peor fondo | Subtítulo `#475569` (mín. 4,5:1) | Titular `#0B3C5D` (mín. 7:1) |
|---|---|---|---|
| 390 | `#9bb4e1` | **3,61:1 ❌** | **5,50:1 ❌** |
| 768 | `#aac1e6` | **4,14:1 ❌** | **6,31:1 ❌** |
| 1440 | `#e4e9f6` | 6,24:1 ✅ | 9,50:1 ✅ |
| 1920 | `#e8eaf7` | 6,33:1 ✅ | 9,65:1 ✅ |

La causa es que tu capa de legibilidad protege **el lado izquierdo**:

```css
linear-gradient(to right, rgba(244,247,251,0.78) 0%, rgba(244,247,251,0) 46%)
```

Eso vale en escritorio, donde el texto ocupa la mitad izquierda. Pero **por
debajo de 1024 px el hero se apila**: el texto pasa arriba y ocupa **todo el
ancho**, así que su mitad derecha queda sobre el lóbulo azul sin ninguna
protección.

Dato que probablemente explica el fallo, y que no te di con suficiente
claridad: **la sección cambia de proporción por completo** entre anchos, no
solo de reparto.

| Ancho | Sección hero | Proporción | Dónde está el texto | Dónde el producto |
|---|---|---|---|---|
| 1440 | 1280 × 517 | 2,48 : 1 apaisado | mitad izquierda | mitad derecha |
| 390 | 390 × 825 | 0,47 : 1 **vertical** | **arriba**, ancho completo | **abajo** |

Una composición afinada para una banda apaisada no puede sobrevivir tal cual
en una caja vertical. Necesita reposicionarse.

**Arreglo:** usa una consulta de medios en 1024 px y **recoloca los lóbulos**,
que en CSS no cuesta nada:

- **≥1024 px:** claro a la izquierda, color a la derecha. Como ahora.
- **<1024 px:** claro **arriba**, color **abajo**. Los lóbulos saturados bajan
  al tercio inferior de la sección, que es donde van las capturas.

Y que la capa de legibilidad siga la misma lógica: `to right` por encima de
1024 px, `to bottom` por debajo.

---

## 3. La mitad izquierda está muerta — este es el importante

Medí el movimiento por mitades en 12 segundos:

- mitad **izquierda** (donde está el texto): **1,18 niveles**
- mitad **derecha**: **6,33 niveles**

Cinco veces menos movimiento justo donde cae la mirada primero. El velo plano
al 78 % de opacidad borra el efecto exactamente en la zona que más se mira, y
el efecto es la razón de ser del encargo.

Además la composición se lee como **una sola masa** abajo a la derecha: los
seis lóbulos están anclados al mismo rincón y el 45 % izquierdo queda liso.
La referencia no funciona así — en ella el color envuelve los cuatro bordes y
lo que mantiene el texto legible es que **el núcleo es brillante**, no que
haya una capa lisa encima.

**Cambio de estrategia, y es el punto central de esta revisión:**

> La legibilidad tiene que salir de **la composición**, no de un velo que tapa.

En concreto:

1. **Baja el velo a un 30–40 % como mucho**, o quítalo. Deja de ser una capa
   que oculta y pasa a ser un matiz.
2. **Mete un núcleo claro móvil**: un lóbulo grande de
   `rgba(255,255,255,0.55–0.7)` que viva bajo la zona del texto y derive
   despacio como los demás. Es lo que sostiene el contraste. Al moverse, la
   zona del texto deja de estar quieta.
3. **Baja la opacidad de los lóbulos de color que puedan alcanzar la zona del
   texto** —el azul `#4B5FD4` está a 0,55, que es mucho— y deja las opacidades
   altas solo para los que viven en el borde opuesto.
4. **Reparte los lóbulos por los cuatro bordes**, no todos en el mismo rincón.
   Al menos uno tocando el borde izquierdo y uno el superior, ambos suaves.
5. **Que cada lóbulo se mueva de verdad en la zona que ocupa.** Objetivo
   medible: la diferencia media en la mitad del texto tiene que subir de 1,18
   a **al menos 3 niveles**, quedándose por debajo de la otra mitad. Que se
   note vivo, sin competir con el texto.

Es un equilibrio más fino que tapar con un velo, pero es el que hace que el
fondo se vea en toda la sección en vez de en un rincón.

---

## 4. Dos cosas menores

**`will-change: transform` sobra en los seis lóbulos.** Cada uno mide unos
893×465 px CSS; a densidad 2 son ~6,6 MB de textura de GPU cada uno, unos
40 MB retenidos de forma permanente. Animar `transform` ya promociona la capa
mientras dura la animación, así que la declaración solo hace permanente algo
que el navegador ya hace solo. Quítala.

**`overflow: clip` sin reserva.** En Safari 15 y anteriores no existe y cae a
`visible`; los lóbulos con desplazamientos negativos (`right:-8%`,
`bottom:-22%`) se derramarían sobre la sección siguiente. Aquí **`overflow:
hidden` es seguro**: la advertencia que te di sobre `hidden` aplica a los
ancestros de un elemento `position: sticky`, y este envoltorio no contiene
ninguno, solo los lóbulos. Cambia a `hidden` y déjalo documentado en un
comentario para que nadie lo «arregle» de vuelta más adelante.

---

## Lo que no hay que tocar

Cero dependencias · cero peticiones de red · sin canvas, sin WebGL, sin vídeo,
sin ficheros de imagen · solo `transform` y `opacity` animados · `translate3d`
en las transformaciones · sin utilidades de transformación de Tailwind en los
elementos animados · `prefers-reduced-motion` apagando la animación entera ·
grano estático anti-banding · seguro en servidor · `aria-hidden` y
`pointer-events: none` · keyframes con prefijo propio · presupuesto de 6 KB.

Sigue siendo un único fichero con la misma firma:

```tsx
export function FondoHero({ className }: { className?: string }) { … }
```

## Cómo lo voy a comprobar otra vez

Los mismos scripts, sobre la landing real:

1. Peor píxel del fondo dentro de la caja del texto a 390, 768, 1440 y
   1920 px. Umbral: **4,5:1 para `#475569` y 7:1 para `#0B3C5D`**, en los
   cuatro anchos. Ahora fallan los dos primeros.
2. Fondo aislado a 1440 px buscando cantos rectos. Ahora los hay.
3. Diferencia de píxeles entre el segundo 0 y el 12, **por mitades**. Objetivo:
   ≥3 niveles en la mitad del texto. Ahora es 1,18.
4. `prefers-reduced-motion` en `none`. Ya pasa.

Si alguno de los cuatro anchos te obliga a sacrificar el efecto para cumplir
el contraste, dímelo y lo hablamos antes de que lo resuelvas por tu cuenta.

═══════════════════ FIN DE LO QUE SE PEGA ═══════════════════
