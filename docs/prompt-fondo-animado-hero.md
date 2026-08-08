# Prompt para generar el fondo animado del hero

Contexto para David, no forma parte del prompt: lo de abajo (a partir de
«═══») es lo que hay que pegar tal cual. Esta cabecera explica por qué está
escrito así.

## Por qué este encargo y no otro

La referencia es el bloque «Start free» de stacker.ai. Inspeccionado en vivo:
**no es un vídeo**. Es un `<canvas>` WebGL de Unicorn Studio
(`aria-label="Unicorn Studio Scene"`), runtime de 40 KB desde jsDelivr,
renderizado a 1,5× píxeles CSS en vez de 2×.

Aquí se pide **CSS puro, cero JavaScript**, y no un canvas ni un vídeo. Las
razones son concretas, no de gusto:

- **App Hosting sirve el byte que está en disco.** El adaptador fuerza
  `unoptimized: true` y apaga el optimizador de imágenes de Next (documentado
  en `next.config.ts`). Un vídeo o un WebP grande de fondo se descargarían
  enteros, sin reescalar ni recomprimir.
- Un vídeo en bucle a 1440×520 pesa megas y se decodifica en el hilo
  principal. En un Android de gama media eso son fotogramas perdidos justo en
  lo primero que ve el visitante.
- Un canvas WebGL añade un contexto gráfico, un bucle `requestAnimationFrame`
  y un camino de reserva para quien no tenga WebGL. Es la opción de más
  fidelidad, pero también la única que puede fallar al abrir el sitio, que es
  precisamente lo que hay que evitar.
- Seis degradados radiales que solo mueven `transform` viven en el
  compositor, no repintan nada, pesan ~2 KB, funcionan renderizados en
  servidor y no pueden romper la carga. A esta escala y a esta velocidad se
  leen igual que el shader.

Si más adelante se quiere la cualidad orgánica del shader, se sube desde
aquí. Al revés no: empezar por WebGL y descubrir que jankea obliga a
rehacerlo entero.

## Qué hay que devolver

Un solo fichero. Se monta en `src/components/marketing/` y se inserta como
primer hijo de la `<section id="hero">` de `src/components/marketing/Hero.tsx`.

---

═══════════════════ PEGAR A PARTIR DE AQUÍ ═══════════════════

Necesito un fondo animado decorativo para el hero de una landing. Devuélveme
**un único componente React en TypeScript, autocontenido, sin ninguna
dependencia**.

## Qué es

Una malla de color que deriva muy despacio: cinco o seis lóbulos grandes y
muy difusos, cada uno de un color, moviéndose de forma independiente y
continua sobre un fondo casi blanco. Sin bordes duros en ninguna parte, sin
formas reconocibles, sin nada que parpadee o pulse. La referencia de
comportamiento es el fondo del bloque «Start free» de stacker.ai: el ojo
tarda unos segundos en notar que se mueve, y nunca ve el bucle repetirse.

Es decoración de fondo. El protagonista es el contenido que va encima.

## Paleta — obligatoria, son los tokens de marca

```
#4B5FD4  azul de marca (es también el color del botón principal)
#A8B4F5  azul aciano claro
#C4A0F0  ciruela claro
#0891B2  turquesa
#6FD79B  menta
#F4F7FB  fondo de la página — es la base sobre la que todo flota
```

Es una paleta **fría a propósito**. No introduzcas naranjas, corales ni
ámbares: en este producto el ámbar y el rojo son colores semánticos de aviso
y de error, y usarlos como decoración hace que el hero se lea como una
alerta. Si crees que la composición pide un respiro cálido, el único permitido
es un rosa muy desaturado a un 6 % de opacidad como mucho, y solo en el borde
inferior derecho.

No uses `#0B3C5D`: es el color del titular que va encima.

## Composición — esta es la parte que no se puede improvisar

El fondo tiene que dejar legible el contenido, y el contenido cambia de sitio
según el ancho:

- **Escritorio (≥1024 px):** el titular y los botones ocupan la mitad
  izquierda; a la derecha van unas capturas de producto sobre fondo blanco.
- **Móvil:** se apila. El texto arriba, las capturas abajo.

Lo común a los dos casos es que **el texto siempre está arriba**. Así que la
regla de composición es una sola:

> El fondo es más claro y más desaturado arriba y a la izquierda, y el color
> gana intensidad hacia el borde derecho y hacia abajo.

Concretamente:

1. **Los primeros 90 px de alto tienen que quedar casi blancos.** Por encima
   del hero flota una barra de navegación translúcida (`bg-white/75` con
   desenfoque de fondo) con texto oscuro. Si ahí debajo cae un lóbulo
   saturado, la barra pierde legibilidad.
2. **En la zona del texto, el fondo nunca puede bajar de `#C8CEDC` en
   luminosidad.** El subtítulo va en `#475569` a 18 px y necesita un
   contraste de 4,5:1; el titular va en `#0B3C5D` y necesita 7:1. Voy a
   comprobarlo muestreando píxeles, no a ojo.
3. **A la derecha y abajo el color puede subir sin miedo.** Ahí van capturas
   blancas con borde claro, y que floten sobre color es justo lo que las
   separa del fondo.
