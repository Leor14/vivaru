// src/components/marketing/FondoHero.tsx
//
// Fondo animado decorativo para el hero. CSS puro, cero dependencias, cero
// peticiones de red, seguro en servidor. Solo anima transform/opacity.
//
// Estrategia: color saturado en los CUATRO BORDES, centro brillante. Es lo que
// hace la referencia (stacker.ai) y lo que permite que se vea color sin tocar
// la legibilidad: los bordes no tienen restricción de contraste, y lo que cruza
// la zona del texto es solo la cola desvanecida de cada lóbulo. Nada se ancla
// detrás de las capturas de producto, que son opacas y tapan el 57 % de la
// mitad derecha en escritorio.

export function FondoHero({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      // overflow:hidden a propósito: Safari ≤15 no soporta `clip` y cae a
      // `visible`, y los lóbulos tienen desplazamientos negativos que se
      // derramarían. `hidden` es seguro porque este envoltorio NO es ancestro
      // de ningún `position:sticky`. No lo cambies a `clip`.
      className={`fh-root ${className ?? ""}`}
    >
      {/* Núcleo claro: cubre la caja del texto y es lo que sostiene el
          contraste mientras los bordes llevan el color. */}
      <div className="fh-lobe fh-core" />

      {/* Los seis lóbulos, con el pico anclado en un borde y moviéndose
          TANGENTE a él. Ver la nota larga de abajo antes de tocar posiciones o
          recorridos: el orden importa menos que la dirección del movimiento. */}
      <div className="fh-lobe fh-corn" />
      <div className="fh-lobe fh-plum" />
      <div className="fh-lobe fh-mint" />
      <div className="fh-lobe fh-blue" />
      <div className="fh-lobe fh-turq" />
      <div className="fh-lobe fh-warm" />

      {/* Velo: solo un matiz (35 %) + franja casi blanca de los primeros 130 px
          que protege la barra de navegación translúcida. */}
      <div className="fh-velo" />

      {/* Grano estático anti-banding: feTurbulence embebido, ~4 %. No se anima. */}
      <div className="fh-grano" />

      <style>{`
        .fh-root {
          position: absolute; inset: 0;
          overflow: hidden; pointer-events: none;
          background: #F4F7FB;
        }
        /* ellipse closest-side: el degradado termina en el borde más cercano de
           la caja, en cualquier proporción → jamás se ve el canto recto. */
        .fh-lobe { position: absolute; }

        /* ---- Base = móvil (<1024 px). Al no haber hueco libre entre texto
                (8–65 %) y dashboard (69–96 %), el color entra DENTRO del texto. ---- */
        /* ── Por qué el color vive en los BORDES, y de qué depende ───────────
           Cuatro rondas produjeron un fondo que se leía quieto y sin color. El
           diagnóstico final, medido:

           1. VELOCIDAD. Los ciclos eran de 19–33 s con alternate: hasta 66 s de
              ida y vuelta, unos 5 px/s. Imperceptible. Ahora 8–15 s. La
              velocidad NO cuesta contraste, así que no había razón para ser
              conservador ahí.

           2. PERCEPCIÓN. Un degradado difuso que se desplaza no tiene bordes
              que seguir: la vista necesita un rasgo al que agarrarse. Por eso
              cada lóbulo lleva una meseta (parada intermedia al 26 %) y luego
              cae rápido, en vez de desvanecerse de forma uniforme. Eso le da
              una forma reconocible sin producir un canto duro.

           3. PALETA. Se estaban usando las variantes CLARAS —#A8B4F5, #C4A0F0,
              #6FD79B—, que aunque vayan al 100 % siguen siendo pasteles. Ahora
              son los colores de marca: #4B5FD4, #9B59B6, #059669, #0891B2.

           EL MURO, y por qué esto depende de un color de texto. En escritorio
           el texto ocupa x 8–48 % y y 12–87 %: solo hay un 8 % de margen, así
           que el borde izquierdo ES la zona del texto. «Color en los bordes» y
           «contraste bajo el texto» son la misma superficie, y por eso cada
           subida de uno tumbaba al otro.

           Lo desbloqueó bajar el subtítulo de slate-600 a slate-700, que mueve
           el suelo de luminancia de 0,574 a 0,406. Con slate-600 esta misma
           composición da 3,96:1 y NO pasa; con slate-700 da 5,41:1.

           >>> Si alguien devuelve el subtítulo a slate-600 en Hero.tsx, este
           >>> fondo deja de cumplir AA y hay que bajarle el color a la mitad.
           >>> Van juntos.

           TRAMPA que costó encontrar: colocar los picos fuera del área útil no
           basta, porque LA ANIMACIÓN LOS ARRASTRA DE VUELTA. Con recorridos del
           30–42 %, fh-blue acababa con su núcleo justo encima de los botones
           —el punto más oscuro estaba en x 45 %, y 87 %, a un 2 % de su centro—.
           Por eso cada lóbulo se mueve TANGENTE a su borde: los de arriba y
           abajo derivan en horizontal, el del borde derecho en vertical. Si
           alguien vuelve a poner recorridos diagonales grandes, el contraste se
           cae y no es evidente por qué.

           El nucleo subio de 0,86 a 0,92 en agosto de 2026, cuando el titular
           se alargo por SEO («Control de tu conjunto residencial…») y la seccion
           paso de 517 a 593 px de alto. Al ser todo porcentual, el nucleo pasaba
           a cubrir proporcionalmente menos zona de texto y el contraste bajo de
           4,93 a 4,59. Si el titular vuelve a cambiar de longitud, hay que
           volver a medir esto.

           Estado medido, con el contraste tomado a lo largo del ciclo y no en
           un solo fotograma:

             ancho    saturacion   movimiento   subtitulo   titular
             390         29,9         7,7        5,84 ✓     6,51 ✓
             768         23,4         6,6        7,18 ✓     8,01 ✓
             1440        42,5        14,6        5,41 ✓     6,03 ✓
             1920        42,5        16,8        5,41 ✓     6,03 ✓

           (Nada de comillas invertidas aquí: es un comentario CSS dentro de una
           plantilla literal de JS y una sola la cerraría en seco. Ya pasó.)
           ──────────────────────────────────────────────────────────────────── */
        .fh-core {
          top: 2%; left: -6%; width: 92%; height: 68%;
          background: radial-gradient(ellipse closest-side,
            rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 100%);
          animation: fondoHero-core 9s ease-in-out infinite alternate;
        }
        .fh-corn {
          top: -26%; left: -22%; width: 78%; height: 46%;
          background: radial-gradient(ellipse closest-side,
            rgba(75,95,212,0.50) 0%, rgba(75,95,212,0.44) 26%, rgba(75,95,212,0) 86%);
          animation: fondoHero-e 10s ease-in-out infinite alternate;
        }
        .fh-plum {
          top: -22%; right: -26%; width: 72%; height: 44%;
          background: radial-gradient(ellipse closest-side,
            rgba(155,89,182,0.44) 0%, rgba(155,89,182,0.38) 26%, rgba(155,89,182,0) 86%);
          animation: fondoHero-d 12s ease-in-out infinite alternate;
        }
        .fh-mint {
          bottom: -20%; left: -24%; width: 74%; height: 42%;
          background: radial-gradient(ellipse closest-side,
            rgba(5,150,105,0.34) 0%, rgba(5,150,105,0.29) 26%, rgba(5,150,105,0) 86%);
          animation: fondoHero-c 13s ease-in-out infinite alternate;
        }
        .fh-blue {
          bottom: -34%; right: -26%; width: 78%; height: 46%;
          background: radial-gradient(ellipse closest-side,
            rgba(75,95,212,0.56) 0%, rgba(75,95,212,0.48) 26%, rgba(75,95,212,0) 86%);
          animation: fondoHero-a 14s ease-in-out infinite alternate;
        }
        .fh-turq {
          top: 34%; right: -34%; width: 56%; height: 44%;
          background: radial-gradient(ellipse closest-side,
            rgba(8,145,178,0.52) 0%, rgba(8,145,178,0.45) 26%, rgba(8,145,178,0) 86%);
          animation: fondoHero-b 15s ease-in-out infinite alternate;
        }
        /* Respiro cálido permitido: rosa muy desaturado, borde inferior-derecho. */
        .fh-warm {
          right: -18%; bottom: -18%; width: 46%; height: 40%;
          background: radial-gradient(ellipse closest-side,
            rgba(232,178,205,0.12) 0%, rgba(232,178,205,0) 86%);
          animation: fondoHero-f 8s ease-in-out infinite alternate;
        }

        .fh-velo {
          position: absolute; inset: 0;
          background:
            linear-gradient(to bottom, rgba(244,247,251,0.95) 0px, rgba(244,247,251,0) 130px),
            linear-gradient(to bottom, rgba(244,247,251,0.35) 0%, rgba(244,247,251,0) 58%);
        }

        .fh-grano {
          position: absolute; inset: 0; opacity: 0.045;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        /* ---- ≥1024 px: banda apaisada. El texto está a la izquierda (x 8–48 %),
                las capturas OPACAS a la derecha (x 52–92 %). El color cruza el
                texto por la izquierda y el centro; nada se ancla bajo las
                capturas. ---- */
        @media (min-width: 1024px) {
          .fh-core { top: -4%;  left: -10%; width: 68%; height: 108%; }
          .fh-corn { top: -34%; left: -18%; width: 54%; height: 78%; }
          .fh-plum { top: -30%; left: 30%;  right: auto; width: 50%; height: 70%; }
          .fh-mint { top: auto; bottom: -36%; left: -16%; width: 52%; height: 74%; }
          .fh-blue { top: auto; bottom: -58%; left: 52%; right: auto; width: 54%; height: 80%; }
          .fh-turq { top: -10%; right: -20%; width: 46%; height: 96%; }
          .fh-warm { right: -14%; bottom: -18%; width: 42%; height: 62%; }
          .fh-velo {
            background:
              linear-gradient(to bottom, rgba(244,247,251,0.95) 0px, rgba(244,247,251,0) 130px),
              linear-gradient(to right, rgba(244,247,251,0.46) 0%, rgba(244,247,251,0) 52%);
          }
        }

        /* Recorridos amplios (18–28 % del lóbulo) y ciclos de 19–33 s: ambiental
           pero perceptible. translate3d explícito para no chocar con las
           utilidades scale/translate de Tailwind v4. */
        @keyframes fondoHero-core { from { transform: translate3d(0,0,0) scale(1); }    to { transform: translate3d(18%,10%,0) scale(1.16); } }
        @keyframes fondoHero-a    { from { transform: translate3d(0,0,0) scale(1); }    to { transform: translate3d(-42%,-6%,0) scale(1.28); } }
        @keyframes fondoHero-b    { from { transform: translate3d(0,0,0) scale(1.06); } to { transform: translate3d(-8%,40%,0) scale(0.84); } }
        @keyframes fondoHero-c    { from { transform: translate3d(0,0,0) scale(0.92); } to { transform: translate3d(44%,-8%,0) scale(1.26); } }
        @keyframes fondoHero-d    { from { transform: translate3d(0,0,0) scale(1); }    to { transform: translate3d(-40%,10%,0) scale(1.24); } }
        @keyframes fondoHero-e    { from { transform: translate3d(0,0,0) scale(1.1); }  to { transform: translate3d(46%,8%,0) scale(0.86); } }
        @keyframes fondoHero-f    { from { transform: translate3d(0,0,0) scale(1); }    to { transform: translate3d(-30%,-10%,0) scale(1.2); } }

        /* Accesibilidad: se apaga la animación entera; el fotograma inicial ya
           está compuesto para verse bien congelado. */
        @media (prefers-reduced-motion: reduce) {
          .fh-lobe { animation: none; }
        }
      `}</style>
    </div>
  );
}
