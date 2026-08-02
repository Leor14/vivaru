# Plan de rediseño del landing

**Estado:** listo para ejecutar · **Rama:** `develop` → staging · **Fecha:** 2026-08-02

Rediseño visual de ocho secciones del landing público (`/mx`), tomando mecánicas de tres sitios de referencia y respetando los tokens que el landing ya tiene.

---

## Por qué esto es un plan y no una PRD

Aplicando la puerta de `crear-prd-vivaru`, que exige cumplir **al menos dos** criterios:

| Criterio | ¿Aplica? |
|---|---|
| Toca más de un rol o portal | No. Solo el landing público |
| Cambia permisos, modelo de datos o reglas | No |
| Consecuencias de dinero, legales o datos personales | No |
| Introduce estados que alguien opera | No |
| Envía correo o notificaciones | No |
| Alguien cuestionará la decisión después | **Sí**, retirar los porcentajes es una decisión de posicionamiento |

Uno de seis. No merece PRD; merece plan de ejecución, como `plan-self-service-trial.md`. La única decisión que sí necesita firma explícita va marcada abajo como **D1**.

---

## Alcance

**Entra:** Topbar, una sección nueva tras el Hero, ImpactBand, Perspectives, Differentiators, TrustOnboarding, FAQ y FinalCTA.

**No entra:** Hero, Pain, Solution, CasosDeUso, MultiConjunto, Pricing (hoy comentado), Pilot (oculto), Footer, `/diagnostico` ni las páginas legales. Tampoco cambia una línea de copy fuera de las secciones listadas, salvo ImpactBand.

**No entra tampoco:** el portal de la aplicación. Es una separación que hay que vigilar, ver la restricción R1.

---

## Restricciones descubiertas en el código

Esto es lo que hace que el plan sea ejecutable y no una lista de deseos. Cada una está verificada contra el repositorio o contra producción.

### R1 · El landing NO hereda de `DESIGN.md`

Hay **dos sistemas de color** en el mismo repositorio:

- `DESIGN.md` describe la **aplicación**: fondo `#f4f7fb`, tintes sky/mint/peach/sand/lavender, brand navy `#0b3c5d`.
- El landing tiene su propio bloque `.marketing-theme` en `globals.css` (línea 715): fondo **`#FFFFFF`**, texto `#0F172A`, borde `#E2E8F0`, primario `#4B5FD4`, y acentos ámbar `#D97706`, teal `#0891B2`, verde `#16A34A`, morado `#7C3AED`.

Verificado en producción: las secciones se pintan sobre `rgb(255,255,255)`. El `#f4f7fb` es el `<body>` de debajo y no se ve.

**Regla:** ningún token de `DESIGN.md` entra al landing. Costó dos iteraciones del boceto descubrirlo.

### R2 · El landing no tiene modo oscuro

`DESIGN.md`: *"No dark mode tokens defined"*. No se añade en este trabajo. Nada de `prefers-color-scheme` en los componentes de marketing.

### R3 · Eventos de analítica que deben sobrevivir

Cambiar el marcado sin cuidado rompe el embudo en silencio. Estos eventos viven en las secciones que tocamos:

| Evento | Dónde | Nota |
|---|---|---|
| `faq_open` | `FAQ.tsx:120` | Con `question_id` numérico |
| `perspective_tab_change` | `Perspectives.tsx:373` | Con `tab` y `from_tab` |
| `cta_primary_view` | `FinalCTA.tsx:33` | `section: "final"` |
| `cta_secondary_click` | `FinalCTA.tsx:81` | `section: "final"` |
| `cta_login_click` | `Topbar.tsx:90,106` | Dos variantes |

`ImpactBand` no tiene instrumentación: es la sección más libre de las ocho.

**Criterio de aceptación transversal:** tras cada incremento, disparar el evento de la sección tocada y verlo en la consola con la misma forma de antes.

### R4 · Los `id` del FAQ son estables y hay uno retirado

`QUESTIONS` va `1, 2, 3, 5, 6, 7`. El `4` se retiró y **nadie renumeró a propósito**, para no romper la comparabilidad del histórico.