4. Que el conjunto se lea como **una sola atmósfera**, no como seis manchas
   identificables. Los lóbulos se solapan y se mezclan.

## Movimiento

- Cada lóbulo con su propio ciclo, de **28 a 52 segundos**, y con duraciones
  que no sean múltiplos entre sí, para que el conjunto no repita de forma
  perceptible.
- Recorridos amplios y suaves: cada lóbulo se desplaza el equivalente a un
  10–20 % del ancho, con `ease-in-out`, ida y vuelta.
- Escalado leve (0,9–1,15) si aporta, pero **nada de pulsos rítmicos**: si se
  nota el latido, está mal.
- Nada de rotación, nada de cambios de color, nada de opacidad parpadeante.

## Restricciones técnicas — el encargo se cae si no se cumplen

1. **Cero dependencias.** Nada de three.js, framer-motion, react-spring, ni
   ninguna URL externa. Sin `<canvas>`, sin WebGL, sin vídeo, sin ningún
   fichero de imagen. Todo dentro del componente.
2. **Solo se animan `transform` y `opacity`.** Nunca `filter`, ni
   `background-position`, ni las paradas del degradado, ni `width`/`height`.
   Cualquiera de esas repinta en cada fotograma.
3. **En `transform` usa `translate3d()`.** El proyecto es Tailwind v4, donde
   la utilidad `scale-*` escribe la propiedad autónoma `scale` y `translate-x-*`
   escribe `translate`, **no** `transform`. Si mezclas utilidades de
   transformación con keyframes que animan `transform`, se componen y el
   resultado no es el que esperas. No pongas utilidades de transformación de
   Tailwind en los elementos animados.
4. **Recorte con `overflow: clip`, jamás `overflow: hidden`.** `hidden` crea
   un contenedor de desplazamiento y rompe el `position: sticky` de la barra
   de navegación que flota sobre esta sección. Este proyecto ya se ha
   tropezado dos veces con eso.
5. **El recorte va en el envoltorio del propio fondo, no en la sección.** Una
   de las capturas del hero cuelga por debajo del borde inferior de la
   sección a propósito; si el recorte sube a la `<section>`, la decapita.
6. **`prefers-reduced-motion: reduce` apaga la animación entera**
   (`animation: none`), no la ralentiza. El fotograma en el que se queda
   congelado tiene que estar compuesto para verse bien por sí solo: es lo que
   verá esa gente siempre.
7. **Sin banding.** Un degradado tan difuso a 8 bits produce escalones
   visibles. Añade una capa de grano estática —`feTurbulence` de SVG metido
   como `data:` URI en un `background-image`, por debajo de 1,5 KB— a un 3–6 %
   de opacidad. Estática: no se anima.
8. **Seguro en servidor.** Sin `window` ni `document` en el cuerpo del módulo,
   sin `Math.random()` ni `Date.now()` durante el renderizado. Nada que
   produzca una discrepancia de hidratación.
9. **`aria-hidden="true"` y `pointer-events: none`.** Es decoración: no puede
   capturar clics ni aparecer en el lector de pantalla.
10. **`will-change: transform`** en las capas animadas, y en ninguna más.
11. **Presupuesto: 6 KB de código fuente y cero peticiones de red.**

## Forma de entrega

```tsx
// src/components/marketing/FondoHero.tsx
export function FondoHero({ className }: { className?: string }) { … }
```

- Que acepte `className` y lo componga al final, para poder posicionarlo desde
  fuera sin pelearme con la especificidad.
- Que por dentro sea `absolute inset-0` y no imponga `z-index`: se lo pongo yo
  al montarlo.
- Los `@keyframes` y el grano, dentro del componente en una etiqueta `<style>`.
  No los pongas en un fichero de CSS global: quiero poder borrar el componente
  de un solo golpe.
- Nombra los `@keyframes` con un prefijo propio (`fondoHero-…`) para que no
  choquen con los que ya existen.
- Comentarios en español.

## Cómo lo voy a evaluar

- Muestreo el color del fondo en la zona del texto a 390, 768, 1440 y 1920 px
  y compruebo los contrastes de 4,5:1 y 7:1.
- Compruebo que los primeros 90 px de alto siguen casi blancos.
- Capturo la sección con 10 segundos de diferencia y verifico que hay
  movimiento perceptible.
- Miro el perfil de rendimiento: si aparecen repintados por fotograma, se
  rechaza.
- Fuerzo `prefers-reduced-motion` y compruebo que la animación queda en
  `none`.

Si algo de la composición te parece que choca con el contraste exigido,
dímelo y propón la alternativa antes de resolverlo por tu cuenta.

═══════════════════ FIN DE LO QUE SE PEGA ═══════════════════

## Lo que haré yo al recibirlo

1. Colocarlo como primer hijo de `<section id="hero">`, con el envoltorio
   propio de recorte y `z-0`, y subir el contenido del hero a `relative z-10`.
2. Decidir si va a sangre completa o dentro del `container`. Recomiendo a
   sangre: el hero es lo primero bajo una barra de navegación translúcida que
   flota, y el cristal solo tiene sentido si por debajo pasa color.
3. Medir los contrastes y las capturas separadas en el tiempo antes de
   commitear, y publicar en `develop` primero.
