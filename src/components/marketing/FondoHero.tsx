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
        /* ── Por qué el color vive en los BORDES ──────────────────────────────
           Tres rondas de diseño produjeron un fondo que se leía quieto y sin
           color. El diagnóstico, medido:

           1. Los ciclos eran de 19–33 s con alternate, o sea hasta 66 s de ida
              y vuelta: unos 5 px/s. Imperceptible. Y la velocidad NO cuesta
              contraste, así que no había razón para ser conservador ahí.

           2. Los picos de los lóbulos nacían casi blancos. #A8B4F5 al 24 %
              sobre #F4F7FB da #E2E7FA, que apenas se distingue de la base.

           La referencia (stacker.ai) resuelve esto poniendo el color saturado
           en los CUATRO BORDES y dejando el centro brillante. Los bordes no
           tienen restricción de contraste —el texto empieza en el 8 %—, así que
           ahí la saturación puede subir sin tocar la legibilidad. Lo que cruza
           la zona del texto es solo la cola desvanecida de cada lóbulo.

           TRAMPA, y costó encontrarla: colocar los picos fuera del área útil no
           basta, porque LA ANIMACIÓN LOS ARRASTRA DE VUELTA. Con recorridos del
           30–42 %, fh-blue acababa con su núcleo justo encima de los botones
           —el punto más oscuro de la sección estaba en x 45 %, y 87 %, a un 2 %
           de su centro—. Por eso cada lóbulo se mueve TANGENTE a su borde: los
           anclados arriba y abajo derivan en horizontal, el del borde derecho
           se desliza en vertical. Si alguien vuelve a poner recorridos
           diagonales grandes, el contraste se cae otra vez y no es evidente por
           qué.

           Estado medido, con el contraste tomado a lo largo de 40 s de ciclo y
           no en un solo fotograma:

             ancho        saturacion   movimiento   subtitulo   titular
             390             29,2         7,0        4,81 ✓     7,33 ✓
             768             22,9         5,6        5,69 ✓     8,67 ✓
             1440            37,8        12,2        4,77 ✓     7,27 ✓
             1920            37,8        14,1        4,75 ✓     7,24 ✓

           El suelo lo pone el SUBTÍTULO, 18 px a 4,5:1 → luminancia 0,574. El
           titular mide 72 px, que en WCAG es texto grande (AA 3:1, AAA 4,5:1),
           así que sobra por mucho: no es él quien limita.

           (Nada de comillas invertidas aquí: es un comentario CSS dentro de una
           plantilla literal de JS y una sola la cerraría en seco. Ya pasó.)
           ──────────────────────────────────────────────────────────────────── */
        .fh-core {
          top: 2%; left: -6%; width: 92%; height: 68%;
          background: radial-gradient(ellipse closest-side,
            rgba(255,255,255,0.86) 0%, rgba(255,255,255,0) 100%);
          animation: fondoHero-core 9s ease-in-out infinite alternate;
        }
        .fh-corn {
          top: -26%; left: -22%; width: 78%; height: 46%;
          background: radial-gradient(ellipse closest-side,
            rgba(168,180,245,0.62) 0%, rgba(168,180,245,0) 100%);
          animation: fondoHero-e 10s ease-in-out infinite alternate;
        }
        .fh-plum {
          top: -22%; right: -26%; width: 72%; height: 44%;
          background: radial-gradient(ellipse closest-side,
            rgba(196,160,240,0.58) 0%, rgba(196,160,240,0) 100%);
          animation: fondoHero-d 12s ease-in-out infinite alternate;
        }
        .fh-mint {
          bottom: -20%; left: -24%; width: 74%; height: 42%;
          background: radial-gradient(ellipse closest-side,
            rgba(111,215,155,0.55) 0%, rgba(111,215,155,0) 100%);
          animation: fondoHero-c 13s ease-in-out infinite alternate;
        }
        .fh-blue {
          bottom: -34%; right: -26%; width: 78%; height: 46%;
          background: radial-gradient(ellipse closest-side,
            rgba(75,95,212,0.50) 0%, rgba(75,95,212,0) 100%);
          animation: fondoHero-a 14s ease-in-out infinite alternate;
        }
        .fh-turq {
          top: 34%; right: -34%; width: 56%; height: 44%;
          background: radial-gradient(ellipse closest-side,
            rgba(8,145,178,0.46) 0%, rgba(8,145,178,0) 100%);
          animation: fondoHero-b 15s ease-in-out infinite alternate;
        }
        /* Respiro cálido permitido: rosa muy desaturado, borde inferior-derecho. */
        .fh-warm {
          right: -18%; bottom: -18%; width: 46%; height: 40%;
          background: radial-gradient(ellipse closest-side,
            rgba(232,178,205,0.10) 0%, rgba(232,178,205,0) 100%);
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
