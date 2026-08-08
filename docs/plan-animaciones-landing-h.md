# Plan · bloque H — cuatro ajustes pedidos

Continúa `docs/plan-animaciones-landing.md`. Todo va primero a `develop`
(staging) y se verifica **allí**, no en local.

---

## H1 · Retirar la barra de progreso

**Lo pedido:** «la animación de la barra estaba bien antes que pudiera recorrer
todo el sitio. devuélvela a como estaba».

**Lectura:** la barra de progreso del bloque G3 —la que recorre el ancho
completo conforme bajas— sobra. Se retira y el header vuelve a como estaba.

> ⚠️ **Si me equivoqué en la lectura, corrígeme en una palabra.** La otra
> interpretación posible es que la barra te gusta pero no que abarque el sitio
> entero, y entonces el arreglo sería acotarla por sección en vez de quitarla.
> Voy con la primera porque «devuélvela a como estaba» apunta a retirar.

**Alcance:** quitar el `<div>` del `Topbar`, el keyframe `progreso-lectura` y su
bloque `@supports`. Nada más del bloque G se toca.

---

## H2 · La cinta de módulos, con diseño de verdad

**Lo pedido:** «hagamos un diseño mucho más atractivo y dinámico».

**El problema:** hoy son dieciséis nombres en texto plano separados por puntos.
Funciona como mecanismo y no dice nada como diseño. Ya avisé de que una
marquesina de texto es débil frente a una de logos; el arreglo es **dejar de
tratarla como texto**.

**Propuesta:** cada módulo pasa a ser una **pastilla con su icono** — los mismos
iconos que usa el menú del producto (`admin-sidebar.tsx` ya los importa de
`lucide-react`, así que no hay que inventar nada ni añadir peso).

- Píldora con borde suave, icono a la izquierda, nombre a la derecha.
- **Dos cintas superpuestas en direcciones opuestas**, la segunda más lenta y
  con menos opacidad. Es lo que convierte una cinta plana en una escena con
  profundidad.
- El módulo bajo el puntero se levanta y toma color de marca; la cinta se
  detiene, como ahora.
- Se mantiene lo que ya funciona: máscara en los bordes, contenido duplicado
  para que el bucle no tenga costura, y rejilla estática con
  `prefers-reduced-motion`.

**Riesgo:** dieciséis pastillas con icono pesan más visualmente que dieciséis
palabras. Si compite con las secciones vecinas, se baja a una sola cinta.

---

## H3 · Las pestañas de «Una plataforma, cuatro experiencias»

**Lo pedido:** «parece un pantallazo cada que te mueves entre pestañas».

**La causa, encontrada en el código:** `AnimatePresence mode="wait"`.

Ese modo espera a que el panel saliente termine su animación **antes** de montar
el entrante. Con 0,2 s de salida más 0,2 s de entrada son 0,4 s en los que, a
mitad, **no hay nada en pantalla**. Ese hueco vacío es literalmente el
pantallazo que describes. No es que la transición sea fea: es que hay un
parpadeo en blanco en medio.

**Propuesta:**

1. **Fundido cruzado en vez de espera.** Los dos paneles conviven durante la
   transición, así que nunca hay vacío. Con `position: absolute` sobre el
   saliente para que no empuje el layout.
2. **El contenido entra escalonado, no en bloque.** Hoy el panel entero es una
   losa que aparece de golpe. Ambiente, cita, titular y los tres pasos entran
   con 40 ms de diferencia — el mismo escalonado que ya usa el resto de la
   página, así que no es un gesto nuevo.
3. **Desenfoque para tapar la costura.** La skill lo dice explícito: cuando un
   fundido entre dos estados «no acaba de quedar bien», un `blur(2px)` durante
   la transición funde los dos en vez de dejar ver dos objetos superpuestos. Ya
   hay un blur; lo que falta es que los dos paneles coexistan para que sirva
   de algo.
4. **La imagen del producto se desvela**, no aparece: el mismo `clip-path` del
   bloque G2, que es un gesto que ya vive en la página.

