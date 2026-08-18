# CLAUDE.md — Vivaru (SaaS PropTech)

SaaS multi-tenant de administración de propiedad horizontal para LATAM (México, Colombia, Ecuador). Dos portales operativos (`/admin` desktop-first, `/resident` mobile-first), `/guard` y `/superadmin`. Marca: **Vivaru** (antes "HOGARU"; el project ID de Firebase sigue siendo `hogaru-1`).

## Carpetas de trabajo (dos)

- **Código (este repo):** `/Users/david/Vivaru_Rep/vivaru/`
- **Documentos del proyecto:** `/Users/david/Claude Coworker/Hogaru/Hogaru/` — agrégala con `claude --add-dir "/Users/david/Claude Coworker/Hogaru/Hogaru"`.

## Cómo se trabaja aquí (leer antes de tocar nada)

**`docs/pendientes.md`** — qué quedó a medias y dónde está el detalle. Leerlo
al abrir sesión.

**`docs/flujo-de-trabajo-con-claude.md`.** Cuántas ventanas abrir y cómo
repartirlas, cuándo commitear, cuándo cerrar una sesión y cómo dejar el
traspaso. Sale de una sesión de ocho frentes en la que se perdieron cosas por no
tenerlo escrito.

Lo mínimo, si no se lee nada más:

1. **Antes de tocar nada:** `git status`, rama actual, y qué hay desplegado en
   cada ambiente. Una vez se trabajó siete mensajes sobre la rama equivocada.
2. **Una sola sesión que escriba a la vez.** El estado de git es global.
3. **Medir, no mirar.** Y después de cada push, comprobar que el remoto se movió
   (`git rev-parse origin/<rama>`): un push sin cambios responde «success».
4. **Cerrar en estado limpio**, no por reloj.

**Avisar del punto de corte.** Cuando se cumplan las TRES a la vez —árbol
limpio y empujado con el remoto verificado, objetivo de la sesión cumplido, y el
siguiente trabajo toca **otra superficie**— decirlo en una línea y seguir:

> Punto de corte limpio. Si lo siguiente es <otra superficie>, conviene cerrar
> aquí y abrir sesión nueva; te dejo el índice de traspaso.

Las tres condiciones son necesarias. Estar limpio a mitad del mismo frente es un
punto de guardado, no un motivo para cerrar: el trabajo relacionado debe seguir
junto —cambiar el titular por SEO tumbó el contraste del hero, y se detectó solo
porque iban en la misma sesión—. **No repetirlo en cada commit**: si se avisa
siempre, se deja de leer. Y no usarlo para soltar trabajo a medias: si el
objetivo no está cumplido, no es punto de corte.

## Stack

Next.js 15/16 (App Router), React 19, TypeScript, **Tailwind v4** (tokens en `@theme {}` en globals.css, NO `tailwind.config.ts`), Firebase (Auth, Firestore, Cloud Functions v2, App Hosting), Zod + React Hook Form. Deploy del front por **App Hosting** (push a `master`).

## Comandos clave

- Typecheck app: `npm run typecheck` — los errores en `tests/` son **preexistentes**; el gate real es 0 errores fuera de `tests/`.
- Typecheck functions: `npm --prefix functions run typecheck` — **usar este, no
  `npx tsc --noEmit`**. El `tsconfig.json` de functions incluye solo `src`
  (es el que emite a `lib/`), así que el comando directo **nunca ha comprobado
  `functions/tests/`**: el 17 de agosto de 2026 un cambio de firma dejó una
  llamada de prueba pasando un `string` donde iba un objeto, pasó el typecheck
  en verde y lo cazó vitest al ejecutar. El script usa
  `tsconfig.typecheck.json`, que añade `tests`. Está en **0 errores**, así que
  aquí no hay «preexistentes» que tolerar, al revés que en la raíz.
- Build functions (obligatorio antes de desplegar): `npm --prefix functions run build`
- Deploy functions: `firebase deploy --only functions --project hogaru-1`
- Deploy reglas: `firebase deploy --only firestore:rules`
- Secret de Resend (lo hace el USUARIO, no el agente): `firebase functions:secrets:set RESEND_API_KEY`
- Tests app: `npm test` (vitest)
- Tests functions: `npm --prefix functions test` — banco propio desde ago 2026 (`functions/tests/`, config en `functions/vitest.config.mts`). No se pueden poner en `tests/` de la raíz: importar `functions/` desde ahí rompe el build de App Hosting.
- Tests functions con emulador: `npm --prefix functions run test:emulator` (`*.emulator.test.ts`, config aparte). Requieren el emulador de Firestore levantado — ver la sección de más abajo. Van separados para que la suite normal no falle sin él.

## Ambientes desplegados

