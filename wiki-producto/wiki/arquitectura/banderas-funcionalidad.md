---
tags: [arquitectura, plataforma, banderas, kill-switch]
tipo: concepto
fuentes: ["plan-general-ia", "estrategia-ia-minima-viable"]
fecha_creacion: 2026-08-09
fecha_actualizacion: 2026-08-17
---

# Banderas de funcionalidad y kill switch

**Mecanismo genérico de plataforma para encender y apagar capacidades sin desplegar.** No es una pieza del programa de IA: el [[programa-ia]] es su primer cliente, no su dueño. Nada bajo `src/lib/feature-flags/` sabe qué es una operación de IA, y así debe seguir — sirve igual para un módulo nuevo, un experimento o una integración con un tercero que se cae.

Hasta el 9 de agosto de 2026 la colección `featureFlags` eran diez líneas de reglas de Firestore sin un solo consumidor. Existía el permiso y no existía el lector, que es la peor combinación posible: la ilusión de un interruptor.

## Por qué existe

Del plan maestro de IA, el principio que la justifica: **apagar tiene que ser gratis.** Si apagar una capacidad requiere un despliegue, en el momento en que haga falta apagarla no se va a poder. Esa es la misma lógica que sostiene el [[roadmap-tecnico]] y que hace que el gate de módulos del [[ciclo-de-vida-tenant]] viva en el servidor y no en el sidebar.

## Precedencia

Cinco niveles, y gana el primero que aplique:

| | Nivel | Qué hace |
|---|---|---|
| 1 | `featureFlags/_global.killSwitch` | Apaga **todo**, sin excepción |
| 2 | `featureFlags/{clave}.killSwitch` | Apaga esa capacidad en todos los conjuntos |
| 3 | `featureFlagOverrides/{tenantId}.flags[clave]` | Enciende o apaga solo en ese conjunto |
| 4 | `featureFlags/{clave}.enabled` | Valor global |
| 5 | Default del catálogo | Capacidad nueva → apagada |

**Los dos kill switches van arriba de los overrides, y esa es toda su razón de ser.** Si bastara con poner `enabled: false`, una capacidad encendida a mano en cinco conjuntos seguiría encendida en los cinco justo cuando hay que apagarla.

El default del catálogo tiene dos mitades: una capacidad **nueva** nace apagada; una bandera puesta sobre una función **que ya está viva** nace encendida, porque si no, añadir la bandera sería apagar la función para todos.

## Dos colecciones, y la separación es de seguridad

`featureFlags/{clave}` no contiene ningún dato de conjunto, y por eso lo puede leer cualquier sesión. Los overrides viven aparte, en `featureFlagOverrides/{tenantId}`, con un documento por conjunto.

Si los overrides vivieran dentro del documento de la bandera, cualquier residente firmado podría enumerar los conjuntos de la plataforma leyendo el mapa. Es el mismo criterio de aislamiento que gobierna [[multi-tenancy]] y que las reglas aplican en el resto de colecciones: leer los overrides solo los miembros de ese conjunto, escribirlos solo superadmin. Ver [[firebase-firestore]] para el patrón general de reglas y [[pruebas-reglas-emulador]] para cómo se verifica.

## Las dos capas del lector

**Cliente — en tiempo real.** `FeatureFlagsProvider` va montado dentro del proveedor de sesión (ver [[autenticacion-roles]]) porque resuelve el conjunto desde la sesión y nunca desde la ruta. Se suscribe con `onSnapshot`, así que un cambio en la consola de Firestore se acusa en la aplicación abierta sin recargar. Un lector que solo mira al montar no es un kill switch, es una configuración de arranque.

**Servidor — el candado.** `assertFeatureEnabled` en Cloud Functions. El gate del cliente oculta la interfaz; lo que impide ejecutar la operación es el servidor. Es la misma lección que dejó el gate de módulos del trial y que está anotada en [[trampas-conocidas]]: lo que se ve se salta escribiendo la URL o llamando la callable directo.

No lleva caché a propósito. Un TTL de treinta segundos convierte «apagado inmediato» en «apagado casi siempre», y una instancia caliente vive minutos.

## Falla apagado

Si no se pueden leer las banderas, todo queda apagado y el flujo manual sigue funcionando. Y solo cuentan booleanos estrictos: un `"true"` escrito a mano en la consola de Firestore no enciende nada. La consola de superadmin muestra de qué nivel salió cada valor, para que ese error sea visible en vez de silencioso.

## Dónde se opera

En `/superadmin/flags`, dentro del módulo [[superadmin]]: catálogo agrupado por área, estado resuelto con su origen, interruptor global por bandera, kill switch por bandera, kill switch maestro con motivo, y overrides por conjunto. Editar el documento a mano en Firestore sigue siendo un camino válido; la consola existe para que apagar a las tres de la mañana no dependa de recordar qué campo mandaba sobre cuál.

El catálogo se siembra con `functions/scripts/seed-feature-flags.mjs`, que es idempotente y no pisa nada de lo que ya exista — un script de siembra que reenciende lo que alguien apagó a mano es un incidente, no una utilidad.

## Qué hay en el catálogo hoy

**Nueve banderas**, y el estado real cambió el 17 de agosto de 2026: producción dejó de tener la colección vacía.

Siete del área de IA. Una por cada capacidad prevista en el [[portafolio-prd]] —la puerta de la plataforma, el borrador de [[comunicaciones]], la sombra y la sugerencia visible de [[pqrs]], el mapeo de columnas del [[onboarding-guiado]] y la extracción de comprobantes de [[billing]]— más `ia-proveedor-real`, que decide si responde el modelo o el simulador y es **la que empieza a costar dinero**.

Estado en producción, medido el 17 de agosto de 2026: **`ai-gateway`, `ai-pqrs-shadow` e `ia-proveedor-real` encendidas**; el resto apagadas. En staging están encendidas además las dos de sugerencia visible.

**Las otras dos son las que demuestran que el mecanismo es genérico de verdad**, porque no son de IA y ninguna nace apagada:

- `operacion-app-check-monitor` **nace encendida** —describe lo que ya pasa hoy— y está redactada en positivo a propósito. Gobierna si la [[puerta-ia]] rechaza o solo registra las llamadas sin App Check; si dijera «exigir App Check», bajar el kill switch maestro relajaría una comprobación de seguridad en vez de endurecerla.
- `producto-importacion-masiva` también nace encendida, porque los dos asistentes de importación ya estaban vivos cuando se creó la bandera: ponerla en `false` habría apagado una función existente para todos. Es la segunda mitad de la regla del default.

**Tres cosas que este catálogo enseñó y conviene no volver a aprender:**

- **Una bandera declarada no gobierna nada por sí sola.** `ai-pqrs-suggestions` describía en su ficha el panel de IA de PQRS y no cerraba nada: el panel se pintaba siempre. Ver [[trampas-conocidas]].
- **Sembrar no es encender.** El sembrador es no destructivo a propósito, así que crea las banderas con el valor del catálogo — y las de IA nacen apagadas.
- **Una capacidad puede estar encendida y no hacer nada útil**, si `ia-proveedor-real` está apagada: responde el simulador, con salidas que tienen la forma exacta de las reales.
