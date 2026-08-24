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

- Typecheck app: `npm run typecheck` — **está en 0 errores, incluidos `tests/`** (medido el
  22 de agosto de 2026). Esta línea decía que los de `tests/` eran «preexistentes» y que el
  gate real era «0 fuera de `tests/`»: **eso ya no vale, y mantenerlo dejaría pasar un error
  nuevo disfrazado de viejo.** El gate es 0, a secas.
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
- **Integración con Albert CRM:** el estado vivo es **`docs/prd/albert/ESTADO-ALBERT.md`** —
  ir ahí, no a los nueve documentos del intercambio ni al expediente—. **CERRADO el 22 de
  agosto de 2026:** el contrato se acabó, el **alta A5 está ejecutada** (tenant `vivaru`
  activo, usuario de servicio con rol `sales`) y **A1 está publicado en producción de
  Albert**. Ya no hay nada bloqueado por ellos, y **los dos equipos avanzan por separado a
  propósito** (decisión de David, 22 ago).
  Esta línea decía hasta hoy que «recibir de Albert no existe»: **es falso desde que Vivaru
  es tenant suyo** y puede suscribirse en vivo a `tenants/vivaru/deals`.
  `docs/albert-vivaru-integracion.md` es el **registro histórico de cómo se decidió**, no
  el estado — está congelado en el 18 de agosto, antes del intercambio.
- **Roadmap REVOPS (activación comercial):** `docs/roadmap-revops.md` — base de la épica transversal. Adapta el Documento Rector REVOPS v1.0 con la línea base medida (5 leads, cero convertidos), las cuatro capacidades que ya existían, y el CRM identificado: es **Albert CRM**, producto propio. **Vivaru es TENANT suyo**, y eso cambia la integración entera: se empujan leads hoy, y **la señal de vuelta NO hay que construirla** — siendo tenant, Vivaru se suscribe en vivo (`onSnapshot`) a `tenants/vivaru/deals`, porque sus reglas conceden lectura a todos los roles del tenant. Este archivo decía «no tiene webhooks, así que hay que construirla» y **quedó obsoleto el 19 de agosto de 2026**, al hacernos tenant. Estado vivo del expediente: `docs/prd/albert/ESTADO-ALBERT.md`.
- **Roadmap financiero:** `docs/roadmap-finance.md` — **el módulo ya arrancó**: F0 y F0b en producción. Adapta el Documento Rector v2 (Word) con la verificación contra código y ambientes: el mapa de rutas de pago, los cuatro defectos nombrados, y la línea base medida (cero datos propios). Su §5 explica por qué el frente fiscal salió del alcance.
- **Bitácora de lo construido:** base de Notion **Construido — bitácora de Vivaru**, una fila
  por entrega con frente, ambiente, bandera y commit. **El roadmap dice qué se va a hacer y por
  qué; la bitácora dice qué existe y dónde corre.** Se actualiza en la misma pasada que el
  roadmap. Identificadores en la tabla de accesos de abajo.
- **Roadmap de producto:** `docs/roadmap-producto.md` — **el repositorio es la fuente
  de verdad; la copia de Notion es la vista publicada.** Tres zonas con reglas
  distintas: el estado se REESCRIBE arriba, el cuerpo se EDITA en su sitio, y solo el
  changelog acumula (lo nuevo primero). **Nunca añadir «actualización del …» al final
  del cuerpo**: obliga a bajar y deja dos épocas conviviendo sin decir cuál manda —
  el defecto que tenía `wiki/modulos/pqrs.md` desde mayo de 2026.

### Accesos de Notion — verificados el 22 de agosto de 2026

**Estos dos abren con el conector. La página de Albert NO, y no hay que volver a intentarlo.**
Se comprobó fetchando cada uno, no de memoria.

| Qué | Tipo | Identificador |
|---|---|---|
| **Roadmap de Producto Vivaru** | página | `3bf1acebfa098051b602e4c6c60b3c90` |
| **Construido — bitácora de Vivaru** | base de datos | `0bdb213a53274fe2bcc7bd9b4fa1510a` |
| ↳ su fuente de datos (para `update_data_source` / `query_data_sources`) | data source | `collection://80e46f50-50c9-4b85-ad7a-c80259cfd57d` |

**Por qué la de Albert da 404 y no es un problema de permisos que se pueda pedir:** el conector
está autenticado contra el workspace **`David Carmona's Space`**
(`6e71aceb-fa09-8151-8468-0003e5d11a28`, usuario `david.macar.18@gmail.com`). El roadmap
Albert–Vivaru vive en **otro workspace**, así que no se alcanza desde aquí por mucho que se
reintente. **Si hace falta su contenido, lo pega David.** Esta línea existe para no volver a
gastar una sesión descubriéndolo.

