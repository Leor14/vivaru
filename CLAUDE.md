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
- **El emulador necesita JAVA, y esta máquina no lo trae.** `/usr/bin/java` existe pero es
  solo el stub de macOS: responde «Unable to locate a Java Runtime» y el emulador muere
  antes de arrancar, con un error que no menciona Java hasta el final. No hay Homebrew ni
  ninguna app con un JDK dentro. **El JDK está en `~/.local/jdk`** (Temurin 21 LTS, arm64,
  instalado el 26 de agosto de 2026 sin tocar el sistema ni pedir contraseña). Antes de
  levantar el emulador:

  ```bash
  export JAVA_HOME="$HOME/.local/jdk/jdk-21.0.12.1+1/Contents/Home"
  export PATH="$JAVA_HOME/bin:$PATH"
  firebase emulators:start --only firestore --project hogaru-1-test
  ```

  Con eso corren los **nueve** ficheros de emulador (180 pruebas) y `npm run test:rules`
  (208). Ninguno de los dos entra en `npm test`, así que **un cambio en `firestore.rules` o
  en una callable puede pasar el gate normal y estar roto**: los cuatro bancos son
  `npm test` (1198), `npm --prefix functions test` (568), el emulador (180) y las reglas (208).

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

## El orden de despliegue no es fijo: depende de lo que haga el cambio

El de siempre es **reglas → functions → front**. Se invierte cuando la pieza restringe o cuando
una versión vieja rechaza lo que manda la nueva. En `PLAT-002` (25 ago 2026) fue **functions
→ front → reglas** en staging y **functions → reglas → front** en producción, y la diferencia
enseña que el orden se decide **por el delta contra ESE ambiente**, no por la ficha:

1. **Functions ANTES que el front**, en los dos. El front nuevo manda `tenantId` en las llamadas
   de IA y **las functions viejas lo RECHAZAN** (`tenant_en_la_peticion`). Al revés, la IA queda
   rota entera en la ventana intermedia.
2. **Las reglas al final SOLO en staging**, porque allí `storage.rules` llegó a exigir membresía.
   **Contra producción ese delta eran solo comentarios** —el intento se revirtió antes de subir—,
   así que `storage.rules` **no se desplegó** y las reglas pudieron ir en medio, que además evita
   la ventana en que la consola nueva no podría leer su colección.

> **De ahí la comprobación que hay que hacer siempre: diferenciar el ruleset DESPLEGADO contra el
> fichero del repo**, no `git diff` entre ramas. Se lee por la API de Firebase Rules con la ADC
> (no hay comando del CLI). Y por lo mismo, **`master` NO es el registro de lo desplegado salvo
> para el front**: reglas y functions salen del árbol de trabajo.

**Antes de desplegar una regla que restringe, medir el radio**: cuántos usuarios pierden acceso.
Salió cero en los dos proyectos — pero **el conteo bueno no es «tiene documento de membresía»**:
el predicado real exige además id `{tenantId}_{uid}`, campo `tenantId` concordante, rol de
administrador y estado activo. Se mide con `functions/scripts/medir-radio-membresias.mjs`, que
no escribe nada.

**El backend de App Hosting de STAGING no vigila ninguna rama** — su `codebase` no trae campo
`branch`—, así que **empujar no despliega el front**. Hay que crear el rollout a mano:

```bash
firebase apphosting:rollouts:create vivaru-staging-web --git-commit <sha> --force --project vivaru-staging-02
```

## Metodología

critique → execute → commit. Gate por incremento: typecheck limpio en `src/` **y** en `functions/` — este último con `npm --prefix functions run typecheck`, que es el que mira también `functions/tests/`. Mensajes de commit semánticos. Despliegue del front por push a `master`; functions por `firebase deploy --only functions` (recompilar antes — **no hay predeploy build**); el secret debe existir **antes** de desplegar funciones que lo referencian.

## Trampas críticas (ver `wiki-producto/wiki/decisiones/trampas-conocidas.md`)

