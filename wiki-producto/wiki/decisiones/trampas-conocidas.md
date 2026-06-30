---
tags: [decision, trampas, bugs, antipatrones]
tipo: decision
fuentes: ["DESIGN.md", "PRODUCT.md", "consolidacion-landing-2026", "sesion-cartera-crm-2026-06"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-06-23
---

# Trampas Conocidas

Errores que han ocurrido o que tienen alta probabilidad de ocurrir durante el desarrollo. Documentados para no repetirlos.

## Un widget que falla tumba todo /admin (sin aislamiento)

La ruta `/admin` tiene un único error boundary de nivel ruta (`src/app/(admin)/admin/error.tsx`), que muestra "No pudimos cargar el workspace de administración". Si **cualquier** widget/tablero de una página lanza durante el render (típico: un chart de **recharts** con un dato límite, o un `Intl.NumberFormat` con `currency` undefined), el error sube hasta ese boundary y **toda la interfaz de /admin se cae**, no solo el widget. Pasó en Cartera al poblar los tableros financieros (Liquidez, Cuentas por pagar, Flujo de caja). Regla: envolver toda sección de dashboard/tablero que consuma datos del tenant en `WidgetErrorBoundary` (`src/components/shared/widget-error-boundary.tsx`) para degradar el widget y mantener viva la página. Ver [[layout-patterns]] y [[billing]].

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

Las callables que fijan `cors: callableCorsOrigins` (`createTenantAdmin`, `createTenantOperationalUser`, `provisionResidentTemporaryAccess`, `completeResidentPasswordChange`) **rechazan orígenes no listados**. Síntoma exacto: en los logs solo aparece `OPTIONS 204` (preflight) y ningún `POST`; en el navegador, `net::ERR_FAILED`. El dominio que sirve la app (`www.grupovivaru.com`) debe estar en `callableCorsOrigins` o todas esas operaciones fallan en silencio. Ver [[autenticacion-roles]].

## unitId de personas: doc id, no slug

`createUnit` crea el doc de unidad con **ID autogenerado** y guarda un slug en el campo `unitId`. La persona debe referenciar el **doc id** (`createdUnit.id`), no el slug. Si se guarda el slug, `createPerson`/`deletePerson` hacen `updateDoc(units/<slug>)` sobre un doc inexistente → la regla evalúa `tenantId` indefinido → `permission-denied` ("No tienes permiso"). Por eso los borrados de unidad ahora son *best-effort*. Ver [[firebase-firestore]] y [[usuarios]].

## Functions: recompilar y fijar secret antes de deploy

El bloque `functions` de `firebase.json` no tiene `predeploy`, así que `firebase deploy --only functions` sube el `lib/` ya compilado. Si no se corre `npm --prefix functions run build` antes, se despliega código viejo y el deploy dice "sin cambios". Además, una función que referencia un secret (`RESEND_API_KEY`) **no despliega** si el secret no existe: hay que `firebase functions:secrets:set` **primero**, luego desplegar. Ver [[correos-mensajeria]].

## URL de acción personalizada de Firebase Auth

Para que el enlace de los correos abra `/restablecer`, se fija la URL de acción global en Authentication → Templates. Falla con "Se produjo un error al actualizar la URL de acción" si: el dominio no está en **Dominios autorizados**, o la cuenta de consola no es **Owner/Editor** del proyecto. Es un ajuste global (aplica a todas las plantillas). Ver [[correos-mensajeria]].

## Nunca importar functions/ desde src/ o tests/

App Hosting hace `npm ci` solo en la raíz (sin `functions/node_modules`), así que importar código de `functions/` desde `src/` o `tests/` rompe el `next build` con "Cannot find module 'firebase-admin/...'", aunque el build local pase. El cliente invoca las Cloud Functions por nombre vía `httpsCallable`, nunca importando su código. Ver [[stack-tecnico]].

## subscribeTenantCollection no serializa Timestamps

El helper hace `{ id, ...doc.data() }` crudo: los campos `serverTimestamp` (p. ej. `BillingCampaign.sentAt`) llegan como **Firestore Timestamp**, no como string. Renderizarlos directo en JSX lanza "Objects are not valid as a React child", y pasarlos a un formateador que hace `.split("-")` también revienta. Usar un formateador defensivo que detecte `.toDate` (`formatSentAt` en [[cartera-campanas|Cartera]]). Ver [[firebase-firestore]].

## Cartera: el flag `archived` se filtra SOLO en las tablas vivas

Archivar un período de [[billing|cartera]] pone `archived=true` pero **no borra**. El filtro de `archived` debe aplicarse únicamente en la tabla viva del admin (a nivel página). El hook `useBillingStatements` conserva su firma; el gráfico histórico, `cuotaIncome`, los tableros, el [[reportes|reporte de comité]] y la vista del [[portal-residente]] leen el set completo. Si se filtra `archived` en el hook o en esos consumidores, se pierde el análisis por período y el residente deja de ver su deuda. La mora de meses cerrados vive en la pestaña Cartera vencida — ver [[cartera-campanas]].

## Colecciones nuevas: desplegar reglas antes del front

Cuando el front empieza a escribir una colección nueva (`billingCampaigns`, `billingSchedules`, `billingReminderJobs`) o a llamar `ensureSystemFolder` con una clave nueva, hay que **desplegar reglas/functions ANTES** del push del front (App Hosting). Si no, la primera escritura del usuario cae en `permission-denied` o `invalid-argument`. Secuencia segura: deploy de reglas + functions → luego push de `master`. Ver [[firebase-firestore]] y [[correos-mensajeria]].

## Relaciones

- Véase también: [[absolute-bans]], [[mobile-first-ios]], [[form-validation]], [[tailwind-v4-spacing-fix]], [[autenticacion-roles]], [[correos-mensajeria]], [[cartera-campanas]], [[fusion-unidades]]
- Depende de: —
- Se conecta con: [[animaciones]], [[domain-types]], [[firebase-firestore]], [[stack-tecnico]], [[tokens-color]]

## Fuentes

- [[design-md]], [[product-md]], [[consolidacion-landing-2026]]