**Regla:** reordenar a dos columnas es seguro mientras cada `id` siga atado a su pregunta. Preguntas nuevas empiezan en `8`. **Jamás reutilizar el 4.**

### R5 · Hay un CTA fijo inferior en móvil

`Topbar.tsx:227` monta una barra fija abajo, solo en móvil, con `env(safe-area-inset-bottom)`. La píldora del incremento 1 vive arriba y no debe colisionar con ella ni duplicar la llamada a la acción.

### R6 · Cero pruebas del landing

No existe ninguna suite para `src/components/marketing/`. Ocho secciones sin red. Ver incremento 0.

### R7 · Solo `/mx` consume estos componentes

`src/app/(marketing)/mx/page.tsx` es el único consumidor. `/diagnostico` y las legales no los usan, así que el radio de impacto está acotado.

### R8 · `apphosting.yaml` en cada merge

La versión de `develop` es configuración de staging; la de `master`, de producción. El merge no avisa: ya mordió en las dos direcciones. Comprobar el archivo **después** de cada merge, antes de comitear.

---

## Decisión que necesita firma

**D1 · Retirar los porcentajes de `ImpactBand`.**

Hoy dice `−20 % a −35 %` de interacciones manuales y `+10 % a +25 %` de tracking de morosidad. **No hay fuente y con cero clientes no se pueden sustentar.** Un prospecto que pregunte de dónde salen deja al comercial sin respuesta.

Propuesta: tres afirmaciones verificables con explicación y enlace, siguiendo el patrón de Cohere.

1. **Aislamiento por conjunto** — lo imponen las reglas del servidor, no la interfaz.
2. **Trazabilidad auditable** — un cobro se reversa, nunca se borra.
3. **Cuatro portales, un dato** — mismos datos, permisos distintos.

Las tres son comprobables señalando el producto. No avanzar el incremento 3 sin confirmación.

---

## Incrementos

Cada uno se despliega solo a staging, se revisa y se promueve. Ninguno depende del siguiente.

### Inc 0 · Cimientos — hecho

Sin cambio visible. Prepara el terreno para los siete restantes.

- Extraer el mecanismo de marcador de `Perspectives.tsx` (un `src` sin definir pinta un hueco con la proporción correcta) a un componente compartido `AssetSlot`. Es lo que permite maquetar las ocho secciones **antes** de tener las 19 piezas.
- Primera prueba de humo del landing: que `/mx` renderiza las once secciones y que `track()` se llama con la forma esperada. Cierra R6 lo justo para no ir a ciegas.
- Documentar R1 y R2 en la wiki (`decisiones/trampas-conocidas.md` y una página nueva de tokens del landing).

**Archivos:** `src/components/marketing/ui/asset-slot.tsx` (nuevo), `Perspectives.tsx`, `tests/landing-smoke.test.ts` (nuevo), wiki.

### Inc 1 · Topbar en píldora — hecho

Referencia: Cleanmeter. `max-width` que se contrae al bajar, `420ms cubic-bezier(0.77,0,0.175,1)`, píldora **blanca** con borde y sombra, no la barra oscura del original.

- `useScrolled(20)` ya existe: solo cambia el tratamiento visual.
- No tocar los dos `cta_login_click` (R3), ni el CTA fijo móvil (R5).
- Animar solo `max-width` y `box-shadow`. Nada de `all`.

**Assets:** ninguno. **Archivos:** `Topbar.tsx`.

### Inc 2 · FAQ en dos columnas — hecho

Referencia: Cleanmeter. Rejilla de dos columnas, ítems sueltos con borde de 1px y radio 12px, fuera la caja contenedora.

- Mantener el acordeón y `faq_open` con los `id` intactos (R4).
- Una columna en móvil.

**Assets:** ninguno. **Archivos:** `FAQ.tsx`.

### Inc 3 · ImpactBand → tres afirmaciones — hecho

D1 aprobada. Referencia: Cohere. Icono SVG de 100×100, título, párrafo y enlace.

- Sale del navy: la sección pasa a fondo claro. Deja de ser una de las superficies oscuras.
- El `h2` es hoy `sr-only` («Impacto medible»). Al pasar a título visible, revisar que no rompa la jerarquía de encabezados de la página.