- **Nunca importar `functions/` desde `src/` o `tests/`** — App Hosting hace `npm ci` solo en la raíz; rompe el `next build`. El cliente invoca Cloud Functions por nombre con `httpsCallable`.
- **CORS de callables:** `callableCorsOrigins` (en `functions/src/http-config.ts`; salió de `index.ts` en ago 2026 para que lo compartan los módulos nuevos) debe incluir el origen que sirve la app (`https://www.grupovivaru.com`). Síntoma de origen faltante: en logs solo `OPTIONS 204`, en navegador `net::ERR_FAILED`.
- **`unitId` de personas = doc id de la unidad, no el slug.** Usar el slug hace `updateDoc(units/<slug>)` sobre un doc inexistente → `permission-denied` engañoso ("No tienes permiso").
  **Desde el 26 de agosto de 2026 hay un resolvedor único con guarda** (`PRD-V-FIX-002`):
  `functions/src/clave-de-unidad.ts` y su espejo `src/lib/units/`. Toda escritura pasa por
  `claveDeUnidad(unidad)` y `tests/clave-de-unidad-guarda.test.ts` enrojece si alguien fabrica
  una clave desde el slug. **El dato está migrado en los dos ambientes.** Y **clasificar un
  identificador por su FORMA no funciona**: conviven `unit-t1-101`, `t1-101`, `1014` e ids
  sembrados que PARECEN slugs (`u-t1-101`). Solo el catálogo del conjunto sabe qué es cada valor.
- **`units` es una colección RAÍZ y su id de documento es GLOBAL.** Se filtra por `tenantId`, pero
  `units/t1-101` es uno solo para toda la base. Dos semillas declaraban los mismos cinco ids y la
  última se quedó el documento: a El Nogal le desaparecieron cinco unidades desde mayo, en los dos
  ambientes, con la membresía de un residente entre los huérfanos. **Todo id calculado lleva el
  conjunto por delante**, como `trial-seed.ts` con `${tenantId}--${local}`.
- **UNA REGLA DE FIRESTORE NO PROTEGE LO QUE ESCRIBE UNA CALLABLE.** Las callables van con **Admin
  SDK, que NO evalúa `firestore.rules`**. Cada vez que una regla sea la única palanca de un
  invariante, la pregunta obligatoria es **quién más escribe eso**. Costó `CF8`: `tenantOperable`
  vivía solo en las reglas, así que el producto se negaba a **facturarle** a un conjunto suspendido
  —crear un cargo es escritura directa del cliente— pero le dejaba **cobrar**. Reproducido con
  dinero de verdad en producción (`Privada Las Playas`, recibo `REC-HDFW4R`) y cerrado el 24 de
  agosto de 2026. El espejo del servidor es **`functions/src/tenant-status.ts`**
  (`assertTenantOperable`), y **si cambias uno hay que cambiar el otro**.
  **Y el orden dentro de un guardián importa:** el superadmin sale primero —necesita operar un
  conjunto suspendido para reactivarlo— y **el estado del conjunto se comprueba al final, después
  del rol**: al revés, a un no-miembro se le respondería «el período de prueba terminó» en vez de
  «no tienes permiso», filtrando el estado comercial de un cliente.
- **EL CATÁLOGO DE BANDERAS VIVE EN CINCO SITIOS, y su propia cabecera decía cuatro.** Los dos
  scripts se declaran «el cuarto» **cada uno**, contando listas distintas: `mover-bandera.mjs`
  enciende **global** y `mover-bandera-de-conjunto.mjs` enciende **por conjunto**. Añadir una
  bandera tocando solo cuatro la deja **imposible de encender por conjunto** — que es la vía del
  canario con la que se encendió el lote de Habitanto. Pasó con `producto-multiconjunto` el 25 de
  agosto de 2026, siguiendo al pie de la letra un comentario que estaba mal. **El grep va sobre
  una clave que ya funcione** (`grep -rln "producto-anticipos" functions/scripts src`), nunca
  sobre la lista escrita.
- **UNA REGLA DE STORAGE NO ES UNA REGLA DE FIRESTORE. Son DOS ficheros.** `firestore.rules`
  resuelve por membresía y `storage.rules` resolvía por **claim** (`delConjunto`), que es la base
  de `miembro`, `admin` y `porteria` — todas sus rutas. Con el selector de conjunto de
  `PLAT-002`, cambiar de conjunto dejaba Firestore abierto y **Storage cerrado entero**. La ficha
  había concluido «las reglas no necesitan un cambio» tras leer **uno solo**. **Cuando una
  conclusión empieza con un plural —«las reglas», «los catálogos», «las callables»— hay que contar
  cuántos son antes de firmarla.**