**El nombre del backend NO es el del proyecto.** Construir la URL a partir del
project ID da un host que no existe y responde 404 en TODO, lo que se lee como
«el despliegue va lento» cuando en realidad se está sondeando la nada.

| Ambiente | URL | Rama |
|---|---|---|
| Producción | `https://www.grupovivaru.com` · `https://vivaru--hogaru-1.us-central1.hosted.app` | `master` |
| Staging | `https://vivaru-staging-web--vivaru-staging-02.us-central1.hosted.app` | `develop` |

El landing vive en **`/`**; `/mx` redirige allí. (Estaba escrito al revés hasta
el 17 de agosto de 2026; el landing salió a la raíz en `9dca506` y esta línea no
se actualizó. Comprobado con `curl -L` contra producción, no de memoria.)

## Metodología

critique → execute → commit. Gate por incremento: typecheck limpio en `src/` **y** en `functions/` — este último con `npm --prefix functions run typecheck`, que es el que mira también `functions/tests/`. Mensajes de commit semánticos. Despliegue del front por push a `master`; functions por `firebase deploy --only functions` (recompilar antes — **no hay predeploy build**); el secret debe existir **antes** de desplegar funciones que lo referencian.

## Trampas críticas (ver `wiki-producto/wiki/decisiones/trampas-conocidas.md`)

- **Nunca importar `functions/` desde `src/` o `tests/`** — App Hosting hace `npm ci` solo en la raíz; rompe el `next build`. El cliente invoca Cloud Functions por nombre con `httpsCallable`.
- **CORS de callables:** `callableCorsOrigins` (en `functions/src/http-config.ts`; salió de `index.ts` en ago 2026 para que lo compartan los módulos nuevos) debe incluir el origen que sirve la app (`https://www.grupovivaru.com`). Síntoma de origen faltante: en logs solo `OPTIONS 204`, en navegador `net::ERR_FAILED`.
- **`unitId` de personas = doc id de la unidad, no el slug.** Usar el slug hace `updateDoc(units/<slug>)` sobre un doc inexistente → `permission-denied` engañoso ("No tienes permiso").
- **Árbol duplicado en la raíz:** además de `src/`, hay `components/` y `features/` en la RAÍZ del repo. El portal residente importa de la raíz (p. ej. `components/features/resident/ResidentSecuritySection.tsx`, `features/resident/schemas.ts`). Verificar de cuál se importa antes de editar.
- **Aislar widgets/tableros con `WidgetErrorBoundary`** (`src/components/shared/widget-error-boundary.tsx`): toda sección de dashboard/tablero que consuma datos del tenant —en especial charts de **recharts**— debe ir envuelta, para que un fallo de un widget NO tumbe toda la ruta `/admin` (su `error.tsx` muestra "No pudimos cargar el workspace"). El único error boundary de ruta convierte cualquier throw de un widget en una pantalla de error global.
- **Tenant siempre con `currency` válido** (`COP`|`MXN`|`USD`): cualquier alta/seed de un tenant debe escribir `currency`; los formateadores (`Intl.NumberFormat`, `useTenantCurrency`) deben defaultear a un valor válido y nunca recibir `undefined`.
- Locale `es-CO` siempre; `transition: all` prohibido; `replace_all` con acentos corrompe plurales.

## Seguridad

El valor de `RESEND_API_KEY` lo maneja **solo el usuario** (`firebase functions:secrets:set`). El agente nunca pide la key en el chat ni corre `secrets:access`. Deploy y logs sí se pueden delegar.

## Documentación / fuente de verdad

- **Wiki del producto:** `wiki-producto/wiki/` — empezar por `index.md` y seguir wikilinks. Páginas clave: `arquitectura/autenticacion-roles.md`, `arquitectura/correos-mensajeria.md`, `decisiones/trampas-conocidas.md`, `patrones-tecnicos/firebase-firestore.md`. Convenciones de la wiki en `wiki-producto/CLAUDE.md` (es-CO, frontmatter de 5 campos, mínimo 8 wikilinks).
- **Diseño/producto:** `PRODUCT.md`, `DESIGN.md` (raíz del repo).
- **Integración con Albert CRM:** `docs/albert-vivaru-integracion.md` — expediente de la decisión. Escribir en Albert funciona hoy pero apunta a una colección sin interfaz; recibir de Albert no existe. Ninguno de los dos productos está rodado.
- **Roadmap REVOPS (activación comercial):** `docs/roadmap-revops.md` — base de la épica transversal. Adapta el Documento Rector REVOPS v1.0 con la línea base medida (5 leads, cero convertidos), las cuatro capacidades que ya existían, y el CRM identificado: es **Albert CRM**, producto propio — se puede empujar leads hoy, pero NO tiene webhooks, así que la señal de vuelta hay que construirla.
- **Roadmap financiero:** `docs/roadmap-finance.md` — base para cuando arranque el módulo. Adapta el Documento Rector v2 (Word) con la verificación contra código y ambientes: el mapa de rutas de pago, los cuatro defectos nombrados, y la línea base medida (cero datos propios).
- **Roadmap de producto:** `docs/roadmap-producto.md` — **el repositorio es la fuente
  de verdad; la copia de Notion es la vista publicada.** Tres zonas con reglas
  distintas: el estado se REESCRIBE arriba, el cuerpo se EDITA en su sitio, y solo el
  changelog acumula (lo nuevo primero). **Nunca añadir «actualización del …» al final
  del cuerpo**: obliga a bajar y deja dos épocas conviviendo sin decir cuál manda —
  el defecto que tenía `wiki/modulos/pqrs.md` desde mayo de 2026.