**Assets:** 3 SVG a medida. **Archivos:** `ImpactBand.tsx`.

### Inc 4 · TrustOnboarding con miniatura — hecho

Referencia: Cohere «latest news». Miniatura 16:9 arriba, etiqueta de categoría, título y cuerpo. Sin caja contenedora, sin icono.

**Sin el pie con flecha que llevaba el original.** Las tarjetas de Cohere son artículos y el pie lleva a leerlos; estas son garantías, y tres de las cuatro no tienen a dónde llevar. Un «Ver cómo →» que no va a ninguna parte es una promesa falsa de navegación.

**Assets:** 4 miniaturas 16:9. **Archivos:** `TrustOnboarding.tsx`.

### Inc 5 · Differentiators con revelado — hecho

Referencia: Cohere «industries», con el revelado que **no** hace el original: el texto aparece al pasar el cursor y al tocar.

- Rejilla desigual, no seis cuadros iguales.
- En móvil no hay hover: el toque abre y cierra.
- Accesible por teclado, con foco visible.

**Assets:** 6 fotos. **Archivos:** `Differentiators.tsx`.

### Inc 6 · Perspectives a pantalla amplia — hecho

Referencia: Cohere «sovereign workplace». Las cuatro pestañas se quedan; cambia el envoltorio: captura al doble de tamaño recortada por el borde derecho.

- Preservar `perspective_tab_change` con `tab` y `from_tab` (R3).
- Las 14 capturas actuales sirven de puente hasta recapturar a @2x.

**Assets:** 4 recapturas @2x. **Archivos:** `Perspectives.tsx`, `PerspectivesLazy.tsx`.

### Inc 7 · Sección nueva tras el Hero — hecho

Referencia: Cohere. Panel partido con una consola de producto y texto que se escribe solo, más una foto.

- **Sin vídeo**, como el original: Cohere no tiene ni un `<video>` en todo el sitio.
- Respetar `prefers-reduced-motion`: sin animación de escritura, texto fijo.
- Va entre `<Hero />` e `<ImpactBand />` en `mx/page.tsx`.

**Assets:** 1 foto 1:1. **Archivos:** nuevo componente, `mx/page.tsx`.

### Inc 8 · FinalCTA partido — hecho

Referencia: Synthesia. Copy y botones a la izquierda, vídeo 16:9 en bucle a la derecha desbordando el borde.

- Degradado **lavanda claro**, no navy: el CTA de Synthesia es claro. Quita la última superficie oscura.
- Vídeo: `autoplay`, `loop`, `muted`, `playsInline`, **sin controles**, con póster y carga diferida.
- **Es el primer vídeo del landing.** Ver riesgo G2.
- Preservar `cta_primary_view` y `cta_secondary_click` (R3).

**Assets:** 1 webm + 1 marco PNG. **Archivos:** `FinalCTA.tsx`.

---

## Producción de assets (vía paralela)

19 piezas. No bloquean la maquetación gracias al `AssetSlot` del incremento 0.

| Inc | Tipo | Estado |
|---|---|---|
| 7 | 1 foto 1:1 | **Hecho** |
| 3 | 3 SVG 100×100 | **Hecho**, dibujados a mano |
| 5 | 6 fotos | **Hecho** |
| 4 | 4 capturas 16:9 | Pendiente · necesita siembra en staging |
| 6 | 4 recapturas @2x | Pendiente · necesita siembra en staging |
| — | 3 de multi-conjunto | Pendiente · **una no existe**, ver abajo |
| 8 | 1 vídeo + póster | Pendiente |

Las 10 hechas pesan 2,7 MB tras optimizar, desde los 10,4 MB originales.

**Aviso sobre `multiconjunto-selector`:** esa captura no se puede tomar porque
el conmutador de conjunto **no existe en el producto**. El claim de sesión lleva
un solo `tenantId` y `auth-context` resuelve la membresía con `limit(1)`. El
bullet del landing que promete llevar varios conjuntos desde una cuenta no es
cierto hoy: o se ajusta el texto, o se construye la pantalla.