- **Y las reglas de Storage que leen Firestore (`firestore.exists`/`get`) NO se pueden dar por
  buenas con el emulador**: el emulador no es el servicio. Al 25 de agosto de 2026 esa
  verificación **sigue abierta** — ver la cabecera de `docs/pendientes.md`.
- **Las pruebas de emulador van de una en una** (`fileParallelism: false` en
  `functions/vitest.emulator.config.mts`). El emulador es UNO y cada `beforeEach` limpia colecciones
  **globales**, así que en paralelo las suites se borran los datos entre sí: da **fallos fantasma
  que cambian de sitio entre corridas**. Antes de culpar a un cambio propio, **medir la línea base**
  quitando el fichero nuevo.
- **Árbol duplicado en la raíz:** además de `src/`, hay `components/` y `features/` en la RAÍZ del repo. El portal residente importa de la raíz (p. ej. `components/features/resident/ResidentSecuritySection.tsx`, `features/resident/schemas.ts`). Verificar de cuál se importa antes de editar.
- **Aislar widgets/tableros con `WidgetErrorBoundary`** (`src/components/shared/widget-error-boundary.tsx`): toda sección de dashboard/tablero que consuma datos del tenant —en especial charts de **recharts**— debe ir envuelta, para que un fallo de un widget NO tumbe toda la ruta `/admin` (su `error.tsx` muestra "No pudimos cargar el workspace"). El único error boundary de ruta convierte cualquier throw de un widget en una pantalla de error global.
- **`writeAuditLog` revienta con un campo `undefined`, y audita FUERA de la transacción.** `initializeApp()` corre sin `ignoreUndefinedProperties`, así que un campo opcional ausente en el `metadata` hace que Firestore rechace la escritura **después de que la operación haya cuajado**: el dinero se mueve y la callable devuelve error. Pasó con `applyPayment` y un reparto (24 ago 2026). Al añadir un campo opcional al metadata de una auditoría, mandarlo siempre o limpiarlo antes.
- **Y una consulta de `documents` que haga un RESIDENTE tiene que filtrar por `category`**, por lo
  mismo. Desde el 24 de agosto de 2026 la regla le concede solo una lista blanca de categorías
  compartibles: los archivos de `monthlyFinancialArchive` —`financiero` y `reporte`— llevan
  **detalle por unidad** (la hoja «Morosos» dice quién debe y cuánto) y eran **32 de los 39**
  documentos de producción. **El consejo conserva todo**, porque `/admin/documents` es su única
  pantalla y consulta sin filtrar; **la portería pierde el acceso**, que tenía por `sameTenant`.
  Ojo con el mecanismo: `storage.rules` ya cerraba esas carpetas, pero el documento guarda un
  `fileUrl` con token de descarga que **se salta Storage**, así que la regla de Firestore era la
  única palanca.
