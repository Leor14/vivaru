# Plan de animaciones del landing

Referencia auditada: **cohere.com**, medida en el navegador el 7 de agosto de 2026.
Destino: primero staging (`develop`), como todo el rediseño.

---

## 1 · Qué hace Cohere, medido y no intuido

**Cero librerías de animación.** Ni GSAP, ni Lenis, ni Framer Motion, ni Lottie.
Todo es CSS: `@keyframes` y `transition`. Eso ya es una decisión, no un detalle.

El vocabulario completo son **cuatro entradas y tres bucles**:

| Keyframe | Qué hace |
|---|---|
| `fadeInUp` | `opacity 0→1` + `translateY(25%) → 0` |
| `fadeInDown` | `opacity 0→1` + `translateY(-5%) → 0` |
| `fadeInSpot` | solo `opacity` |
| `arrowWiggle` | `translateX(0 → 5px → 0)` |
| `marquee` | `translateX(0 → -50%)`, infinito |
| `scroll2` | `translateX(50% → -50%)`, infinito |
| `bounceLogo`, `dance`, `rain`, `cuts` | decorativos de secciones concretas |

El reparto de transiciones dice más que la lista:

| Transición | Elementos |
|---|---|
| `opacity 0.5s` | **254** |
| `opacity 0.3s` | 78 |
| `transform 0.15s` | 31 |
| `color 0.15s` | 15 |

**La lectura: el 90 % del movimiento del sitio es opacidad a 500 ms.** El
`transform` se reserva para micro-interacciones a 150 ms — pulsar, señalar,
subrayar. No hay una sola animación de layout.

Dos detalles que sí merece copiar:

1. **`translateY(25%)`, no `translateY(16px)`.** El porcentaje es de la altura
   del propio elemento, así que una tarjeta alta recorre más y una etiqueta
   pequeña menos. Con un valor fijo, en una tarjeta de 400 px el movimiento es
   imperceptible y en una línea de texto es un salto.
2. **La pastilla de hover.** Las tarjetas no cambian de color al pasar por
   encima: aparece **detrás** un rectángulo redondeado más grande que la tarjeta
   —`-left-2 -top-4`, `width: calc(100% + 16px)`— con `opacity 0 → 1`. Da
   sensación de relieve sin mover nada y sin sombras.

---

## 2 · Qué tiene ya el landing de Vivaru

El landing **no está sin animar**. Ya hay un sistema:

- **Revelado al entrar en pantalla en 11 secciones** (`useInView` +
  `translate-y-4 opacity-0` → `translate-y-0 opacity-100`, 280 ms).
- **Framer Motion solo en `Perspectives`**: crossfade del panel con desenfoque y
  la pastilla de pestaña con `layoutId`.
- **`drift-mesh`** en el cierre, dos radiales que derivan lentos.
- **Tecleo** en `ProductGlimpse`, que escribe y borra tres acciones.
- **Vídeo en bucle** en «Cada conjunto, su propio sistema».
- Keyframes propios ya declarados: `float`, `mark-in`, `step-in`, `veil-in`,
  `ring-spin`, `billing`, `service`, `nav-icon-select`, `accordion-*`.
- **12 de 16 componentes respetan `prefers-reduced-motion`.**

### Los tres huecos reales

1. **El desplazamiento del revelado es fijo: `translate-y-4` (16 px).** En las
   tarjetas altas de `TrustOnboarding` o en el composite de `Perspectives` no se
   percibe; en textos cortos se nota demasiado. Es el mismo defecto que Cohere
   evita con porcentajes.