**Las cuatro vistas de la bitácora**, porque la que se abre por defecto no es la útil:

| Vista | Para qué | Id |
|---|---|---|
| `Bitácora — lo más reciente arriba` | **la de leer**, por fecha descendente | `view://3c41aceb-fa09-810c-83f9-000c710938e9` |
| `Esperando producción` | filtra `Estado = En staging`. **Es la lista del lote sin desplegar** | `view://3c41aceb-fa09-81f2-b4a1-000c946772cf` |
| `Por frente` | tablero agrupado por frente | `view://3c41aceb-fa09-819a-854e-000c1a19a93f` |
| `Default view` | tabla sin ordenar — **es la que abre el enlace que se comparte** | `view://0784a920-935e-4a21-93ed-758106d68ba6` |

**Esquema de la bitácora** (los nombres tienen que ir exactos al escribir filas):
`Entrega` (título) · `Frente` (select, 9 opciones, incluida **Propiedad horizontal**) ·
`Estado` (select: **En producción · En staging · Sin desplegar**) · `Fecha` (fecha) ·
`Bandera` (texto, «Sin bandera» = ya afecta a todos) · `Commit` (texto) · `Origen` (texto) ·
`Qué cambió` (texto, en lenguaje de resultado).

**Al editar páginas de Notion**, `update_page` con `update_content` quirúrgico: copiar las
cadenas **del fetch**, no del repositorio, porque no coinciden carácter a carácter.

- **Plan de auth (go-live):** `Hogaru/Producto/seguridad y accesos/Vivaru_Plan_Remediacion_Auth_GoLive.md`.
- **Módulo financiero/SRI:** `Hogaru/Producto/modulo  financiero - contable/` (Modelo fundacional, F1, F2 con las 6 preguntas del spike) + `Hogaru/Vivaru_Planning_Modulo_Financiero.md`.

## Estado actual — lo primero, y lo que más cambia

**`origin/develop` = `7937900`. `origin/master` = `5d6df95`.** Releer **los dos**: se mueven por
separado desde el 23 de agosto, y **no siempre los mueve la sesión que está trabajando**. Un push
sin cambios responde «success», así que comprobar con `git ls-remote`, que no depende de la caché.

**`FLOW-002` (anticipos): la SESIÓN A —todo el servidor— está terminada y verificada contra la
base.** Ocho incrementos en `develop`: reglas de `advances`/`advanceApplications` y el veto de
`advanceAppliedAmount`, los tipos y la cuenta `1.10`, `bankAccountId` en los **dos** asientos, los
dos espejos de `calcularSaldo`, el anticipo por sobrepago, cruce y descruce, R15 y R9, y el
reparto a varios cargos con su reverso de N líneas. **Los tres defectos —D-A, D-B, D-C—
corregidos.** Lo siguiente es la **sesión B: el front**, que es otra superficie.

**Staging desplegado y con las dos banderas encendidas** en `conjunto-las-playas`
(`producto-anticipos`, `producto-pago-multiple`). **25 comprobaciones en verde contra la base
real** con `functions/scripts/verificar-anticipos.mjs` — un script no destructivo que corre la
misma lógica que está desplegada, crea sus documentos, los usa y los borra.

**PRODUCCIÓN NO TIENE `FLOW-002`.** `master` en `5d6df95`, y las cinco banderas `producto-*`
siguen apagadas allí (sin documento en `featureFlags`).

**El reloj del 1 de septiembre está apagado** desde el 23: el código correctivo del informe de
comité y los 57 índices están en producción, y `monthlyFinancialArchive` ya no archiva un PDF con
doble conteo.

Estado vivo y detalle: `docs/pendientes.md`, `docs/roadmap-producto.md` (0.9.21) y
`docs/prd/funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md`.

### Lo que ninguna suite puede cazar, y por qué importa aquí

**1097 pruebas del front y 456 de functions estaban EN VERDE mientras el informe mentía.** No es
un fallo del banco: el defecto vivía en **la forma de la consulta contra un índice que solo
existe en la nube**, y ninguna prueba unitaria lo alcanza. La regla que sale de esto:

