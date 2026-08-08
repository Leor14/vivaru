// src/components/marketing/FondoHero.tsx
//
// Fondo animado decorativo para el hero. CSS puro, cero dependencias, cero
// peticiones de red, seguro en servidor. Solo anima transform/opacity.
//
// Estrategia (ronda 3): el fondo se ve, sobre todo, A TRAVÉS de la zona del
// texto —un titular cubre ~10 % de su caja; una captura de producto, el 100 %—.
// Así que el color CRUZA la zona del texto en vez de rodearla; el texto se lee
// porque el fondo es claro (luminancia ≥ 0,59 en todo punto bajo el texto), no
// porque esté vacío. El color se saca de detrás de las capturas opacas.

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
      {/* Núcleo claro pequeño y suave: solo levanta el punto más exigente (7:1
          bajo el titular). No es un velo que lava toda la zona. */}
      <div className="fh-lobe fh-core" />

      {/* Color repartido, cruzando la zona del texto. Los tonos claros
          (aciano, ciruela, menta) llevan color al texto sin bajar de 0,59; el
          azul de marca vive donde no ahoga el titular. Nada anclado detrás de
          las capturas opacas. */}
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
        /* ── Opacidades calibradas midiendo, no a ojo ─────────────────────────
           La composición y los recorridos son los de la ronda 3, que resolvió
           el movimiento (7,4 de media en la zona del texto, frente a 1,4 antes).
           Lo que se corrigió aquí es SOLO la intensidad: con los valores
           originales el fondo bajaba a luminancia 0,483 bajo el texto y el
           titular se quedaba en 5,86:1, por debajo del 7:1 exigido.

           Se barrió la escala del color contra los dos criterios a la vez:

             escala  núcleo   peor L   titular   movimiento
              1,00    0,42     0,483    5,86 ✗     7,41 ✓   ← entregado
              0,75    0,42     0,556    6,67 ✗     5,91 ✓
              0,60    0,55     0,602    7,17 ✓     4,92 ✓   ← elegido
              0,50    0,60     0,637    7,55 ✓     4,28 ✓
              0,42    0,62     0,667    7,88 ✓     3,76 ✓

           Se eligió 0,60: es la fila con más color que sigue pasando en los
           CUATRO anchos, y de paso la que más se mueve.

           Ojo con de dónde sale el suelo. El primer criterio pedía 7:1 al
           titular, que es el listón AAA de TEXTO NORMAL. El titular mide 72 px
           en escritorio y 52 en móvil: en WCAG eso es texto grande, donde AA
           son 3:1 y AAA 4,5:1. Exigir 7:1 apretó las tres rondas de más. Quien
           manda de verdad es el SUBTÍTULO, 18 px a 4,5:1, que fija el suelo en
           luminancia 0,574. Se mantiene el 7:1 del titular como listón interno
           porque a 0,60 se cumple igual (7,17:1) y no cuesta nada.

           Si algún día se cambia el color o el tamaño del titular, este barrido
           hay que repetirlo: el suelo de luminancia depende del navy #0B3C5D.

           (Nada de comillas invertidas en este bloque: es un comentario CSS
           dentro de una plantilla literal de JS, y una sola la cerraría en seco.
           Ya pasó.)
           ──────────────────────────────────────────────────────────────────── */
        .fh-core {
          top: 0%; left: 6%; width: 64%; height: 34%;
          background: radial-gradient(ellipse closest-side,
            rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%);
          animation: fondoHero-core 21s ease-in-out infinite alternate;
        }
        .fh-corn {
          top: -4%; left: -8%; width: 70%; height: 50%;
          background: radial-gradient(ellipse closest-side,
            rgba(168,180,245,0.24) 0%, rgba(168,180,245,0) 100%);
          animation: fondoHero-e 23s ease-in-out infinite alternate;
        }
        .fh-plum {
          top: 6%; left: 20%; width: 64%; height: 48%;
          background: radial-gradient(ellipse closest-side,
            rgba(196,160,240,0.22) 0%, rgba(196,160,240,0) 100%);
          animation: fondoHero-d 27s ease-in-out infinite alternate;
        }
        .fh-mint {
          top: 30%; left: -10%; width: 60%; height: 44%;
          background: radial-gradient(ellipse closest-side,
            rgba(111,215,155,0.23) 0%, rgba(111,215,155,0) 100%);
          animation: fondoHero-c 29s ease-in-out infinite alternate;
        }
        .fh-blue {
          top: 40%; left: 10%; width: 80%; height: 46%;
          background: radial-gradient(ellipse closest-side,
            rgba(75,95,212,0.19) 0%, rgba(75,95,212,0) 100%);
          animation: fondoHero-a 31s ease-in-out infinite alternate;
        }
        .fh-turq {
          top: 20%; right: -14%; width: 56%; height: 46%;
          background: radial-gradient(ellipse closest-side,
            rgba(8,145,178,0.18) 0%, rgba(8,145,178,0) 100%);
          animation: fondoHero-b 33s ease-in-out infinite alternate;
        }
        /* Respiro cálido permitido: rosa muy desaturado, borde inferior-derecho. */
        .fh-warm {
          right: -8%; bottom: -12%; width: 42%; height: 40%;
          background: radial-gradient(ellipse closest-side,
            rgba(232,178,205,0.04) 0%, rgba(232,178,205,0) 100%);
          animation: fondoHero-f 19s ease-in-out infinite alternate;
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
          .fh-core { top: 4%;  left: 2%;   width: 40%; height: 46%; }
          .fh-corn { top: 2%;  left: -8%;  width: 50%; height: 74%; }
          .fh-plum { top: 18%; left: 12%;  width: 46%; height: 66%; }
          .fh-mint { top: auto; bottom: -14%; left: -8%; width: 50%; height: 60%; }
          .fh-blue { top: auto; bottom: -18%; left: 14%; right: auto; width: 58%; height: 66%; }
          .fh-turq { top: 0%;  right: -6%; width: 52%; height: 80%; }
          .fh-warm { right: -6%; bottom: -12%; width: 38%; height: 56%; }
          .fh-velo {
            background:
              linear-gradient(to bottom, rgba(244,247,251,0.95) 0px, rgba(244,247,251,0) 130px),
              linear-gradient(to right, rgba(244,247,251,0.35) 0%, rgba(244,247,251,0) 50%);
          }
        }

        /* Recorridos amplios (18–28 % del lóbulo) y ciclos de 19–33 s: ambiental
           pero perceptible. translate3d explícito para no chocar con las
           utilidades scale/translate de Tailwind v4. */
        @keyframes fondoHero-core { from { transform: translate3d(0,0,0) scale(1); }    to { transform: translate3d(20%,16%,0) scale(1.14); } }
        @keyframes fondoHero-a    { from { transform: translate3d(0,0,0) scale(1); }    to { transform: translate3d(-24%,-16%,0) scale(1.18); } }
        @keyframes fondoHero-b    { from { transform: translate3d(0,0,0) scale(1.06); } to { transform: translate3d(-22%,18%,0) scale(0.9); } }
        @keyframes fondoHero-c    { from { transform: translate3d(0,0,0) scale(0.92); } to { transform: translate3d(24%,-20%,0) scale(1.16); } }
        @keyframes fondoHero-d    { from { transform: translate3d(0,0,0) scale(1); }    to { transform: translate3d(-20%,22%,0) scale(1.14); } }
        @keyframes fondoHero-e    { from { transform: translate3d(0,0,0) scale(1.1); }  to { transform: translate3d(26%,18%,0) scale(0.92); } }
        @keyframes fondoHero-f    { from { transform: translate3d(0,0,0) scale(1); }    to { transform: translate3d(-18%,-18%,0) scale(1.12); } }

        /* Accesibilidad: se apaga la animación entera; el fotograma inicial ya
           está compuesto para verse bien congelado. */
        @media (prefers-reduced-motion: reduce) {
          .fh-lobe { animation: none; }
        }
      `}</style>
    </div>
  );
}
