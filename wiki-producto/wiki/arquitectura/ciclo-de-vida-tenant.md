---
tags: [arquitectura, multi-tenancy, trial, permisos]
tipo: tecnica
fuentes: ["plan-self-service-trial", "firestore.rules", "trial-modules.ts"]
fecha_creacion: 2026-08-01
fecha_actualizacion: 2026-08-01
---

# Ciclo de vida del conjunto — de prueba a cliente

`tenants.status` gobierna qué puede hacer un conjunto. Cuatro valores, y desde julio de 2026 dejaron de ser decorativos.

| Estado | Significa | Escrituras |
|---|---|---|
| `trial` | Prueba de 15 días | Sí, con módulos limitados |
| `active` | Cliente | Sí, todo |
| `expired` | Prueba vencida | **No** |
| `suspended` | Cliente suspendido | **No** |

## El candado real: `tenantOperable()`

Durante meses el estado era informativo — la interfaz mostraba avisos, pero las reglas de Firestore seguían aceptando escrituras de un conjunto vencido. Un cliente con la sesión abierta podía seguir operando indefinidamente.

`tenantOperable()` cierra eso en la capa que importa. Está aplicada a **25 colecciones operativas** en 52 statements de `firestore.rules`: si el conjunto no está `trial` ni `active`, la escritura se deniega. Es el mismo principio de [[multi-tenancy]] llevado al tiempo en vez del espacio: el `tenantId` aísla quién, `tenantOperable` aísla cuándo.

Dos exclusiones deliberadas:

- **`supportTickets`** — el cliente suspendido tiene que poder pedir ayuda. Ver [[soporte]].
- **Lecturas** — un conjunto vencido conserva acceso a sus datos. Se congela, no se borra.

## El candado de módulos, en tres capas

Durante `trial` y `expired`, `moduleAccessFor()` (en `src/lib/config/trial-modules.ts`) decide si un módulo está `libre`, en vista previa o bloqueado. Se aplica en tres sitios porque cualquiera de los tres solo no basta: navegación, acción dentro de la página, y guard en la Cloud Function. Un candado únicamente en el menú es un adorno — la URL sigue funcionando.

La matriz se **duplica a propósito** en `functions/src/trial-modules.ts`, porque `src/` no puede importar de `functions/` sin romper el build de App Hosting. Es la trampa más citada de [[trampas-conocidas]]. Las dos copias llevan referencia cruzada.

Un conjunto `active` no pasa por esta matriz: tiene servicio completo. La distinción es distinta a la de [[modulos-variantes]], que decide *cómo* opera un módulo, no *si* está disponible.

## De prueba a cliente

El alta nace de un lead del landing ([[landing-marketing]]), se aprovisiona un ambiente sembrado con datos de ejemplo, y a los 15 días el ciclo automatizado lo marca `expired`. La conversión la hace el equipo comercial desde la consola de [[superadmin]], que cambia `status` a `active` y fija `onboardingTrack`.

Ese campo importa más de lo que parece: decide qué guía ve el usuario al entrar. Ver [[onboarding-guiado]].

## La trampa de la sesión

Cambiar `status` en Firestore no actualiza la sesión abierta del navegador. Un cliente recién activado puede seguir viendo la interfaz de prueba —días restantes, botón de suscripción, módulos bloqueados— hasta que su sesión se renueve. Pasó en producción y costó una ronda entera de diagnóstico: el cambio estaba bien aplicado, lo que fallaba era la creencia de que se propagaba solo. Verificar contra Firestore, no contra lo que muestra la pantalla.

## Datos de ejemplo

Los ambientes sembrados marcan sus documentos con `isExample`. Ese filtro es funcional, no cosmético: [[onboarding-guiado]] lo usa para no dar por completado un paso que en realidad hizo la siembra. Ver también [[integridad-financiera]].