- **Una consulta con `orderByField` necesita su índice compuesto, Y EN LA DIRECCIÓN QUE PIDE.**
  Tener `(tenantId, campo ASC)` no sirve para un `orderBy campo desc`. `reservations` tiene las
  dos direcciones y funciona; `visitorPasses`, `tickets` y `committee_agreements` tenían solo
  ASC y fallaban. **Antes de añadir un `orderByField`, comprobar el índice en las dos.**
- **El patrón que no depende de índices es `watchLedger`**: pedir sin ordenar y ordenar en
  memoria. Es lo que hace `/admin/finanzas`, y por eso fue el único que nunca se rompió.
- **Un `catch` que deja la lista vacía convierte un fallo ruidoso en un dato falso.** Si una
  pantalla puede fallar a medias, tiene que **decirlo en pantalla y en el PDF**.
- **Un campo de filtro por rango debe estar poblado en todos los documentos.** Arreglar el
  índice de `eventDate` no llenó nada hasta correr `functions/scripts/backfill-event-date.mjs`.

**Validar entrando por el navegador funciona y es repetible.** Con la sesión de David abierta en
Chrome se comprobó el defecto, CA6 y el antes/después de los cinco arreglos. **Es lo que cambió
el ritmo de esa sesión**, y ya no hace falta pedir acceso aparte.

**Tres credenciales caducan POR SEPARADO** y el 23 de agosto caducaron las tres:
`gcloud auth application-default login` (leer Firestore con los scripts, síntoma `invalid_rapt`,
que **parece un error de código**), `firebase login --reauth` (índices y despliegues) y
`gcloud auth login` (el CLI).

## Estado por frentes (base de junio, con lo que cambió anotado dentro)

**A) Auth + correos (A0–A6) — implementado.** Onboarding por enlace (la cédula dejó de ser credencial), recuperación self-service, cambio de contraseña + política de complejidad, correos de onboarding por **Resend** (`functions/src/email.ts`, desde `noreply@notificaciones.grupovivaru.com`, secret `RESEND_API_KEY`), y página propia `/restablecer` (`src/app/(auth)/restablecer/page.tsx`). **PENDIENTE:** guardar la **URL de acción** en Firebase Console (Authentication → Templates → Personalizar URL de acción = `https://www.grupovivaru.com/restablecer`); dio error por permisos → reintentar con la cuenta **Owner** (`luisEOteroR@gmail.com`). Hasta entonces el enlace abre la página de Firebase en inglés (funciona, no branded). Archivos: `functions/src/index.ts`, `functions/src/password-policy.ts`, `src/features/auth/auth-context.tsx`, `src/lib/firebase/callables.ts`, `middleware.ts`, `firestore.rules`. Utilidad: `functions/scripts/diagnose-user-access.mjs`.

**B) Fixes módulo residentes.** Unidades duplicadas bloqueadas; borrar unidad con personas bloqueado con aviso; borrado de persona robusto; `unitId` por doc id; logo en el correo. Archivos: `src/app/(admin)/admin/residents/page.tsx`, `src/features/admin/services.ts`.

**C) Módulo financiero — NO congelado. Y lo fiscal sale del alcance (20 ago 2026).**

**Decisión de David: Vivaru no maneja temas fiscales.** La factura la emite el cliente, en todos los países. Con eso **el frente del SRI de Ecuador dejó de bloquear**, y su código se **retiró entero** el 20 de agosto (`dc3e061`): ya no existe `sri-ecuador.ts`, y `retransmitVoucher` está borrada de los dos ambientes. **No buscarlo.**

**Este archivo decía «congelado» y esa etiqueta era del frente fiscal, no del módulo.** Se leía sobre el todo. El estado real: `FIN-000` (Storage por rol) y `FIN-001` (comando único de pagos) están **en producción**; las fases de IA y piloto esperan **clientes**, no personas. Detalle en `docs/roadmap-finance.md` §5.

**El recibo lo emite el SERVIDOR** desde el 20 de agosto, dentro de la transacción del pago (`functions/src/payments.ts` + `functions/src/comprobante.ts`). Antes lo construía el navegador **después** de aplicar el pago, así que un fallo dejaba **un pago sin recibo**; y revertir no anulaba el recibo, dejaba una tarea manual que nadie perseguía. Las dos cosas estaban bloqueadas por «eso es meterse en lo fiscal», que dejó de ser cierto. Con ello se fue el contador de secuenciales —el recibo lleva un código no correlativo derivado de su id— y la regla de `paymentVouchers` pasó a `create, update: if false`.

**Verificar siempre `git status` al inicio**, y **releer `origin/master` además de `origin/develop`**: desde el 23 de agosto los dos se mueven. Un push sin cambios responde «success».

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