2. **El escalonado existe en siete secciones, pero en tres no escalonaba nada.**
   Corrección de una afirmación anterior: sí había retrasos por índice. Lo que
   no había era efecto. `Solution`, `CasosDeUso` y `TrustOnboarding` usaban

       transitionDelay: reduced || inView ? "0ms" : `${delayMs}ms`

   que pone el retraso a cero en el mismo commit en que el elemento entra en
   vista; una transición usa los parámetros vigentes DESPUÉS del cambio, así que
   el retraso efectivo era 0. Medido: `["0s","0s","0s","0s"]` y las cuatro
   tarjetas subiendo a la vez.

   **No era un descuido.** El autor lo documentó: con 240 ms de retraso, el
   `hover:-translate-y-1` de la misma tarjeta llegaba tarde. Eligió el hover
   sobre el escalonado, porque ambos compartían un único `transition-delay`.
   La salida es separar las capas, no elegir.
3. **No hay micro-interacción de `transform` en ninguna parte.** Los botones no
   responden al pulsarlos, las flechas no se mueven, las tarjetas no acusan el
   hover. Todo el movimiento es de entrada, ninguno de respuesta.

---

## 3 · El listado, por orden de valor sobre riesgo

Cada incremento es independiente y desplegable por separado.

### A · Escalonado y desplazamiento proporcional  ·  **hecho**

`src/lib/marketing/revelado.ts` concentra el gesto: 420 ms, `ease-out-brand`,
retraso `index * 60 ms` con techo de 240 ms, y desplazamiento
`translateY(min(22%, 28px))` — proporcional a la altura del propio elemento y
acotado, que es la corrección que le faltaba al `translateY(25%)` de la
referencia.

En `Solution` y `CasosDeUso` el revelado pasa al `<li>` y el hover se queda en
un `<article>` interno. Cada gesto con su propio retraso; ya no compiten.

Medido después, en las cuatro secciones:

    delays        0s · 0,06s · 0,12s · 0,18s
    opacidad t0   0,78  0,44  0,00  0,00
    hover         delay 0s / duración 0,15s

### B · Respuesta al pulsar  ·  **hecho**

Corrección de lo que decía este plan: **los CTA ya respondían.** El botón
compartido de marketing lleva `active:scale-[0.97]` con 160 ms y
`ease-out-brand` desde antes. Afirmar que «ningún botón del landing responde»
fue dar por hecho sin mirar.

Los que de verdad no respondían eran dos, y ninguno usa ese botón compartido:

| Elemento | Transicionaba | Ahora |
|---|---|---|
| Pestañas de `Perspectives` | solo colores | `scale-[0.97]`, 150 ms |
| Pregunta del `FAQ` | fondo, borde, sombra | `scale-[0.99]`, 150 ms |

El 0,99 del FAQ no es un descuido: una fila a todo el ancho encogiéndose un 3 %
se lee como un salto, no como una respuesta. Cuanto mayor es la superficie,
menor tiene que ser la escala.

Los dos llevan `motion-reduce:active:scale-100`: con movimiento reducido no
basta con quitar la transición, porque el salto de escala seguiría ocurriendo.

Medido con el ratón mantenido pulsado:

    pestaña Residente   reposo none · pulsado 0.97 · vuelve none
    pregunta del FAQ    reposo none · pulsado 0.99 · vuelve none
    CTA del topbar      reposo none · pulsado 0.97 · vuelve none

**Cómo se mide, que tiene truco:** hay que leer la propiedad `scale`, no
`transform`. Las utilidades `scale-*` de Tailwind v4 escriben la propiedad
independiente, así que mirar `transform` devuelve `none` aunque el efecto esté
funcionando perfectamente.

Lo que quedó fuera: el pulsable de `Differentiators` es una capa invisible que
cubre la tarjeta entera, y escalar algo invisible no se ve. Necesitaría llevar
el gesto a la tarjeta con `has-[button:active]`, y no está claro que una foto
grande deba encogerse al tocarla.

### C · La pastilla de hover de las tarjetas  ·  **hecho, pero en una sección, no en tres**

El plan decía `TrustOnboarding`, `CasosDeUso` y `Differentiators`. Al mirar qué
hace hoy cada tarjeta, solo una lo necesitaba:

| Sección | Hover actual | Decisión |
|---|---|---|
| `TrustOnboarding` | **ninguno** | pastilla ✅ |
| `CasosDeUso` | se eleva y gana sombra | ya responde; sumarle una pastilla sería decir lo mismo dos veces |
| `Solution` | se eleva y gana sombra | igual |
| `Differentiators` | velo de opacidad | son fotos a sangre: un rectángulo detrás no se vería |

`TrustOnboarding` es además el caso exacto de la referencia: tarjetas sin borde
ni fondo, con miniatura arriba y texto debajo. Un `<span>` detrás,
`-inset-x-2 -inset-y-3`, `bg-slate-100`, `opacity 0 → 1` en 200 ms, y solo con
puntero fino — en táctil el hover se queda pegado tras el toque.

Medido:

    en reposo                    [0, 0, 0, 0]
    con el puntero encima        [1, 0, 0, 0]
    separación entre pastillas   8 px  (no se tocan)
    la tarjeta se mueve          no — transform identidad, sin escala

Ese último dato es el punto del patrón: **relieve sin mover nada.**

### D · La flecha que empuja  ·  **hecho**

Siete flechas repetidas como `<span aria-hidden className="ml-0.5">→</span>` en
cinco archivos —y en el hero ni eso: iba suelta dentro del texto, donde no se
puede animar sin envolverla—. Ahora es un componente,
`marketing/ui/flecha.tsx`: 4 px, 150 ms, `ease-out-brand`.

**Lleva dos variantes de grupo a propósito.** El botón compartido se marca como
`group/button`, que en Tailwind NO coincide con el selector de `group-hover:`
—ese busca la clase `group` a secas—. Los enlaces que no usan ese botón, como el
de `ImpactBand`, llevan `group` normal. Declarar las dos hace que la flecha
funcione en ambos contextos sin que quien la use tenga que saberlo.

Medido en los cuatro sitios: `reposo none · encima 4px · vuelve none`.

**La trampa, por segunda vez:** en Tailwind v4 `translate-x-*` escribe la
propiedad **`translate`**, no `transform` — igual que `scale-*` escribe `scale`.
La primera medición dio «no empuja» en los cuatro porque estaba leyendo
`transform`, que valía `none` con el efecto funcionando perfectamente.

Y un artefacto de método que conviene recordar: hay que **apartar el puntero
antes de leer el reposo**. Tras desplazar la página, el ratón puede quedar
justo encima del elemento y el «reposo» sale ya empujado.

### E · Marquesina de módulos  ·  **hecho**

`MarquesinaModulos.tsx`, debajo de `Solution`: los cuatro pilares explican las
áreas y la cinta enseña los dieciséis módulos que hay dentro. Al revés serían
dieciséis nombres sin marco.

**El contenido no es equivalente al de la referencia y conviene decirlo:** un
logo se reconoce de un vistazo, un nombre hay que leerlo. Una marquesina de
texto solo se sostiene si el mensaje es *amplitud* — y una lista estática de
dieciséis sería un muro que nadie lee.

Tres condiciones, sin las cuales la cinta es una molestia:

1. **Se detiene al pasar el puntero.** Algo que se mueve mientras intentas
   leerlo es justo lo que hace desviar la vista.
2. **Con `prefers-reduced-motion` no hay cinta**, sino una rejilla que envuelve.
   No basta con pausar la animación: una cinta detenida a mitad de recorrido
   deja nombres cortados contra el borde.
3. **Los bordes se difuminan** con `mask-image`, que es composición y no pasa
   por layout. Sin la máscara los nombres aparecen de golpe y se lee como fallo.

El bucle no tiene costura porque el contenido va **duplicado**: al recorrer el
−50 % la segunda copia queda exactamente donde empezó la primera. La copia va
`aria-hidden`, o el lector de pantalla leería los dieciséis módulos dos veces.

