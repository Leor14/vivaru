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

### B · Respuesta al pulsar  ·  *el más barato*

`transform: scale(0.97)` en `:active` sobre botones y tarjetas pulsables, 150 ms
`ease-out`. Es la diferencia entre una interfaz que escucha y una que no.

Aplica a: los tres CTA del `Topbar`, el CTA del `Hero`, las pestañas de
`Perspectives`, las preguntas del `FAQ`.

### C · La pastilla de hover de las tarjetas

El patrón de Cohere en `TrustOnboarding`, `CasosDeUso` y `Differentiators`: un
rectángulo redondeado detrás, un poco mayor que la tarjeta, que aparece con
`opacity` en 200 ms. **Sin mover la tarjeta y sin sombra nueva.**

### D · La flecha que empuja

`translateX` de 4 px en las flechas de los CTA al pasar por encima, 150 ms. Ya
hay flechas en «Prueba gratis 15 días» y en el cierre.

### E · Marquesina de módulos

Una cinta infinita —`translateX(0 → -50%)` con el contenido duplicado— con los
nombres de los módulos. Es lo que Cohere usa para logos de clientes; Vivaru
todavía no tiene logos que enseñar, pero sí módulos.

**Ojo:** una marquesina que no se detiene al pasar por encima es una molestia.
Debe parar en `:hover` y en `prefers-reduced-motion`.

### F · Contadores del `ImpactBand`

Que las cifras suban desde 0 al entrar en pantalla, 600 ms, `ease-out`. Se
anima con `requestAnimationFrame` sobre el texto, no con transición CSS.

**Con `prefers-reduced-motion` la cifra final aparece directamente**, nunca en 0.

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
| B | Respuesta al pulsar | pendiente |
| C | Pastilla de hover | pendiente |
| D | Flecha que empuja | pendiente |
| E | Marquesina de módulos | pendiente |
| F | Contadores | pendiente |