Las 4 capturas del incremento 6 las podemos generar nosotros desde staging. Las 11 fotos y los 3 SVG son producción externa. El vídeo es lo único con coste real de guion y edición.

---

## Riesgos

| # | Riesgo | Señal que lo detecta | Mitigación |
|---|---|---|---|
| G1 | Romper analítica en silencio | El evento deja de aparecer en consola | Verificación por incremento (R3) |
| G2 | El vídeo dispara el peso de la página | Lighthouse por debajo del valor previo | Medir antes del inc 8 y fijar presupuesto; póster + carga diferida |
| G3 | Fuga de tokens del landing al portal | Colores raros en `/admin` | R1; revisar que nada se defina fuera de `.marketing-theme` |
| G4 | Regresión en el embudo | Caída de leads tras promover | Promover de uno en uno, no los ocho juntos |
| G5 | `apphosting.yaml` arrastrado en el merge | Staging apuntando a producción o al revés | R8, comprobación manual tras cada merge |
| G6 | Jerarquía de encabezados rota (SEO) | Un `h2` que desaparece o se duplica | Revisar en el inc 3, que es el que cambia semántica |

---

## Verificación por incremento

Antes de promover cualquiera:

1. `npm run typecheck` sin errores fuera de `tests/`.
2. La prueba de humo del inc 0 en verde.
3. El evento de analítica de la sección, disparado y con la misma forma.
4. Recorrido visual en staging a 1440px y a 375px.
5. Teclado: foco visible en todo lo interactivo nuevo.
6. `prefers-reduced-motion` activo: sin animación, sin contenido perdido.

---

## Despliegue

Cada incremento: commit a `develop` → staging construye → recorrido visual → merge a `master` → **comprobar `apphosting.yaml`** → push.

Front solamente: ninguno de los ocho toca reglas, functions ni índices. Por eso no aplica el orden reglas → functions → front.

**Reversión:** cada incremento es un commit acotado a uno o dos archivos. Revertir es `git revert` de ese commit y push. No hay migraciones ni estado que deshacer.

---

## Orden y por qué

**0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8**

Los cimientos primero porque desbloquean todo. Luego los dos que no necesitan ninguna imagen (1 y 2): cambian la percepción de la página y se pueden construir hoy. Después los que dependen de assets, de menos a más piezas. El 8 al final porque es el único que mete vídeo y el que más riesgo de peso tiene.

---

## Historial

| Fecha | Cambio |
|---|---|
| 2026-08-02 | Plan escrito tras validar el boceto de dirección. R1 y R2 descubiertas durante el boceto, a costa de dos iteraciones |

---

## Estado al cerrar los nueve incrementos

Los ocho cambios visuales están construidos y verificados sobre build de producción. **Ninguno está en `master`**: todo vive en `develop`, que es lo que construye staging.

Lo que falta no es código:

1. **Las 19 piezas de imagen y vídeo.** Todas las secciones se maquetaron con `AssetSlot`, así que llegan sin tocar layout.
2. **Recorrido tuyo en staging**, incluido el `body { overflow-x: clip }` del inc 1, que toca los cuatro portales.
3. **Presupuesto de peso del vídeo** antes de producirlo. Es el primero del landing y entra con `preload="none"` y póster, pero conviene medir Lighthouse antes y después.

### Hallazgos que costaron tiempo y quedan documentados

| Hallazgo | Dónde |
|---|---|
| El landing no hereda de `DESIGN.md`, tiene su propio bloque de tokens | R1 · wiki |
| `body { overflow-x: hidden }` anulaba el `sticky` del header, y nunca funcionó | inc 1 · wiki |
| Los tokens de capa eran `--z-*` y no `--z-index-*`: `z-sticky` y `z-modal` no existían | inc 1 · wiki |
| `.marketing-theme .max-w-lg` gana a cualquier variante responsive | inc 6 · wiki |
| Tailwind v4 escribe `scale-*` en la propiedad `scale`, no en `transform` | inc 6 · wiki |
| La caché del panel de vista previa sirve bundles viejos: verificar sobre build de producción | inc 4 |