- **Plan de auth (go-live):** `Hogaru/Producto/seguridad y accesos/Vivaru_Plan_Remediacion_Auth_GoLive.md`.
- **Módulo financiero/SRI:** `Hogaru/Producto/modulo  financiero - contable/` (Modelo fundacional, F1, F2 con las 6 preguntas del spike) + `Hogaru/Vivaru_Planning_Modulo_Financiero.md`.

## Estado actual (jun 2026) — tres frentes

**A) Auth + correos (A0–A6) — implementado.** Onboarding por enlace (la cédula dejó de ser credencial), recuperación self-service, cambio de contraseña + política de complejidad, correos de onboarding por **Resend** (`functions/src/email.ts`, desde `noreply@notificaciones.grupovivaru.com`, secret `RESEND_API_KEY`), y página propia `/restablecer` (`src/app/(auth)/restablecer/page.tsx`). **PENDIENTE:** guardar la **URL de acción** en Firebase Console (Authentication → Templates → Personalizar URL de acción = `https://www.grupovivaru.com/restablecer`); dio error por permisos → reintentar con la cuenta **Owner** (`luisEOteroR@gmail.com`). Hasta entonces el enlace abre la página de Firebase en inglés (funciona, no branded). Archivos: `functions/src/index.ts`, `functions/src/password-policy.ts`, `src/features/auth/auth-context.tsx`, `src/lib/firebase/callables.ts`, `middleware.ts`, `firestore.rules`. Utilidad: `functions/scripts/diagnose-user-access.mjs`.

**B) Fixes módulo residentes.** Unidades duplicadas bloqueadas; borrar unidad con personas bloqueado con aviso; borrado de persona robusto; `unitId` por doc id; logo en el correo. Archivos: `src/app/(admin)/admin/residents/page.tsx`, `src/features/admin/services.ts`.

**C) Módulo financiero / SRI Ecuador — congelado.** F1 completo; F2 parcial con transporte **stub**. **G3 (transporte SRI real) BLOQUEADO** por el dato del experto SAP↔SRI que gestiona David Almeida (firma electrónica .p12 por conjunto, endpoint, formato — 6 preguntas en `Vivaru_F2_Plan_Ejecucion_SRI_Ecuador.md`). Implementar `realSriTransport` en `functions/src/sri-ecuador.ts` cuando llegue el dato, sin tocar el resto.

**Verificar siempre `git status` al inicio:** parte del último lote (logo + fixes residentes + A6 + wiki) puede estar pendiente de commit/push/deploy.

## Pruebas de reglas de Firestore (emulador)

Java está instalado **local al usuario**, sin sudo, en `~/.local/java/`. El
emulador no arranca sin él, y por eso `tests/firestore.rules.test.ts` estuvo
meses sin ejecutarse — sus fallos pasaban por "preexistentes".

```bash
export JAVA_HOME="$HOME/.local/java/jdk-21.0.12+8-jre/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
firebase emulators:start --only firestore,storage --project hogaru-1-test   # en otra terminal
npm run test:rules:all
```

Tres trampas:
- `firebase emulators:exec "npx vitest ..."` NO sirve: la CLI corre el script con
  su Node empaquetado, que no puede cargar el ESM de vitest. Hay que levantar el
  emulador aparte.
- **Las pruebas de reglas SOLO corren con `vitest.rules.config.ts`** (es lo que
  hacen los scripts `test:rules*`). El config normal las excluye porque piden
  emulador, y esa exclusión no se puede deshacer desde la CLI: `--exclude` SUMA
  patrones, no los sustituye. Invocar el archivo directo contra el config normal
  da «No test files found» — así estuvieron meses sin ejecutarse.
- El config de reglas lista los archivos con ruta explícita para no recoger las
  copias de `.claude/worktrees/`, que comparten emulador y chocan entre sí con
  los mismos IDs. Provocaba fallos fantasma en otras suites.

Desde FIN-000 (ago 2026) las dos suites corren también en CI, en el job
`rules-tests` — separado del `quality-gate` para que el rojo preexistente del
typecheck de `tests/` no lo arrastre.