**Lo que NO se toca:** la pastilla de la pestaña activa, que usa `layoutId` y
se desliza correctamente. Eso ya está bien.

---

## H4 · «Empieza sin fricción» con la anatomía de «The latest news»

**Lo pedido:** que se parezca a las tarjetas de Cohere, **con las cuatro**, no
una barra de tres.

**La anatomía real, leída del sitio** (no de memoria):

```
<a class="group/calloutCard relative flex h-full flex-col overflow-hidden rounded-lg">
  <div class="flex flex-1 flex-col justify-between rounded-t-lg p-4">
    <div class="relative mb-5 overflow-hidden rounded-[6px] aspect-video"> ← imagen
    <p class="uppercase font-eyebrow mb-5 animate-[fadeInUp_0.8s_forwards]"> ← ambiente
    <h3 class="mb-2 animate-[fadeInUp_0.8s_forwards]">                       ← titular
  <svg viewBox="0 0 670 111">  ← LA MUESCA
  <div class="absolute bottom-3 flex w-full justify-between px-4">
    <p>Read more</p>  <i class="icon-arrow-right opacity-0 group-hover:...">
```

Tres cosas que no se adivinan mirando la captura:

1. **La muesca NO es `clip-path` ni máscara: es un `<svg>` con un `<path>`**
   pintado del color de la tarjeta. Recorta la esquina inferior derecha en
   diagonal, y ahí es donde se aloja la flecha. El camino exacto está medido:

   ```
   viewBox="0 0 670 111"
   d="M670 0H0V91C0 102.046 8.9543 111 20 111H518.641C526.216 111 533.14
      106.721 536.529 99.9469L570.988 31.0531C574.377 24.2789 581.301 20
      588.875 20H650C661.046 20 670 11.0457 670 0Z"
   ```

2. **Cada elemento de la tarjeta entra por separado** con
   `animate-[fadeInUp_0.8s_forwards]`, todos bajo `motion-safe:`. No es la
   tarjeta la que entra: son la imagen, el ambiente y el titular, uno tras otro.

3. **La flecha vive en `opacity: 0` y aparece al pasar el puntero**, dentro de
   la muesca. Es lo que le da el aire de «esto se abre».

**Propuesta para Vivaru:**

- Las **cuatro** tarjetas de la sección adoptan esa anatomía: imagen 16:9
  arriba, ambiente en mayúsculas, titular, cuerpo, y pie con la muesca.
- La muesca se dibuja con el mismo `<path>`, coloreada con el fondo de la
  tarjeta.
- **Ojo, una diferencia real que hay que decidir:** las de Cohere son artículos
  y su pie lleva «Read more →» a un enlace. **Tres de nuestras cuatro tarjetas
  no llevan a ninguna parte** — ya lo decidimos así en el rediseño y está
  documentado en el componente. Con la muesca vacía se ve rara.

  Dos salidas: **(a)** dar destino a las cuatro —migración, seguridad,
  respaldos y soporte tienen sección o página donde llevar— o **(b)** poner en
  el pie un dato en vez de un enlace («Día 1», «Enlace de un solo uso», «Cada
  24 h», «Español»), y sin flecha. Recomiendo (b): no inventa navegación que no
  existe y llena la muesca con algo que sí aporta.

- La rejilla se mantiene en cuatro columnas en `lg`; en móvil, dos.

---

## Orden y verificación

1. **H1** (retirar la barra) — un minuto, sin riesgo.
2. **H3** (pestañas) — es el que más molesta hoy y la causa está localizada.
3. **H4** (tarjetas) — el de más trabajo; necesita tu decisión sobre el pie.
4. **H2** (cinta) — el más de gusto, y el que conviene ver al final junto al
   resto.

Cada uno se comprueba **en staging** midiendo, no mirando: que no haya hueco
vacío entre paneles, que la muesca no rompa el layout a ningún ancho, y que
`prefers-reduced-motion` siga apagando todo.