Medido:

    por defecto              se mueve · para al hover (paused) · no desborda
    movimiento reducido      sin cinta · rejilla estática de 16 módulos

### F · Contadores  ·  **descartado — no hay cifras que contar**

Este incremento se propuso desde un recuerdo desactualizado de la sección.
`ImpactBand` **ya no tiene cifras**: la banda de porcentajes se retiró durante el
rediseño y el propio componente explica por qué — no tenían fuente, y «una cifra
que no se puede defender resta más credibilidad de la que suma».

Revisado el landing entero, **no queda ninguna cifra mostrada como dato**. Todos
los números viven dentro de una frase («Lanzas la cuota del mes a las 120
unidades…»), y animar un número dentro de un párrafo recompone el texto: se lee
como un fallo, no como un efecto.

Inventarle un sitio a un contador habría sido añadir movimiento porque tocaba.

**En su lugar se terminó lo que faltaba de A.** Quedaban cinco secciones con su
propio revelado, que era precisamente lo que A venía a resolver:

| Sección | Tenía | Ahora |
|---|---|---|
| `Pain` | 400 ms, y revelaba **creciendo** desde `scale-[0.95]` | helper |
| `ImpactBand` | 250 ms, solo opacidad | helper |
| `Differentiators` | 250 ms, solo opacidad | helper |
| `MultiConjunto` | 400 ms, `translate-y-4`, sin escalonado | helper |

`Pain` era el caso más llamativo: **era el único gesto de entrada distinto de
toda la página** — las demás suben y esa crecía.

`FinalCTA`, `ProductGlimpse` y `Pricing` se dejan como están: usan `useInView`
para disparar analítica o activar el tecleo, no para revelar.

Medido en las siete secciones que revelan:

    todas          dur 0.42s · delays 0s · 0,06s · 0,12s · 0,18s

Antes: cuatro duraciones distintas, tres desplazamientos y dos gestos.

---

## 4 · Reglas que no se rompen

1. **Solo `opacity` y `transform`.** Nada de animar `height`, `width`, `margin`
   o `padding`: pasan por layout y pintado en cada fotograma.
2. **Entradas con `ease-out`, nunca `ease-in`.** `ease-in` retrasa el
   movimiento justo en el instante que el ojo mira, y se percibe más lento
   aunque dure igual.
3. **Por debajo de 300 ms** todo lo que sea respuesta a una acción. Los
   revelados pueden llegar a 500 ms porque nadie los espera.
4. **`prefers-reduced-motion` en cada incremento**, no al final. Ya lo respetan
   12 componentes; los nuevos no pueden ser la excepción.
5. **Nada de `scale(0)`.** Nada en el mundo real aparece de la nada; se entra
   desde `0.95` como mínimo.
6. **Nada que se mueva solo y en bucle por encima del pliegue.** El `drift-mesh`
   del cierre está bien porque está al final; una marquesina en el hero compite
   con el titular.

---

## 5 · Cómo se verifica

El contraste del rediseño se midió, no se miró. Aquí igual:

- **Fotogramas por segundo durante el desplazamiento**, con la traza de
  rendimiento de Chrome. Cualquier animación que baje de 55 fps se revierte.
- **Comprobación de `prefers-reduced-motion`** con el emulador de Playwright:
  ninguna animación debe seguir corriendo.
- **Prueba de contrato**: que ningún componente de marketing anime una
  propiedad de layout. Es una regla que se rompe sin querer y no falla el
  typecheck.

---

## 6 · Estado

| Inc | Qué | Estado |
|---|---|---|
| A | Escalonado y desplazamiento proporcional | **hecho** |
| B | Respuesta al pulsar | **hecho** |
| C | Pastilla de hover | **hecho** (solo TrustOnboarding) |
| D | Flecha que empuja | **hecho** |
| E | Marquesina de módulos | **hecho** |
| F | Contadores | **descartado** — no hay cifras; se cerró A en su lugar |
