---
tags: [decision, trampas, bugs, antipatrones]
tipo: decision
fuentes: ["DESIGN.md", "PRODUCT.md", "consolidacion-landing-2026", "sesion-cartera-crm-2026-06"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-08-22
---

# Trampas Conocidas

Errores que han ocurrido o que tienen alta probabilidad de ocurrir durante el desarrollo. Documentados para no repetirlos.

## Un widget que falla tumba todo /admin (sin aislamiento)

La ruta `/admin` tiene un único error boundary de nivel ruta (`src/app/(admin)/admin/error.tsx`), que muestra "No pudimos cargar el workspace de administración". Si **cualquier** widget/tablero de una página lanza durante el render (típico: un chart de **recharts** con un dato límite, o un `Intl.NumberFormat` con `currency` undefined), el error sube hasta ese boundary y **toda la interfaz de /admin se cae**, no solo el widget. Pasó en Cartera al poblar los tableros financieros (Liquidez, Cuentas por pagar, Flujo de caja). Regla: envolver toda sección de dashboard/tablero que consuma datos del tenant en `WidgetErrorBoundary` (`src/components/shared/widget-error-boundary.tsx`) para degradar el widget y mantener viva la página. Ver [[layout-patterns]] y [[billing]].

## Las reglas de Firestore no son filtros: query sin `tenantId` = permission-denied

Consultar una colección con regla por-tenant (`tenantAdminOrSuper(resource.data.tenantId)`) filtrando **solo por otro campo** (p. ej. `where("surveyId","==",id)` en `survey_responses`) hace que Firestore **deniegue toda la query**: no puede garantizar que todos los resultados sean del tenant permitido (las reglas no filtran, evalúan). Síntoma: `permission-denied` / "No fue posible cargar los resultados" aunque el Admin SDK sí lea los datos. Regla: toda query cliente a una colección tenant-scoped debe incluir `where("tenantId","==",tenantId)`. Pasó con `getSurveyResults`. Ver [[encuestas]] y [[firebase-firestore]].

## Tenant sin `currency` rompe formateadores

Un tenant creado por seed/alta sin el campo `currency` (`COP`|`MXN`|`USD`) hace que cualquier `Intl.NumberFormat(..., { currency })` reciba `undefined` y lance "Invalid currency code". Regla: el alta/seed siempre escribe `currency`; los hooks de formato (`useTenantCurrency`) defaultean a un valor válido. Ver [[multi-tenancy]] y [[billing]].

## replace_all con acentos

Usar `replace_all` con palabras acentuadas en el editor puede corromper plurales o palabras que comparten la raíz. Ejemplo: reemplazar `"configuración"` puede afectar `"configuraciones"`. Siempre proporcionar suficiente contexto en el string a reemplazar para que sea único.

## authorizationType sin acento

El valor `"larga_duracion"` en `authorizationType` NO lleva acento (es `duracion`, no `duración`). Si se escribe con acento en el código, la comparación falla silenciosamente. Ver [[domain-types]].

## Locale: siempre es-CO, nunca es-MX en código

El locale para fechas y números en el código es `es-CO`, nunca `es-MX`. El comportamiento en producción: aunque hay una inconsistencia histórica (`toLocaleDateString` usa `es-MX` en algunos lugares), el estándar a seguir en código nuevo es `es-CO`. Ver [[product-md]] para el tono de voz.

## React.forwardRef obligatorio

Cualquier componente de input usado con React Hook Form necesita `React.forwardRef`. Sin esto, `register()` falla silenciosamente y los campos no se validan. Ver [[form-validation]].

## Git locks desde sandbox

Al operar desde el sandbox del agente, si se intenta hacer push directamente se generan archivos `.git/HEAD.lock` y `.git/index.lock` que corrompen el repositorio. El usuario siempre debe hacer el push desde su terminal local.

## Sticky no confiable en iOS Safari

`position: sticky` en iOS Safari tiene comportamiento inconsistente bajo scroll con momentum. La solución establecida es `position: fixed` con `padding-top` equivalente al alto del header. Ver [[mobile-first-ios]].

## overflow-x: hidden rompe sticky

Usar `overflow-x: hidden` en `<html>` o en contenedores ancestros crea un nuevo scroll container que rompe `position: sticky` en todos los descendientes. Usar `overflow-x: clip` en su lugar. Ver [[mobile-first-ios]].

**Arreglarlo en un solo elemento no basta, y así estuvo meses.** `html` tenía `clip` con un comentario explicando exactamente por qué, pero `body` conservaba `hidden`: con que uno de los dos cree el scroll container, el arreglo queda anulado. Consecuencia medida en producción en agosto de 2026: el header del landing, declarado `sticky top-0`, se iba con el scroll. Nadie lo había notado porque no rompe nada visible, solo deja de hacer algo.

Al tocar esto, comprobar **los dos**:

```bash
grep -n -A5 "^body {\|^html {" src/app/globals.css | grep overflow-x
```

Y verificarlo midiendo, no mirando: `getBoundingClientRect().top` del header tras hacer scroll. Si vale el negativo del scroll, no está fijo. Cuidado además con la caché del navegador en desarrollo: el chunk de CSS conserva el nombre aunque cambie el contenido, así que puede seguir sirviendo la versión anterior mucho después de recompilar.

## Transiciones con 'all'

El uso de `transition: all` está prohibido per [[absolute-bans]], pero algunos componentes viejos todavía lo tienen. Al tocar un componente existente, verificar y reemplazar por propiedades específicas. Ver [[animaciones]].

## Tailwind v4: @utility no sobreescribe tokens --spacing-*

En Tailwind v4, `@utility max-w-xl { max-width: 36rem; }` **no funciona** para sobreescribir un token `--spacing-xl` del `@theme`. Tailwind fusiona ambas declaraciones en un solo bloque CSS y la del token siempre gana por aparecer última:

```css
/* CSS generado — la segunda declaración siempre gana */
.max-w-xl { max-width: 36rem; max-width: var(--spacing-xl); }
```

La solución correcta es usar selectores scoped con mayor especificidad (`.marketing-theme .max-w-xl`), que también son CSS no-layered y superan `@layer utilities`. Ver [[tailwind-v4-spacing-fix]] para el diagnóstico completo y el fix en producción.

## Tailwind v4: nombres de clases de color en kebab-case

En Tailwind v3, el config generaba `bg-brand-greenResident` desde la clave `greenResident`. En Tailwind v4, la clase se genera desde el nombre de la variable CSS: `--color-brand-green-resident` → `bg-brand-green-resident`. Los nombres camelCase del v3 generan clase vacía sin error. Siempre verificar kebab-case en nombres de color al migrar desde v3. Ver [[tokens-color]].

## CORS de Cloud Functions callable (jun 2026)

Las callables que fijan `cors: callableCorsOrigins` (`createTenantAdmin`, `createTenantOperationalUser`, `provisionResidentTemporaryAccess`, `completeResidentPasswordChange`) **rechazan orígenes no listados**. Síntoma exacto: en los logs solo aparece `OPTIONS 204` (preflight) y ningún `POST`; en el navegador, `net::ERR_FAILED`. El dominio que sirve la app (`www.grupovivaru.com`) debe estar en `callableCorsOrigins` o todas esas operaciones fallan en silencio. Ver [[autenticacion-roles]]. **Desde agosto de 2026 la lista vive en `functions/src/http-config.ts`**, no en `index.ts`: la sacó de ahí la [[puerta-ia]] para poder compartirla sin importar el índice entero.

## unitId de personas: doc id, no slug

`createUnit` crea el doc de unidad con **ID autogenerado** y guarda un slug en el campo `unitId`. La persona debe referenciar el **doc id** (`createdUnit.id`), no el slug. Si se guarda el slug, `createPerson`/`deletePerson` hacen `updateDoc(units/<slug>)` sobre un doc inexistente → la regla evalúa `tenantId` indefinido → `permission-denied` ("No tienes permiso"). Por eso los borrados de unidad ahora son *best-effort*. Ver [[firebase-firestore]] y [[usuarios]].

## Functions: recompilar y fijar secret antes de deploy

El bloque `functions` de `firebase.json` no tiene `predeploy`, así que `firebase deploy --only functions` sube el `lib/` ya compilado. Si no se corre `npm --prefix functions run build` antes, se despliega código viejo y el deploy dice "sin cambios". Además, una función que referencia un secret (`RESEND_API_KEY`) **no despliega** si el secret no existe: hay que `firebase functions:secrets:set` **primero**, luego desplegar. Ver [[correos-mensajeria]].

## URL de acción personalizada de Firebase Auth

Para que el enlace de los correos abra `/restablecer`, se fija la URL de acción global en Authentication → Templates. Falla con "Se produjo un error al actualizar la URL de acción" si: el dominio no está en **Dominios autorizados**, o la cuenta de consola no es **Owner/Editor** del proyecto. Es un ajuste global (aplica a todas las plantillas). Ver [[correos-mensajeria]].

## Nunca importar functions/ desde src/ o tests/

App Hosting hace `npm ci` solo en la raíz (sin `functions/node_modules`), así que importar código de `functions/` desde `src/` o `tests/` rompe el `next build` con "Cannot find module 'firebase-admin/...'", aunque el build local pase. El cliente invoca las Cloud Functions por nombre vía `httpsCallable`, nunca importando su código. Ver [[stack-tecnico]]. Consecuencia que costó descubrir: **las funciones no se pueden probar desde `tests/` de la raíz**. Desde agosto de 2026 tienen banco propio en `functions/tests/`, con su `vitest.config.mts` para no heredar la configuración de la raíz.

## subscribeTenantCollection no serializa Timestamps

El helper hace `{ id, ...doc.data() }` crudo: los campos `serverTimestamp` (p. ej. `BillingCampaign.sentAt`) llegan como **Firestore Timestamp**, no como string. Renderizarlos directo en JSX lanza "Objects are not valid as a React child", y pasarlos a un formateador que hace `.split("-")` también revienta. Usar un formateador defensivo que detecte `.toDate` (`formatSentAt` en [[cartera-campanas|Cartera]]). Ver [[firebase-firestore]].

## Cartera: el flag `archived` se filtra SOLO en las tablas vivas

Archivar un período de [[billing|cartera]] pone `archived=true` pero **no borra**. El filtro de `archived` debe aplicarse únicamente en la tabla viva del admin (a nivel página). El hook `useBillingStatements` conserva su firma; el gráfico histórico, `cuotaIncome`, los tableros, el [[reportes|reporte de comité]] y la vista del [[portal-residente]] leen el set completo. Si se filtra `archived` en el hook o en esos consumidores, se pierde el análisis por período y el residente deja de ver su deuda. La mora de meses cerrados vive en la pestaña Cartera vencida — ver [[cartera-campanas]].

## Storage: las reglas SUMAN, no existe la regla que quita

Al contrario que la intuicion, un `match` mas especifico en `storage.rules` **no recorta** lo que concedio uno mas ancho: los permisos se unen. Mientras exista una concesion sobre `tenants/{tenantId}/**`, ninguna regla de una subcarpeta puede cerrarla — solo puede anadir. Por eso `FIN-000` (ago 2026) no "endurecio" la regla ancha: la **elimino** y concedio carpeta a carpeta, con la consecuencia deliberada de que **una carpeta nueva nace cerrada** hasta que se la nombre. Corolario que muerde en el cliente: `getDownloadURL()` pasa por `allow read`, asi que quitarle la lectura a quien sube un archivo **rompe la subida** en la linea siguiente — es lo que obligo a segmentar `payment-receipts/` y `support/` por `uid` en vez de dejarlas sin lectura. Ver [[pruebas-reglas-emulador]] y [[multi-tenancy]].

## Auditar reglas: `write` es azucar de `create+update+delete`

Comparar dos versiones de `firestore.rules` contando lineas o diffeando en crudo produce **falsos positivos con signo invertido**: una regla que pasa de `allow write` a `allow create, update` + `allow delete` aparece como si hubiera perdido `write`, cuando la cobertura es la misma o mayor. Paso el 18 de agosto de 2026 auditando un stash de tres semanas: dos "perdidas" detectadas (`featureFlags` y `leads`) resultaron ser descomposiciones — en `featureFlags` para **anadir** validacion de tipos, y en `leads` para **abrir** `update` a superadmin. Regla: al auditar reglas, normalizar a `coleccion → {operaciones}` expandiendo `write` en sus tres, y leer las diferencias que sobrevivan **en pantalla**, no por conteo. Ver [[firebase-firestore]] y [[pruebas-reglas-emulador]].

## Colecciones nuevas: desplegar reglas antes del front

Cuando el front empieza a escribir una colección nueva (`billingCampaigns`, `billingSchedules`, `billingReminderJobs`) o a llamar `ensureSystemFolder` con una clave nueva, hay que **desplegar reglas/functions ANTES** del push del front (App Hosting). Si no, la primera escritura del usuario cae en `permission-denied` o `invalid-argument`. Secuencia segura: deploy de reglas + functions → luego push de `master`. Ver [[firebase-firestore]] y [[correos-mensajeria]].

## RHF getValues() NO aplica el transform de zod

Con `zodResolver`, los `.transform()` del schema solo corren vía `handleSubmit`. Un flujo que hace `trigger()` + `getValues()` recibe los valores **crudos** — así se colaron torres sin normalizar a Firestore pese a existir transform. Regla: toda normalización crítica va en la **capa de servicios** (chokepoint de escritura), no solo en el schema. Ver [[torres-canonicas]].

## Errores auth/* sin mapear parecen caída de plataforma

`normalizeFirebaseError` no incluía los códigos de Firebase Auth: cualquier contraseña incorrecta en el login mostraba "Ocurrió un error inesperado" y los usuarios reportaban la plataforma como caída. El mapa ya incluye `invalid-credential`, `user-not-found`, `too-many-requests`, etc. Al agregar flujos de auth nuevos, mapear sus códigos primero. Ver [[autenticacion-roles]].

## Fallbacks que incrustan IDs se denormalizan para siempre

El fallback `${tower}-${unitId}` de `activateResidency` contaminó reservas, paquetería y notificaciones con compuestos tipo `torre1-<docId>` — y las notificaciones son inmutables. Un fallback de texto visible **jamás** debe incrustar un ID; usar un valor legible y dejar que [[resolucion-unit-id]] resuelva en lectura.

## Dominio custom en 403 con config "en verde"

Un custom domain de App Hosting puede quedar `HOST_ACTIVE/CERT_ACTIVE` y aun así devolver 403 en el edge (enrutamiento interno roto tras rollout). No es DNS ni cert: el fix es recrear el dominio (delete+create+TXT nuevo). La URL directa `*.hosted.app` es el acceso de contingencia. Runbook completo en [[dominios-app-hosting]].

## Las reglas de Storage SUMAN permisos, nunca los restan

Una regla más estricta sobre un subcamino no limita nada: es un permiso **adicional**. No hay forma de hacer que `tenants/{id}/support/**` sea más restrictivo que `tenants/{id}/**`. Por eso el tope de 5 MB de los adjuntos de [[soporte]] vive en la callable, no en las reglas — y ahí resultó mejor, porque el servidor lee tamaño y tipo **reales** del archivo ya subido en vez de creerle al cliente. Distinto de Firestore, donde las reglas sí deniegan.

## Las reglas de Firestore tampoco filtran campos

Un permiso de lectura sobre un documento expone **todos** sus campos. No existe «leer el documento menos este campo». Por eso las notas internas de [[soporte]] son una subcolección y no un campo: como campo, el cliente las vería. Regla general: si un dato no es para todos los que pueden leer el documento, no va en el documento.

## Callables v2 nuevas nacen sin invoker público

En este proyecto, una callable v2 recién creada no obtiene invocación pública por defecto: Cloud Run devuelve **401 antes de ejecutar una línea**, y los logs de la función no muestran nada porque nunca llegó a correr. Hay que declarar `invoker: "public"` en la definición, como el resto de callables. Se perdió una ronda entera de diagnóstico buscando el fallo en el código.

## `getFirestore()` en el top level de un módulo de functions

Se evalúa al cargar el módulo, antes de que la app de Firebase esté inicializada, y tumba el despliegue entero de functions. Hacerlo perezoso (`getDb()` que llama `getFirestore()` dentro). Ver [[firebase-firestore]].

## Endurecer reglas rompe consolas internas sin avisar

Al prohibir la escritura directa en `supportTickets`, la bandeja del [[superadmin]] —que escribía así— quedó inoperante. Ninguna prueba lo detectó y la interfaz no daba error visible. Al cerrar permisos de una colección, **buscar todos los escritores**, incluidas las herramientas internas, no solo el portal del cliente.

## `PATCH` de la REST de Firestore sin `updateMask` reemplaza el documento

Borra todo campo no incluido en el cuerpo. Además, las rutas de campo con guiones necesitan comillas invertidas: `seen.\`portal-porteria\``. Afecta a los scripts de verificación, no a la app.

## `apphosting.yaml` va en las DOS direcciones

Cada rama tiene su propio `apphosting.yaml` y ninguna debe adoptar el de la otra: `develop` apunta entero a `vivaru-staging-02`/`staging`, `master` a `hogaru-1`/`production`. El archivo **nunca se fusiona**; se conserva el de la rama destino.

Las dos direcciones muerden, y la segunda es la que se olvida:

- **`develop` → `master`**: arrastraría staging a producción. Es la conocida.
- **`master` → `develop`**: arrastra producción a staging. Ocurrió el 2026-08-01 al sincronizar ramas tras un despliegue. El merge fue **fast-forward**, así que no hubo conflicto ni aviso: `develop` quedó apuntando a `hogaru-1` en silencio, y el siguiente build de staging habría escrito en producción. Se detectó al verificar el archivo después del merge, no durante.

La lección es que «Automatic merge went well» **no es una verificación**. Tras cualquier merge entre estas dos ramas, comprobar el archivo:

```bash
grep -A1 NEXT_PUBLIC_FIREBASE_PROJECT_ID apphosting.yaml
grep -n "value: staging\|value: production" apphosting.yaml
```

Ver [[dominios-app-hosting]] y [[ciclo-de-vida-tenant]].

## Una prueba que no se ejecuta es peor que ninguna

`tests/firestore.rules.test.ts` pasó meses sin correr porque el emulador no arrancaba sin Java, y sus fallos se archivaban como «preexistentes». Ocupaba el lugar mental de la verificación sin hacerla. Al encenderlo apareció una prueba de [[reservaciones]] rota desde hacía meses. Cómo correrlo y sus dos trampas: [[pruebas-reglas-emulador]].

## Cambiar `tenants.status` no actualiza la sesión abierta

Un cliente recién activado sigue viendo la interfaz de prueba —días restantes, botón de suscripción, módulos bloqueados— hasta que su sesión se renueve. El cambio estaba bien aplicado; lo que fallaba era suponer que se propagaba solo. Verificar contra Firestore, no contra la pantalla. Ver [[ciclo-de-vida-tenant]].

## Una señal de progreso debe ser legible por el rol que la dispara

El paso de pago de [[onboarding-guiado]] apuntaba a `paymentReceipts`, colección que solo crea el residente y que el administrador no puede leer: devolvía 403 en silencio. Con esa señal, todo cliente se habría quedado a un paso del final para siempre. Antes de elegir una colección como señal, comprobar que el rol que ve el indicador tiene permiso de lectura.

## El landing NO hereda de `DESIGN.md`

Hay **dos sistemas de color** en el repositorio y se parecen lo suficiente como para confundirlos:

- `DESIGN.md` describe la **aplicación**: fondo `#f4f7fb`, tintes sky/mint/peach/sand/lavender, brand navy `#0b3c5d`.
- El **landing** tiene su propio bloque `.marketing-theme` en `globals.css`: fondo **`#FFFFFF`**, texto `#0F172A`, borde `#E2E8F0`, primario `#4B5FD4`, acentos ámbar `#D97706`, teal `#0891B2`, verde `#16A34A` y morado `#7C3AED`.

Verificado en producción: las secciones del landing se pintan sobre `rgb(255,255,255)`. El `#f4f7fb` que se ve al inspeccionar el `<body>` está **debajo** del landing y no llega a verse.

Diseñar el landing con los tokens de la aplicación costó dos iteraciones completas de un boceto en agosto de 2026. Antes de tocar `src/components/marketing/`, leer el bloque `.marketing-theme`, no `DESIGN.md`. Ver [[tokens-color]] y [[landing-marketing]].

## El landing no tiene modo oscuro

`DESIGN.md` lo dice explícitamente: *«No dark mode tokens defined»*. Ni el landing ni la aplicación lo tienen. Añadir `prefers-color-scheme` o variantes `dark:` a un componente de marketing hace que la página se oscurezca en navegadores configurados en oscuro y represente algo que el producto no hace. `tests/landing-contract.test.ts` lo comprueba.

## `.marketing-theme .max-w-*` gana a cualquier variante responsive

`globals.css` corrige el bug de `--spacing-*` redeclarando las anchuras dentro del scope del landing:

```css
.marketing-theme .max-w-lg { max-width: 32rem; }
```

Esa regla tiene especificidad `0,2,0`. Una utilidad responsive como `lg:max-w-none` o `lg:max-w-3xl` tiene `0,1,0`, **así que no gana nunca**: la clase aparece en el marcado, se ve en el DOM y no hace nada. Solo afecta a `max-w-xs`, `sm`, `md` y `lg`, que son las redeclaradas; `max-w-3xl` suelto sí funciona, lo que hace el fallo más desconcertante.

Costó una ronda de diagnóstico en el rediseño de Perspectivas: la captura seguía clavada en 512px con `lg:max-w-none` puesto. La salida es no usar `max-w-*` ahí y dejar que el ancho lo ponga la columna de la rejilla. Ver [[tailwind-v4-spacing-fix]].

## Tailwind v4 escribe `scale-*` en la propiedad `scale`, no en `transform`

`getComputedStyle(el).transform` devuelve `none` con `scale-110` aplicado, porque v4 usa la propiedad independiente `scale`. Medir `transform` para comprobar si una escala se aplicó da un falso negativo. Leer `.scale`.

## Relaciones

- Véase también: [[absolute-bans]], [[mobile-first-ios]], [[form-validation]], [[tailwind-v4-spacing-fix]], [[autenticacion-roles]], [[correos-mensajeria]], [[cartera-campanas]], [[fusion-unidades]], [[triaje-auditoria-ux]], [[kpis-formula-unica]], [[soporte]], [[ciclo-de-vida-tenant]], [[pruebas-reglas-emulador]]
- Depende de: —
- Se conecta con: [[animaciones]], [[domain-types]], [[firebase-firestore]], [[stack-tecnico]], [[tokens-color]]

## Fuentes

- [[design-md]], [[product-md]], [[consolidacion-landing-2026]]

## App Hosting apaga el optimizador de imágenes de Next

`/_next/image` responde **404** en staging y en producción, y el HTML sale con `src="/product/x.webp"` a pelo, sin `srcset`. No es un fallo del código: `@apphosting/adapter-nextjs` **reescribe `next.config.ts` durante el build en la nube** (guarda el original como `next.config.original.ts`) e inyecta `images.unoptimized = true`. Con `unoptimized` la ruta `/_next/image` ni siquiera se genera, de ahí el 404.

El adaptador solo respeta la configuración propia si el archivo declara **explícitamente** `images.unoptimized` o `images.loader`; cualquier otra clave —`formats`, `minimumCacheTTL`, `deviceSizes`— la ignora al decidir. Declarar `formats: ["image/avif","image/webp"]` no protege de nada.

La trampa de diagnóstico: **en local no se reproduce**. `next build` en la máquina sí emite el `srcset` completo con URLs `/_next/image?url=...&w=...&q=75`. La divergencia solo existe desplegado, así que hay que comprobarlo contra el dominio:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://www.grupovivaru.com/_next/image?url=%2Fproduct%2Fperspectives-admin-cartera.png&w=1200&q=75"
```

Consecuencia práctica: **no hay red de seguridad en runtime**. El byte que está en `public/` es el byte que descarga el visitante, al tamaño que esté. Por eso `public/product/` se sirve ya redimensionado y en WebP (`npm run images:optimize`, ver [[landing-marketing]]); antes eran PNG @2x de hasta 2880px —7,6 MB— para tarjetas que se pintan a 300-770 px.

Las dos salidas si algún día se quiere optimización de verdad: declarar `images.unoptimized: false` (el servidor de Cloud Run haría el trabajo con sharp — ojo al `memoryMiB: 512` de `apphosting.yaml` frente a capturas de 2880px), o un `images.loader` propio apuntando a la extensión Image Processing de Firebase, que es lo que Google recomienda hoy. Ninguna de las dos hace falta mientras los assets salgan ya optimizados. Ver [[landing-marketing]] y [[dominios-app-hosting]].

## El proyecto activo de gcloud es PRODUCCIÓN

`gcloud config get-value project` devuelve `hogaru-1`, que es producción. Cualquier comando de `firebase` o `gcloud` sin `--project` explícito opera sobre datos reales creyendo que es una prueba. **Todo comando lleva el proyecto escrito**, incluidos los de solo lectura, porque el hábito es lo que protege el día que el comando sí escribe. Mismo criterio que ya obligó a `FIREBASE_PROJECT_ID=vivaru-staging-02` delante de los sembradores. Ver [[multi-tenancy]].

Y el nombre del conjunto **no distingue el ambiente**: `tenant-santa-maria` existe en los dos, con variante de [[pqrs]] distinta en cada uno (`buzon_simple` en staging, `con_sla` en producción). Lo que distingue es el proyecto, nunca el nombre.

## El typecheck de functions comprobaba solo la mitad

`functions/tsconfig.json` incluye únicamente `src`, y es correcto: es el que emite a `lib/` y ahí no debe caer una prueba. El efecto secundario era que `npx tsc --noEmit` **nunca pasaba por `functions/tests/`** —diecisiete archivos y más de trescientas pruebas sin comprobar tipos— mientras el gate del proyecto prometía «typecheck limpio en functions/».

Se descubrió el 17 de agosto de 2026 porque un cambio de firma dejó una llamada de prueba pasando un `string` donde iba un objeto: pasó el typecheck en verde y lo cazó vitest al ejecutar. Con suerte, porque esa llamada tenía aserción; una que solo construyera datos habría pasado las dos puertas. **Usar `npm --prefix functions run typecheck`**, que usa `tsconfig.typecheck.json` y añade `tests`.

## Una bandera puede existir y no gobernar nada

`ai-pqrs-suggestions` existía en el catálogo de [[banderas-funcionalidad]] desde su creación, con una ficha que describía exactamente el panel de IA de [[pqrs]]. No aparecía en un solo sitio de `src/` fuera del propio catálogo: **el panel se pintaba siempre**. El servidor sí la comprobaba, así que el efecto no era una fuga sino un panel que se ve y falla al pulsarlo — y habría llegado a producción, donde su callable ni siquiera está desplegada.

Regla: al añadir una bandera, comprobar que **algo la lee**, no solo que está declarada. Un `grep` de la clave que solo devuelve el catálogo es la señal.

## El sembrador de banderas no enciende nada

`functions/scripts/seed-feature-flags.mjs` es idempotente y **no destructivo a propósito**: crea los documentos que falten con el valor del catálogo y no toca un campo existente, para que correrlo dos veces no reencienda algo que alguien apagó a mano. Consecuencia que confunde: sembrar un catálogo nuevo deja las banderas **apagadas**, porque así nacen. Sembrar no es encender. Para mover una, `functions/scripts/mover-bandera.mjs <projectId> <clave> <true|false>` o la consola de [[superadmin]].

## Desplegar functions desde una rama que no las contiene las BORRA

`firebase deploy --only functions` elimina de la nube las funciones que no estén en el código fuente que sube. Si producción corre funciones desplegadas desde `develop` y alguien despliega desde `master` sin haber promocionado, esas funciones **desaparecen** sin más aviso que su ausencia. Ocurrió como riesgo real el 17 de agosto de 2026 con los dos triggers del modo sombra de [[pqrs]]: se desarmó promocionando `develop` a `master`, no redesplegando. Antes de cualquier despliegue de functions, comprobar que la rama contiene todo lo que ya está desplegado.

## El proveedor simulado produce salidas con forma de real

El adaptador de [[puerta-ia]] cae al simulador cuando `ia-proveedor-real` está apagada, y su salida cumple el mismo esquema que la del modelo. Para una pantalla eso es inocuo —se ve un borrador raro—, pero **cualquier cosa que persista esa salida guarda datos falsos indistinguibles de los buenos**. Es el riesgo del modo sombra: un gold set envenenado se detecta comparándolo, mientras que una referencia de despliegue envenenada **parece que funciona**, porque no hay nada contra qué contrastarla.

Regla general: quien persista una salida del modelo debe guardar **con qué proveedor se generó**, y abstenerse si no es el real.

## Revertir un pago NO es anular su asiento del libro

Son dos operaciones distintas y una es un subconjunto pobre de la otra. Un pago toca **tres sitios**: el asiento del libro, la cuota en cartera y —si vino de ahí— el comprobante del residente. `reverseLedgerEntry` solo toca el primero. Usarla sobre un asiento de pago dejaría el libro cuadrado y **la cuota diciendo que está pagada**, que es exactamente el desajuste que `FIN-001` vino a cerrar.

La interfaz del libro ya lo impedía sin decirlo: solo ofrece «Reversar movimiento» a los asientos `sourceType: "manual"`, y uno de pago es `billingStatement`. Desde `FIN-001` esos asientos tienen su propia acción, «Revertir pago», que llama a la callable `revertPayment`.

**El detalle que hace posible la reversión** es que el asiento guarda su `operationKey`. Sin ese campo la operación no es *direccionable*: la marca de idempotencia sabe cuál es su asiento, pero el asiento no sabría cuál es su marca, y la del cobro manual es un UUID que muere con el formulario. **Los asientos anteriores a `FIN-001` no la tienen y no se pueden revertir por esa vía** — hay que anularlos a mano en las dos colecciones.

Y dos consecuencias que no son obvias:

- **Revertir no es «volver a pendiente».** El estado se recalcula contra la fecha, así que una cuota cuyo vencimiento ya pasó vuelve **vencida**. Es lo correcto, pero sorprende.
- **El comprobante del residente queda rechazado, no pendiente.** Devolverlo a pendiente parecería más amable y rompería la idempotencia: su clave de aprobación es su propio id, así que al re-aprobarlo la marca ya existiría y el pago **no se aplicaría**, devolviendo «ya aplicado» sin aplicar nada.

## El catálogo de banderas vive en CUATRO sitios, no en dos

Los dos evidentes son los espejos de código —`src/lib/feature-flags/catalog.ts` para el cliente y
`functions/src/feature-flags.ts` para el servidor, duplicados a propósito porque `src/` no puede
importar de `functions/`—. **Los otros dos son scripts, y son los que muerden:**
`functions/scripts/seed-feature-flags.mjs`, que crea el documento, y
`functions/scripts/mover-bandera.mjs`, que lo enciende.

**Añadir una bandera tocando solo los dos primeros la deja imposible de encender, sin síntoma
visible.** El sembrador no crea su documento y el movedor rechaza la clave como desconocida, así
que la capacidad se queda apagada para siempre y nadie ve un error: simplemente no pasa nada.
Ocurrió con las tres banderas de producto de agosto de 2026, y se descubrió **al ir a encenderlas
en staging**, no antes.

Es pariente de [[banderas-funcionalidad|una bandera puede existir y no gobernar nada]]: allí
faltaba quien la leyera, aquí falta quien la cree. **La comprobación es la misma y cuesta un
`grep`**: la clave nueva tiene que aparecer en los cuatro ficheros.

## Una exclusión escrita contra un VALOR se rompe cuando cambia quien escribe ese valor

`computeFundPosition` excluye del ingreso los asientos de categoría `alicuota`, para no duplicar
el recaudo que [[cartera-campanas|Cartera]] ya suma. Funciona — **por accidente**: el comando de
pago escribe `alicuota` en *todos* los asientos de cobro, sea una cuota o una multa.

El día que el asiento lleve la categoría de verdad, la multa **deja de coincidir con el valor
excluido**, entra en el ingreso del libro y sigue contándose en Cartera: **se cuenta dos veces**.
Nada falla, nada avisa, y la cifra que se rompe es dinero. Detalle en [[integridad-financiera]] §5.

**La forma general, que vale fuera de finanzas:** cuando una condición se escribe contra un valor
concreto en vez de contra la **propiedad** que de verdad importa —aquí, el origen del asiento—,
queda acoplada a que nadie cambie quién produce ese valor. Y ese cambio **no rompe ninguna
prueba**, porque la prueba también se escribió contra el valor.

## Una regla nueva también hay que verificarla contra lo que ya existe

Vivaru y Albert acordaron que cierto correo **no viajaría dentro de ningún documento** del
intercambio. Esa dirección **ya llevaba tiempo escrita en uno de ellos**, en otro papel. Nadie lo
comprobó al escribir la regla, y se descubrió al ver al otro equipo dar por recibido algo que no
se había mandado por ese canal. Ver [[integracion-albert]].

Este vault ya tiene catalogada la forma contraria —una frase que **fue** cierta y envejeció, como
«Albert no tiene webhooks»—. Ésta es la simétrica y se cuela más fácil: **la frase no envejeció,
nació falsa.** Una regla se escribe mirando hacia adelante, así que a nadie se le ocurre
verificarla hacia atrás.

**Regla: antes de dar por adoptada una prohibición —un dato que no debe estar en cierto sitio,
una llamada que no debe existir— hacer el `grep` que demuestre que hoy se cumple.** Si no se
cumple, la regla no está adoptada: está pendiente, y hay que decir qué se hace con lo que ya la
incumple.