- **Una consulta de `bankAccounts` que no haga un administrador TIENE que filtrar `active == true`.** Desde `FLOW-002` la lectura está abierta **al residente** —no a «los miembros»— y solo para cuentas activas, y Firestore evalúa la consulta contra la regla **sin ejecutarla**: sin ese `where` se rechaza entera aunque todas estuvieran activas. El saldo inicial vive aparte, en `bankAccountBalances`, y ese sí es solo-administrador. **La rama decía `tenantMember` hasta el 24 de agosto de 2026, y eso incluía a la portería y al consejo**: la PRD (§3) le da al `security_guard` «Nada / no puede Acceder», y la regla de `advances` evita `sameTenant` diciendo exactamente eso. Corregido a `tenantRole(..., 'resident')`.
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
- **Roadmap de producto:** `docs/roadmap-producto.md` — **el repositorio tiene el
  detalle y la historia.** Tres zonas con reglas distintas: el estado se REESCRIBE
  arriba, el cuerpo se EDITA en su sitio, y solo el changelog acumula (lo nuevo
  primero). **Nunca añadir «actualización del …» al final del cuerpo**: obliga a bajar
  y deja dos épocas conviviendo sin decir cuál manda — el defecto que tenía
  `wiki/modulos/pqrs.md` desde mayo de 2026.

  > **La página de Notion YA NO ES una copia de este fichero: es el TABLERO** (26 ago
  > 2026). Dejó de serlo porque como copia no funcionaba — llegó a **116.000
  > caracteres** y se quedó **trece versiones atrás** (0.9.19 contra 0.9.32), con el
  > 39% ocupado por un changelog duplicado del repositorio. Ahora son **6.900** y
  > responde a una sola pregunta: dónde está cada frente y qué lo mueve.
  >
  > **Los CUATRO artefactos, y no se mezclan:** el TABLERO dice dónde está cada
  > frente y se reescribe; el INVENTARIO dice qué iniciativas lo componen y qué frena
  > a cada una; la BITÁCORA dice qué se construyó y dónde corre, una fila por
  > entrega; el REPOSITORIO dice por qué se decidió así. **El historial no va al
  > tablero**, que es lo que lo hinchó.
  >
  > **El inventario es una base de Notion desde el 26 de agosto de 2026** —34 filas,
  > dentro de la página del tablero— y lleva la columna que el roadmap viejo no tenía:
  > **qué PRD cubre cada iniciativa**. Sin ella no se podía ir del tablero al trabajo
  > ni al revés, porque las épicas (`FIN-002`, `PH-001`) y las fichas
  > (`PRD-V-FLOW-001`) son dos vocabularios distintos para lo mismo.
  > Tres vistas: **Por horizonte** (tablero), **Lo vivo** (sin lo cerrado) y **Qué
  > está frenado, y por qué**. Y un horizonte nuevo, `CERRADA`, para que lo terminado
  > **salga** de los cuatro: el roadmap viejo tenía `FIN-001` y `REVOPS-001A`
  > marcados con ✅ dentro de la columna AHORA.
  >
  > **Y un hueco que tenían LAS DOS copias:** la tabla ejecutiva no listaba
  > «Propiedad horizontal», que es el frente donde ha ido todo el trabajo desde el 24
  > de agosto. El tablero de Notion ya lo tiene; **el de este fichero todavía no**.

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

**Leer los dos remotos con `git ls-remote`, no de aquí.** Esta línea llevaba el número de commit a
mano y se quedó corta **tres veces en una sola noche**: una cabecera que hay que actualizar en cada
push acaba mintiendo. Se mueven por separado y un push sin cambios responde «success». **`master`
= lo que hay en producción PARA EL FRONT**, y eso es lo normal buscado; entre despliegues `develop`
va por delante, que también es normal.

> **Y para reglas y functions `master` NO lo dice**, porque salen del árbol de trabajo con
> `firebase deploy`, no de una rama. Medido el 25 de agosto: el ruleset vivo venía de `a67088c`,
> un commit que **nunca llegó a `master`**. Lo desplegado se lee de su servicio — ver el bloque de
> orden de despliegue.

**DOS MVP ESTÁN EN STAGING Y NINGUNO EN PRODUCCIÓN, las dos veces POR DECISIÓN** (26 ago 2026):
`FLOW-001` (prorrateo de un egreso) y `FEAT-004` (estado de cuenta y paz y salvo), los dos
validados por navegador contra la base. **`FLOW-001` no sube porque ahí no puede correr** —0 de 88
unidades con coeficiente y 74 de 87 sin propietario—; **`FEAT-004` porque depende de `FIX-002`**.

> **Y EL HALLAZGO QUE MÁS LEJOS LLEGA NO ES NINGUNO DE LOS DOS: `unitId` ESTÁ PARTIDO EN DOS.**
> Conviven el **id del documento** de la unidad y su **campo `unitId`** (un slug), y hay documentos
> que no casan con ninguno. Medido: **34 de 88 unidades** con los dos valores distintos, **tres
> conjuntos de producción con las dos convenciones a la vez**, y **3.580.000 de deuda que ninguna
> pantalla suma** en `tenant-santa-maria`.
>
> **No fue una deriva accidental: fueron DOS migraciones en direcciones opuestas y ninguna tocó
> `tenantUsers`**, que es contra lo que `residentOwnUnit` compara — por eso quedó peor que antes.
> **Se manifiesta SIN error**: las reglas rechazan, no filtran, así que se ve como una lista vacía.
> Ficha propia: **`PRD-V-FIX-002`**, lista para desarrollo, y **bloquea de hecho a toda
> funcionalidad nueva que resuelva persona↔unidad** — `FEAT-004` pagó el peaje arreglando el paz y
> salvo **tres veces**.

