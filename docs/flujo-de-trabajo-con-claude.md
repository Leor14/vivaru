# Cómo trabajar con Claude Code en este repo

Escrito el 8 de agosto de 2026, después de una sesión que cubrió ocho frentes
distintos y en la que se perdieron cosas por no tener esto escrito.

No es teoría: cada regla de aquí abajo viene de algo que falló ese día.

---

## El principio del que sale todo lo demás

> **La continuidad vive en el repositorio, no en la conversación.**

Una conversación no se puede consultar, no se puede buscar y se resume sola
cuando crece —perdiendo matiz—. Un mensaje de commit, un `docs/` y un comentario
en el código sí se consultan, y están escritos en el momento en que se sabía la
respuesta, no reconstruidos de memoria al final.

Corolario incómodo: **si algo importante solo existe en el chat, está perdido.**

---

## Cuántas ventanas, y cómo repartirlas

El eje **no es el tema**. Es **la superficie que se escribe**.

Ese día, «SEO» y «animaciones» parecían dos temas y eran el mismo fichero
renderizado: cambiar el titular por SEO alargó el hero de 517 a 593 px, y como
el fondo animado es porcentual, el contraste del subtítulo cayó de 4,93 a 4,59.
Se detectó solo porque las dos cosas iban en la misma sesión. Separadas por
tema, habría salido a producción una regresión de accesibilidad que no rompe el
typecheck, no rompe ningún test y no se ve.

| Tipo de trabajo | Cuántas | Por qué |
|---|---|---|
| **Escribe** (código, ficheros, git) | **Una. Siempre una.** | El estado de git es global: dos ventanas commiteando es como se pierde trabajo |
| **Solo lee** (research, auditorías, «explícame X») | Las que quieras | No tocan nada, no compiten, no pueden romper |
| **Recurrente** (vigilar, revisar cada día) | Ninguna | Eso quiere un agente programado, no una ventana abierta |

Todo lo que toque el landing va junto **aunque sean asuntos distintos**. Lo que
toque los portales autenticados, o las functions, o la wiki, va aparte: son
superficies que no se pisan.

---

## Abrir una sesión

**Lo que dices tú:** la superficie y el objetivo, no el tema.

> «Vamos a trabajar sobre el landing. Objetivo: los puntos 6 a 8 de la
> auditoría de SEO.»

**Lo que Claude hace antes de tocar nada** — y si no lo hace, pídeselo:

1. `git status` y rama actual
2. Qué hay desplegado en staging y en producción, y si coincide con las ramas
3. Leer el índice de traspaso de la sesión anterior

Suena burocrático hasta que pasa lo que pasó: se quedó en `master` sin darse
cuenta y siete commits fueron a la rama equivocada, durante siete mensajes
diciendo que iban a `develop`.

---

## Durante

**Un incremento es: verificar, y commitear.** No se acumulan tres cosas para
commitear al final. Cada commit verificado es un punto de retorno y un punto de
corte limpio.

**El mensaje de commit lleva el porqué, no el qué.** El qué ya está en el diff.
El porqué es lo único que no se puede reconstruir después, y es el traspaso de
verdad. Los buenos de este repo explican qué se intentó, qué falló y qué trampa
hay que no repetir.

**Medir, no mirar.** Es la lección que más veces se repitió ese día. Un fondo
que «se ve bien» daba 3,96:1 de contraste. Un logo que «se veía» tenía un
recuadro blanco opaco desde hacía meses en producción. Una barra de progreso
midió perfecto en `transform` y tenía 0 px de ancho real.

**No dar por buena una señal sin saber qué significa.** Ese día se interpretó un
HTTP 204 de Google Analytics como «evento aceptado». Significa «recibido», y
Google estaba descartando todo por venir de un navegador sin interfaz.

**Nunca dejar la rama cambiada.** Para trabajar contra otra rama, worktree:

```bash
git worktree add /tmp/wt -b temporal origin/master
# …trabajar ahí…
git worktree remove --force /tmp/wt
```

Así el directorio principal nunca se mueve.

**Después de cada push, comprobar que el remoto se movió.** Un push de una rama
sin cambios responde «success» igual:

```bash
[ "$(git rev-parse develop)" = "$(git rev-parse origin/develop)" ] && echo OK
```

**Distinguir «hecho en local» de «desplegado».** Ese día se revisó staging dos
veces con una versión obsoleta, porque lo nuevo estaba sin commitear. Si se pide
mirar algo desplegado, primero hay que comprobar qué está sirviendo de verdad.

---

## Cerrar

**Se cierra en estado limpio, no por reloj.** Cortar por tiempo te pilla con
trabajo a medias y arrastra el problema a la sesión siguiente.

El estado limpio es: `git status` vacío, todo empujado, el remoto verificado y
—si se desplegó— comprobado en el ambiente. Ese momento aparece solo cada dos o
tres incrementos.

**El índice de cierre son diez líneas, no un resumen.** Qué queda pendiente y
**dónde está escrito el detalle**. Nada de reexplicar: si hace falta reexplicar
algo, es que faltaba en un commit o en un `docs/`, y ahí es donde hay que
arreglarlo.

No uses la skill de KT para esto. Está pensada para que una persona reciba un
sistema de otra, con prueba de que puede operarlo sola. Para pasar contexto a
una sesión nueva es un mazo para una chincheta.

---

## Trampas de este repo que ya costaron tiempo

Están documentadas donde toca; esta lista es solo el índice.

| Trampa | Dónde está el detalle |
|---|---|
| `apphosting.yaml` nunca se fusiona entre ramas | `CLAUDE.md` |
| `overflow: hidden` rompe `sticky` y `animation-timeline` | `MultiConjunto.tsx`, `FondoHero.tsx` |
| En Tailwind v4, `scale-*` y `translate-*` no escriben `transform` | mensajes de commit del bloque G |
| Los componentes en portal quedan fuera de `.marketing-theme` | `ui/sheet.tsx`, `ui/dialog.tsx`, `DemoDialog.tsx` |
| App Hosting apaga el optimizador de imágenes | `next.config.ts` |
| GA4 descarta el tráfico de Playwright como bot | memoria `analitica-ga4-vivaru` |
| El fondo del hero depende de que el subtítulo sea `slate-700` | `FondoHero.tsx`, `Hero.tsx` |
