---
tags: [modulo, onboarding, activacion]
tipo: tecnica
fuentes: ["steps.ts", "plan-self-service-trial", "sesion-onboarding-2026-07"]
fecha_creacion: 2026-08-01
fecha_actualizacion: 2026-08-01
---

# Onboarding guiado — la puesta en marcha

Una guía de **18 pasos en 4 bloques** que lleva a un conjunto nuevo desde cero hasta operar. Definida en `src/lib/onboarding/steps.ts`, se muestra en el [[dashboard-admin]] y acompaña al usuario dentro de cada módulo.

## Checklist, no tour

La decisión de diseño más importante fue no hacer un tour de bienvenida. Un tour se ve una vez, se salta, y no deja rastro de qué falta. Un checklist persiste, sabe qué se completó y **se puede abandonar y retomar**. Cada fila lleva a su pantalla y explica en contexto cómo funciona esa pantalla — no antes, no en un modal aparte.

## Los cuatro bloques

| Bloque | Pasos | Propósito |
|---|---|---|
| `configura` | agrupaciones, unidades, residentes, portería | Que exista el conjunto |
| `prueba` | visita, portal de portería, portal del residente, invitaciones | Que se vea funcionando |
| `cobrar` | primer cobro, primer pago | Que entre dinero |
| `descubre` | comunicados, reservas, PQRS, paquetería, encuestas, servicios, documentos, financiero | Que conozca el resto |

El bloque `descubre` se añadió después de una observación del usuario: terminados los básicos, nadie sabía que existían los demás módulos. Recorre [[comunicaciones]], [[reservaciones]], [[pqrs]], [[paquetes]], [[encuestas]] y [[reglamento]] con el mismo patrón — llevar y explicar.

El paso `porteria` también nació de una ausencia detectada: habilitar al guarda y ver el [[portal-guardia]] faltaba por completo, y es lo que hace tangible la operación diaria.

## Dos recorridos

`OnboardingTrack` vale `trial` o `cliente`, y `stepsForTrack()` decide qué ve cada uno. Un cliente nuevo que nunca probó no debería recibir el discurso de la prueba de 15 días. El campo lo fija el equipo comercial al activar el conjunto — ver [[ciclo-de-vida-tenant]].

## Cómo sabe que un paso está hecho

Cada paso declara una `OnboardingSignal`: una colección, y opcionalmente un campo que debe ser positivo. La guía consulta y marca. Dos aprendizajes caros:

**La señal tiene que ser la que el rol puede leer.** El paso de pago apuntaba a `paymentReceipts`, que solo crea el residente y el administrador no puede leer — devolvía 403. Con esa señal, todo cliente se habría quedado en 9 de 10 para siempre. Ahora mira `billingStatements` con `paymentAmount` positivo. Ver [[billing]].

**Los datos sembrados no cuentan.** El filtro `isExample` evita dar por completado un paso que hizo la siembra del ambiente de prueba, no el usuario.

## Presentación

La guía se rehízo en julio de 2026 porque parecía «SAP de hace muchos años». Cada fila lleva indicador de completado a la derecha, y la navegación pasa por un velo con el logo de Vivaru y el fondo difuminado — ver [[transiciones-navegacion]]. El resto de apartados adoptó después el mismo lenguaje visual, siguiendo [[layout-patterns]] y [[tokens-color]].

La banda de la guía vive por encima de `{children}` en el app-shell, así que un throw suyo tumbaría las 16 rutas de `/admin`. Va envuelta en `WidgetErrorBoundary` con fallback nulo, como manda [[absolute-bans]].