**`PLAT-002` ESTÁ EN PRODUCCIÓN** desde la tarde del 25 de agosto de 2026 (`e41affa`), y con él
**el frente 4 queda cerrado y desplegado**: la sesión con varias membresías, el selector, la
entidad `managementCompanies` con su consola de superadmin, y las **dieciocho** comparaciones del
claim retiradas —la ruta del dinero resuelve por membresía—. Verificado contra su fuente: 77
functions en `ACTIVE`, el ruleset vivo con **0 líneas de diff** contra el fichero, y el front por
**procedencia del build**.

> **Está desplegado y NO se ve.** `producto-multiconjunto` está apagada y **su documento ni
> siquiera existe** (resuelve por `default_catalogo`); para encenderla, `seed-feature-flags.mjs`
> primero y `mover-bandera.mjs` en **GLOBAL** después. Y aunque se encienda, el selector se pinta
> con **dos membresías o más** y en producción **nadie tiene dos**, así que **CA1 sigue sin
> observarse**: está cumplido por construcción, no visto.

**`FLOW-002` (anticipos) ESTÁ EN PRODUCCIÓN Y ENCENDIDO EN LOS NUEVE CONJUNTOS** desde la madrugada
del 25 de agosto de 2026. Servidor, front, el «% de recaudo» de R16 midiendo liquidación, y los dos
cabos de `functions/` —`writeAuditLog` y la vista previa del reparto—. Trece criterios verificados
en pantalla contra la base real.

> **Esta línea decía «encendida solo en `conjunto-las-playas` (override; la global sigue apagada)»
> y quedó obsoleta al encender el lote.** El override **se retiró** al poner la global: dejar una
> excepción cuando la global dice lo mismo es ruido que alguien acabará leyendo como una diferencia.
> El documento del override sigue existiendo con `flags: {}` — es lo normal al borrar un campo.

**LAS SEIS BANDERAS DEL LOTE ESTÁN ENCENDIDAS** (`producto-plan-de-cuentas`,
`producto-registro-proveedores`, `producto-cobro-por-coeficiente`, `producto-concepto-al-libro`,
`producto-anticipos`, `producto-pago-multiple`), sin overrides y sin kill switches. **Se verificó
resolviendo con `functions/lib/feature-flags.js` compilado**, no leyendo documentos: la precedencia
—kill switch maestro, kill switch propio, override, global, default— no se lee de un campo.
**Y `producto-reservas-servidor` también, desde el 24 de agosto**: son **ocho** las encendidas en
los nueve conjuntos, sin overrides. Esta línea decía que seguía apagada porque «es el frente 3 y no
es un interruptor» — cierto entonces: encenderla era el paso 3, y detrás venía el 4, que cierra la
regla y no vuelve atrás. Los dos están hechos.

**PERO ENCENDER NO ES PONER EN USO, y esto costó descubrirlo.** Tres capacidades estaban activas
sobre tablas **vacías** en producción. El plan de cuentas se sembró el 24 (`0` → **189**
documentos, 21 por conjunto); **siguen vacíos el coeficiente (`0` de `88` unidades) y los
proveedores (`0`)**, y eso no es ingeniería sino captura de datos. La causa del primero es del tipo
que se repite: **el plan solo se siembra al CREAR un conjunto**, y los nueve son anteriores a la
funcionalidad — nunca hubo backfill. **Antes de contar una capacidad como entregada, preguntar
cuántas filas tiene la tabla que alimenta.**

**PRODUCCIÓN NO TIENE NI UN CLIENTE REAL. Ninguno, y ya no queda nada por confirmar.** Los nueve
conjuntos de `hogaru-1` son de demostración o de prueba interna: David confirmó el 24 de agosto de
2026 que **`Conjunto Bromelias` y `Queretarock 229` tampoco lo son**. Hasta entonces el roadmap, la
wiki de IA y la memoria hablaban de «dos conjuntos reales» contándolos a los dos, y la volumetría
del programa de IA se calculó sobre esa cuenta.

