---
tags: [arquitectura, ia, plataforma, seguridad]
tipo: concepto
fuentes: ["plan-general-ia", "estrategia-ia-minima-viable"]
fecha_creacion: 2026-08-09
fecha_actualizacion: 2026-08-09
---

# Puerta de entrada de IA

**Un solo callable por el que pasa toda operación asistida.** Es `aiInvoke`, y al cerrar el Paso 1.2 del [[programa-ia]] hace las cuatro comprobaciones —quién llama, de qué conjunto, con qué rol y desde dónde— sin llamar todavía a ningún modelo. Detrás no hay nada: el catálogo de operaciones llega después.

## Por qué una sola puerta

Vivaru tiene 41 callables y cada una se acuerda por su cuenta de comprobar quién llama y de qué conjunto es. Funciona —no hay fuga hoy—, pero la seguridad depende de que cada una **se acuerde**. Cuarenta y una oportunidades de olvidarse, y la lista crece.

Con la IA eso no se sostiene, y no por purismo: una fuga entre conjuntos aquí no es leer datos ajenos, es mandar los datos del conjunto A dentro de un prompt del conjunto B a un proveedor externo. Por eso el aislamiento que describe [[multi-tenancy]] se extiende aquí al plano de la inferencia, y por eso «sospecha de fuga entre conjuntos» encabeza la lista de apagado inmediato.

## El conjunto sale de la sesión

La regla del paso, y la que gobierna todo lo demás: **el cliente no manda el conjunto.** El token de sesión ya lleva `tenantId` y `role` como custom claims —los pone Vivaru al crear cada usuario, ver [[autenticacion-roles]]—, así que la puerta lo lee de la credencial que ella misma emitió.

Y va un paso más allá: **rechaza cualquier petición que traiga `tenantId`, aunque coincida.** Aceptarlo «porque acertó» es la costumbre que abre el agujero el día que una comprobación se olvide. No es que no le creamos al cliente; es que no le preguntamos.

Los claims proponen y la membresía dispone: acto seguido se contrasta contra `tenantUsers/{tenantId}_{uid}`, porque un token sobrevive a una baja o a una degradación hasta que caduca. Un token que dice `tenant_admin` sobre una membresía que dice `resident` no pasa.

**El superadmin no puede invocar**, y no es un olvido: no tiene conjunto en su sesión, así que dejarle operar exigiría aceptar un `tenantId` del cliente. Para operar sobre un conjunto, se entra al conjunto — coherente con cómo el resto del producto trata al rol en [[superadmin]].

## El orden de las comprobaciones importa

App Check → sesión → «no mandes el conjunto» → claims → membresía viva → **bandera** → rol → operación.

La bandera va antes que el rol a propósito: cuando la capacidad está apagada para todos, decirle a alguien que le falta permiso es mandarlo a pedir un permiso que no existe. La bandera es `ai-gateway`, del catálogo de [[banderas-funcionalidad]], y apagarla cierra la puerta sin desplegar.

La decisión vive en una función pura, separada del callable, por la misma razón que la precedencia de las banderas: es la parte que puede estar mal de forma peligrosa y así se prueba entera. Ver [[pruebas-reglas-emulador]] para el criterio general de qué se prueba y con qué.

## App Check: cableado, todavía no exigido

App Check comprueba que la llamada viene de la aplicación real y no de un script con la URL copiada. Importa sobre todo donde cada llamada cuesta dinero.

Hasta agosto de 2026 estaba **dormido de punta a punta**: la función de arranque existía sin que la llamara nadie, no había clave de reCAPTCHA en el entorno y el servidor no exigía nada. El Paso 1.2 despertó el cliente y dejó el rechazo gobernado por la bandera `operacion-app-check-monitor`: encendida deja pasar y registra, apagada rechaza.

Esa bandera está **en positivo** —«modo monitor encendido», no «exigir App Check»— por el kill switch maestro: como apaga todas las banderas, una bandera que dijera «exigir» se relajaría justo al bajar la palanca. Así, apagarlo todo endurece.

Falta el trabajo de consola —clave de reCAPTCHA Enterprise, registro de la app, variable de entorno— antes de poder apagar el modo monitor. Está anotado en los pendientes junto al resto de lo que no se resuelve con código, como el caso de [[dominios-app-hosting]].

## Lo que todavía no hace

No llama a ningún modelo, no valida esquemas de salida, no mide costo y no lleva cuota. Eso es el resto del Paso 1, y llega en este orden: catálogo de operaciones, adaptador del proveedor con validación, telemetría y cuotas. El primer consumidor real será el borrador asistido de [[comunicaciones]], que es el canario del programa por ser el de error más barato — un borrador malo se borra, a diferencia de lo que se juega en [[billing]].