> **Los nueve conjuntos están marcados como de ejemplo (24 ago 2026).** `Queretarock` era el
> último que faltaba y ya está: `node functions/scripts/marcar-conjuntos-de-ejemplo.mjs hogaru-1`
> responde «No hay nada que marcar», y el script lista **0 conjuntos sin clasificar**. La ADC no
> estaba caducada, al contrario de lo que decía esta nota: lo que fallaba era otra credencial.

**EL CRITERIO DE PRIORIZACIÓN CAMBIÓ EL 24 DE AGOSTO DE 2026: cerrar frentes antes que abrirlos.**
Lo fijó David. La cola empezaba por `FIN-002` porque era el frente de ingeniería más grande
abordable sin clientes; con el criterio nuevo, abrirlo teniendo cuatro a medias es justo lo que no
hay que hacer, y **baja al final**. El orden vive en `docs/pendientes.md`.

**El frente 1 —encender las seis banderas— está HECHO** (25 ago 2026), y costó **cero código**. Su
runbook, `docs/encender-el-lote-habitanto.md`, lleva dentro lo que se vio en cada una y **tres
correcciones a lo que él mismo decía**: la comprobación de la bandera 1 no se podía hacer como
estaba escrita, la del coeficiente **no la comprueba el servidor**, y la de anticipos no baja ningún
recaudo el día que se enciende. **Después vino `FLOW-002` de verdad, y su `CF8` ya está cerrado.**

**El frente 2 —`FLOW-002` de verdad— arrancó por `CF8`, y `CF8` está CERRADO Y EN PRODUCCIÓN**
(24 ago 2026, `9f75083`). Se reprodujo primero **con dinero de verdad** sobre un conjunto
`suspended`, se falsó rompiendo el código a propósito en cuatro variantes, y se verificó por el
navegador en ese mismo conjunto. Del frente 2 quedan **`personId`** y **§9/CA13**, ninguno de
dinero. Detalle en `docs/pendientes.md`.

**Y una regla que sale de ahí:** una PRD **no se marca «EN PRODUCCIÓN» hasta que sus criterios
están cumplidos o movidos explícitamente a Fase 2**. Hoy esa etiqueta significa «el código está
desplegado», que no es lo mismo — así se marcó `FLOW-002` con tres criterios propios sin cumplir,
**uno de ellos de dinero**, y ese fue `CF8`.

**Esto baja el riesgo de encender banderas; no lo elimina.** El modo de fallo es el mismo el día
que haya un cliente — lo que cambia es a quién le pasa hoy.

**`docs/revision-flow-002-por-verificar.md` está CERRADO DEL TODO.** Se triaron las 37: **36 eran ciertas y están resueltas** —la última con una decisión de David: al consejo se le retiró la lectura de `advances`, que era detalle por unidad y no el total que le da la PRD, y el agregado pasa a `PLAT-004`— y **una se descartó** con números. No queda ninguna abierta. Antes decía que quedaban 16
sospechas y NINGUNA de gravedad alta.** Salen de una revisión adversarial de lo desplegado cuya
fase de jueces se cayó por sobrecarga de API. **No son defectos: son hipótesis con un solo par de
ojos** — pero **las seis triadas el 24 de agosto eran ciertas las seis**: el anticipo nacía con la
bandera apagada y congelado, `bankAccounts` estaba abierta a la portería, el informe automático
mensual seguía con la fórmula vieja del «% de recaudo» **en tres sitios** más su gemelo manual, el
ajuste a mano de un cargo sin línea propuesta se tiraba al enviar, y la pantalla anunciaba el
importe entero como sobrante mientras la vista previa no había llegado. El otro que llegó a tener sus tres votos también
era real y está corregido: dos guardianes de `aplicarPago` rechazaban cobros **correctos** con
centavos. Ver `aMoneda` y `TOLERANCIA_MONEDA` en `functions/src/payments.ts`.

**`FLOW-002` ESTÁ CERRADA ENTERA desde el 24 de agosto de 2026.** Esta sección listaba tres
criterios sin cumplir; los tres cayeron el mismo día:

- **CF8** (`9f75083`) — ver la trampa de más arriba: `assertTenantOperable` vive ahora en
  `functions/src/tenant-status.ts` y la llaman los dos guardianes locales.
- **§9 y CA13** (`c05b274`) — el aviso del recibo nombra los cargos cubiertos y el saldo a favor.
  Lógica de texto en `functions/src/aviso-recibo.ts`. **Dos trampas que dejó:** el id de una
  operación de PAGO en `paymentOperations` va **sin prefijo de conjunto** (al revés que las tres de
  `advances.ts`), y escribirlo con prefijo dejaba el aviso degradando **en silencio** con las
  pruebas unitarias en verde; y **cada variable del catálogo lleva la oración entera**, porque
  `interpolate` borra el token vacío pero no el conectivo que lo rodea.
- **`personId` RETIRADO del contrato**, no construido. El anticipo es de la **unidad** y no lleva
  ningún dato personal; la PII de quien paga vive en `paymentVouchers` y ya caduca a los 12 meses.

**Lo único que `FLOW-002` ya no persigue es el total de anticipos del consejo, en `PLAT-004`.**

> **El primer sobrepago de producción se ejecutó ese día**, verificando de paso R4 —el recaudado
> sube solo lo que fue al cargo— y **CA7**: el asiento del anticipo nace con `sourceType: "advance"`.

**Y el catálogo de avisos tiene por fin guardián.** Vive duplicado en `functions/` y en `src/`, su
cabecera lleva desde siempre diciendo «las cadenas deben mantenerse en sincronía» y **nada lo
comprobaba**. Ahora sí (`functions/tests/notification-catalog-espejo.test.ts`), comparando como
texto porque los dos lados no pueden importarse.

**`bankAccounts` cambió de alcance, y eso hay que saberlo antes de tocar finanzas.** Lo lee ahora
**el residente, y solo las cuentas activas** — lo pide CA11. Esta línea decía «los miembros del
conjunto», que era literal: la regla usaba `tenantMember` y con ella entraban **la portería y el
consejo**, a los que la PRD no les da nada de esto. Reproducido contra el emulador y corregido el
24 de agosto de 2026. Para poder abrirlo,
`openingBalance` **salió del documento** a `bankAccountBalances/{idDeLaCuenta}`, que sigue siendo
solo-administrador: las reglas conceden el documento entero y no se pueden ocultar campos. **Una
consulta de cuentas hecha por alguien que no es administrador TIENE que filtrar `active == true`**,
o Firestore la rechaza entera. Y **el rollback no es solo apagar banderas**: volver atrás exige
devolver `openingBalance` a `bankAccounts` ANTES de revertir las reglas.

**`FIX-001`: EL MVP ESTÁ COMPLETO Y EN PRODUCCIÓN** (24 ago 2026, `a67088c`).
`producto-reservas-servidor` **encendida en los nueve** y **la rama del residente RETIRADA del
`create` de `reservations`**: un residente ya no crea por escritura directa, pasa por
`createReservationRequest`. El administrador conserva la suya y el residente sigue cancelando la
propia (la rama de `update` no se tocó). **El paso 4 no se revierte con bandera**: el rollback es
redesplegar las reglas anteriores. Queda la entrega 2 (política por área), que es Fase 2.

> **Y cómo se cruzó la puerta, porque la lección vale más que el paso.** El instrumento es
> `scripts/verificar-reservas-por-servidor.mjs`, y recién encendida la bandera dijo **«PUERTA
> ABIERTA» sobre CERO reservas** — con cero clientes reales esa condición se cumple sola. **Una
> puerta que se abre sobre un conjunto vacío no verifica nada.** Se le dio contenido reservando a
> propósito desde el portal del residente en producción, y entonces sí midió.

**LA JORNADA DEL 24 ESTÁ DESPLEGADA (24 ago, noche).** Los cuatro commits que cierran la revisión
adversarial salieron en las tres piezas y **en este orden**: `firebase deploy --only
firestore:rules` → recompilar y desplegar functions → push a `master`. Las reglas fueron primero
porque son las que **arreglan que la conciliación no pudiera casar ningún pago**; el front ya
asumía el comportamiento nuevo. **Este orden se repite en cualquier ambiente nuevo.**

**Y se verificó, pieza por pieza, en vez de creerle al «Deploy complete».** Las reglas con las
pruebas de `npm run test:rules:all`, **que `npm test` EXCLUYE** —eran 227 y son **237** el 24 de
agosto: este número crece, así que hay que contarlo, no citarlo de aquí—; las functions comparando
**por nombre** las desplegadas contra `index.ts` (75 y 70 el 24 de agosto; lo que importa no es la
cifra sino que **no falte ninguna del código**), con el árbol en cero tras `run build`; y el front con
**la huella del bundle**, porque este CLI **no tiene `apphosting:rollouts:list`**: los chunks de
`/_next/static/` cambiaron de `6a944c17` a `2bc73d04` siete minutos después del push. La huella es
mejor que un grep — **un grep encuentra la cadena en las dos versiones**.

**§13 comprobado en producción con números anotados antes**, no razonado: un cobro del saldo exacto
sobre `T2-203` movió los seis que tenía que mover y **dejó los anticipos en $0**, que es la medida
que prueba que la ruta de un solo cargo no cambió. Detalle en `docs/pendientes.md`.

> **Un cobro normal MANDA CORREO.** El recibo nace dentro de la transacción, así que `applyPayment`
> crea el `paymentVouchers` y eso enciende `onPaymentVoucherCreated`, que notifica **a los
> residentes de la unidad pagadora**. Antes de cobrar en un conjunto, mirar a qué direcciones.

Estado vivo y detalle: `docs/pendientes.md`, `docs/roadmap-producto.md` (0.9.25),
`docs/despliegue-flow-002-produccion.md` y la PRD (v1.5).

### Lo que ninguna suite puede cazar, y por qué importa aquí

**1097 pruebas del front y 456 de functions estaban EN VERDE mientras el informe mentía.** No es
un fallo del banco: el defecto vivía en **la forma de la consulta contra un índice que solo
existe en la nube**, y ninguna prueba unitaria lo alcanza. La regla que sale de esto:

- **Una consulta con `orderByField` necesita su índice compuesto, Y EN LA DIRECCIÓN QUE PIDE.**
  Tener `(tenantId, campo ASC)` no sirve para un `orderBy campo desc`. `reservations` tiene las
  dos direcciones y funciona; `visitorPasses`, `tickets` y `committee_agreements` tenían solo
  ASC y fallaban. **Antes de añadir un `orderByField`, comprobar el índice en las dos.**
- **Y un campo OPCIONAL en el `where` son DOS consultas, cada una con su índice.** La campana de
  notificaciones filtra por `tenantId` solo si existe: con conjunto usa
  `(userId, tenantId, createdAt)` y funciona; **sin conjunto —el superadmin— pide
  `(userId, createdAt desc)`, que no existe**, y ese índice compuesto no puede suplirlo porque
  `tenantId` va en medio. Al 24 de agosto de 2026 faltan **tres** índices en producción:
  `notifications`, `billingReminderJobs` y `billingSchedules` — los dos últimos estaban anotados
  como «faltan en staging» y faltan también aquí. **`--only firestore:rules` NO despliega
  índices.**
- **El patrón que no depende de índices es `watchLedger`**: pedir sin ordenar y ordenar en
  memoria. Es lo que hace `/admin/finanzas`, y por eso fue el único que nunca se rompió.
- **Un `catch` que deja la lista vacía convierte un fallo ruidoso en un dato falso.** Si una
  pantalla puede fallar a medias, tiene que **decirlo en pantalla y en el PDF**.
- **Y un `orderBy` DESCARTA los documentos que no traen ese campo — sin error, sin aviso.** No
  hace falta un `catch` para que una lista mienta. La de documentos del residente ordenaba por
  `uploadedAt`, que **la subida real nunca escribe** (38 de 39 no lo tenían), y enseñaba «Sin
  documentos» teniendo ocho. **Antes de ordenar por un campo, comprobar que TODOS los documentos
  lo traen** — y si no, el patrón bueno es pedir sin orden y ordenar en memoria, como
  `watchDocuments` y `watchLedger`. Corregido el 24 de agosto de 2026.
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
